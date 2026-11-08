/**
 * Meshy Remesh adapter — shrink oversized avatar GLBs before storage.
 * Location: supabase/functions/_shared/avatar-meshy-remesh.ts
 */

type FetchLike = typeof fetch;

export interface MeshyRemeshTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export interface MeshyRemeshProvider {
  createTask(input: {
    inputTaskId: string;
    targetPolycount: number;
  }): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyRemeshTask>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy remesh create response missing result id');
  }
  return body.result.trim();
}

function parseTask(body: unknown): MeshyRemeshTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy remesh task response invalid');
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
    status: body.status as MeshyRemeshTask['status'],
    progress,
    model_urls,
    task_error,
  };
}

/** Avatar-friendly poly budget for web viewers (~20–50k). */
export const AVATAR_MESHY_REMESH_TARGET_POLYCOUNT = 50_000;

const DEFAULT_REMESH_BASE = 'https://api.meshy.ai/openapi/v1';

/**
 * Remesh lives on OpenAPI v1. Shared MESHY_API_BASE_URL may be v2 (text-to-3d).
 */
export function normalizeMeshyRemeshBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_REMESH_BASE;
  if (/\/openapi\/v2$/i.test(trimmed)) {
    return trimmed.replace(/\/openapi\/v2$/i, '/openapi/v1');
  }
  return trimmed;
}

export function createLiveMeshyRemeshProvider(
  config: { apiKey: string; baseUrl: string },
  fetchImpl: FetchLike = fetch,
): MeshyRemeshProvider {
  const baseUrl = normalizeMeshyRemeshBaseUrl(config.baseUrl);
  return {
    async createTask(input): Promise<{ taskId: string }> {
      const response = await fetchImpl(`${baseUrl}/remesh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          input_task_id: input.inputTaskId,
          target_formats: ['glb'],
          target_polycount: input.targetPolycount,
          topology: 'triangle',
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 280);
        throw new Error(
          `Meshy remesh create failed (${response.status})${detail ? `: ${detail}` : ''}`,
        );
      }
      const body: unknown = await response.json();
      return { taskId: parseCreateResponse(body) };
    },
    async getTask(taskId: string): Promise<MeshyRemeshTask> {
      const response = await fetchImpl(`${baseUrl}/remesh/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`Meshy remesh poll failed (${response.status})`);
      }
      const body: unknown = await response.json();
      return parseTask(body);
    },
  };
}

export function createMockMeshyRemeshProvider(
  options: { fail?: boolean; glbUrl?: string } = {},
): MeshyRemeshProvider {
  let created = false;
  return {
    async createTask(): Promise<{ taskId: string }> {
      if (options.fail) throw new Error('Meshy remesh mock unavailable');
      created = true;
      return { taskId: 'mock-meshy-remesh-task' };
    },
    async getTask(): Promise<MeshyRemeshTask> {
      if (!created) throw new Error('Meshy remesh mock task missing');
      if (options.fail) {
        return {
          id: 'mock-meshy-remesh-task',
          status: 'FAILED',
          progress: 0,
          task_error: { message: 'Mock remesh failure' },
        };
      }
      return {
        id: 'mock-meshy-remesh-task',
        status: 'SUCCEEDED',
        progress: 100,
        model_urls: {
          glb: options.glbUrl ?? 'https://assets.meshy.ai/mock/avatar-remesh.glb',
        },
      };
    },
  };
}
