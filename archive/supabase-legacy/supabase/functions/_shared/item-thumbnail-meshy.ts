/**
 * Meshy text-to-image provider adapter (#140).
 * Fail-closed when MESHY_API_KEY is missing. Injectable for unit tests.
 * Location: supabase/functions/_shared/item-thumbnail-meshy.ts
 */

export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface MeshyTextToImageTask {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  image_urls?: string[];
  task_error?: { message?: string };
}

export interface MeshyProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface MeshyTextToImageProvider {
  createTask(prompt: string): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyTextToImageTask>;
}

type FetchLike = typeof fetch;

const DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1';
const DEFAULT_MODEL = 'nano-banana';

/**
 * Build Meshy text-to-image config.
 * - No second arg: legacy env `MESHY_API_KEY` (tests / explicit host paths).
 * - With second arg (incl. null): only that key — no silent env fallback.
 */
export function resolveMeshyProviderConfig(
  env: { get(key: string): string | undefined } = Deno.env,
  apiKeyOverride?: string | null,
): MeshyProviderConfig | null {
  const apiKey = apiKeyOverride !== undefined
    ? (apiKeyOverride?.trim() ?? '')
    : (env.get('MESHY_API_KEY')?.trim() ?? '');
  if (!apiKey) return null;

  const baseUrl = (env.get('MESHY_API_BASE_URL')?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const model = env.get('MESHY_TEXT_TO_IMAGE_MODEL')?.trim() || DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy create response missing result id');
  }
  return body.result.trim();
}

function parseTask(body: unknown): MeshyTextToImageTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy task response invalid');
  }
  const status = body.status as MeshyTaskStatus;
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  const image_urls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
    : undefined;
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return { id: body.id, status, progress, image_urls, task_error };
}

export function createLiveMeshyProvider(
  config: MeshyProviderConfig,
  fetchImpl: FetchLike = fetch,
): MeshyTextToImageProvider {
  return {
    async createTask(prompt: string): Promise<{ taskId: string }> {
      const response = await fetchImpl(`${config.baseUrl}/text-to-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_model: config.model,
          prompt,
          aspect_ratio: '1:1',
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 402) throw new Error('MESHY_CREDITS');
      if (response.status === 429) throw new Error('MESHY_RATE');
      if (!response.ok) throw new Error(`Meshy create failed (${response.status})`);

      const body: unknown = await response.json();
      return { taskId: parseCreateResponse(body) };
    },

    async getTask(taskId: string): Promise<MeshyTextToImageTask> {
      const response = await fetchImpl(`${config.baseUrl}/text-to-image/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Meshy status failed (${response.status})`);
      const body: unknown = await response.json();
      return parseTask(body);
    },
  };
}

/** Deterministic mock for offline CI — never calls the network. */
export function createMockMeshyProvider(options?: {
  failCreate?: boolean;
  failStatus?: boolean;
  imageUrl?: string;
}): MeshyTextToImageProvider {
  const taskId = 'mock-meshy-task-001';
  let polls = 0;
  return {
    async createTask(_prompt: string): Promise<{ taskId: string }> {
      if (options?.failCreate) throw new Error('MESHY_CREDITS');
      return { taskId };
    },
    async getTask(id: string): Promise<MeshyTextToImageTask> {
      if (options?.failStatus) throw new Error('Meshy status failed (500)');
      polls += 1;
      if (polls < 2) {
        return { id, status: 'IN_PROGRESS', progress: 40 };
      }
      return {
        id,
        status: 'SUCCEEDED',
        progress: 100,
        image_urls: [options?.imageUrl ?? 'https://assets.meshy.ai/mock/output.png'],
      };
    },
  };
}

export function mapMeshyStatusToJob(status: MeshyTaskStatus): {
  status: 'waiting' | 'generating' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
} {
  switch (status) {
    case 'PENDING':
      return { status: 'waiting', progress: 5 };
    case 'IN_PROGRESS':
      return { status: 'generating', progress: 50 };
    case 'SUCCEEDED':
      return { status: 'succeeded', progress: 100 };
    case 'CANCELED':
      return { status: 'canceled', progress: 0 };
    case 'FAILED':
    default:
      return { status: 'failed', progress: 0 };
  }
}
