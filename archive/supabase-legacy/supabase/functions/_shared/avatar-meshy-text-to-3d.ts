/**
 * Meshy Text-to-3D provider adapter for avatar generation (#10).
 * Fail-closed without API key. Injectable for unit tests.
 * Location: supabase/functions/_shared/avatar-meshy-text-to-3d.ts
 */

export type MeshyTextTo3dTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED';

export interface MeshyTextTo3dTask {
  id: string;
  status: MeshyTextTo3dTaskStatus;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export interface MeshyTextTo3dProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export interface MeshyTextTo3dProvider {
  createTask(prompt: string): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyTextTo3dTask>;
}

type FetchLike = typeof fetch;

const DEFAULT_BASE = 'https://api.meshy.ai/openapi/v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Text-to-3D lives on Meshy OpenAPI v2. Shared MESHY_API_BASE_URL is often
 * set to …/openapi/v1 for image-to-3d (items); that path 404s for text-to-3d.
 */
export function normalizeMeshyTextTo3dBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE;
  // Prefer explicit v2 when shared env points at the v1 image-to-3d base.
  if (/\/openapi\/v1$/i.test(trimmed)) {
    return trimmed.replace(/\/openapi\/v1$/i, '/openapi/v2');
  }
  return trimmed;
}

export function resolveMeshyTextTo3dConfig(
  env: { get(key: string): string | undefined } = Deno.env,
  apiKeyOverride?: string | null,
): MeshyTextTo3dProviderConfig | null {
  const apiKey = apiKeyOverride !== undefined
    ? (apiKeyOverride?.trim() ?? '')
    : (env.get('MESHY_API_KEY')?.trim() ?? '');
  if (!apiKey) return null;
  // Dedicated override wins; otherwise shared base (normalized) or v2 default.
  const explicit = env.get('MESHY_TEXT_TO_3D_BASE_URL')?.trim();
  const shared = env.get('MESHY_API_BASE_URL')?.trim();
  const baseUrl = normalizeMeshyTextTo3dBaseUrl(explicit || shared || DEFAULT_BASE);
  return { apiKey, baseUrl };
}

function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy create response missing result id');
  }
  return body.result.trim();
}

function parseTask(body: unknown): MeshyTextTo3dTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy task response invalid');
  }
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  let model_urls: { glb?: string } | undefined;
  if (isRecord(body.model_urls)) {
    const glb = typeof body.model_urls.glb === 'string' && body.model_urls.glb.startsWith('https://')
      ? body.model_urls.glb
      : undefined;
    if (glb) model_urls = { glb };
  }
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return {
    id: body.id,
    status: body.status as MeshyTextTo3dTaskStatus,
    progress,
    model_urls,
    task_error,
  };
}

export function createLiveMeshyTextTo3dProvider(
  config: MeshyTextTo3dProviderConfig,
  fetchImpl: FetchLike = fetch,
): MeshyTextTo3dProvider {
  return {
    async createTask(prompt: string): Promise<{ taskId: string }> {
      const response = await fetchImpl(`${config.baseUrl}/text-to-3d`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        // Minimal preview body — Meshy docs: only mode + prompt required.
        // Avoid art_style/should_remesh combos that 400 on some ai_model defaults (e.g. Meshy-6).
        body: JSON.stringify({
          mode: 'preview',
          prompt,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 280);
        throw new Error(
          `Meshy text-to-3d create failed (${response.status})${detail ? `: ${detail}` : ''}`,
        );
      }
      const body: unknown = await response.json();
      return { taskId: parseCreateResponse(body) };
    },
    async getTask(taskId: string): Promise<MeshyTextTo3dTask> {
      const response = await fetchImpl(`${config.baseUrl}/text-to-3d/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`Meshy text-to-3d poll failed (${response.status})`);
      }
      const body: unknown = await response.json();
      return parseTask(body);
    },
  };
}

export function createMockMeshyTextTo3dProvider(
  options: { fail?: boolean; glbUrl?: string } = {},
): MeshyTextTo3dProvider {
  let created = false;
  return {
    async createTask(): Promise<{ taskId: string }> {
      if (options.fail) throw new Error('Meshy mock unavailable');
      created = true;
      return { taskId: 'mock-meshy-avatar-task' };
    },
    async getTask(): Promise<MeshyTextTo3dTask> {
      if (!created) throw new Error('Meshy mock task missing');
      if (options.fail) {
        return {
          id: 'mock-meshy-avatar-task',
          status: 'FAILED',
          progress: 0,
          task_error: { message: 'Mock failure' },
        };
      }
      return {
        id: 'mock-meshy-avatar-task',
        status: 'SUCCEEDED',
        progress: 100,
        model_urls: {
          glb: options.glbUrl ?? 'https://assets.meshy.ai/mock/avatar.glb',
        },
      };
    },
  };
}

export function mapMeshyTextTo3dStatusToJob(
  status: MeshyTextTo3dTaskStatus,
): 'generating' | 'succeeded' | 'failed' {
  if (status === 'SUCCEEDED') return 'succeeded';
  if (status === 'FAILED' || status === 'CANCELED') return 'failed';
  return 'generating';
}
