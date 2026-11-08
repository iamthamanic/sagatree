/**
 * Meshy Auto-Rig adapter — skeleton humanoid meshes after generate/remesh.
 * Location: supabase/functions/_shared/avatar-meshy-rigging.ts
 *
 * POST/GET /openapi/v1/rigging. Prefer input_task_id (Meshy CDN) over model_url.
 * Result GLB is under result.rigged_character_glb_url (not model_urls).
 */

type FetchLike = typeof fetch;

export interface MeshyRiggingTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  /** Rigged character GLB — Meshy nests this under `result`. */
  riggedGlbUrl?: string;
  task_error?: { message?: string };
}

export interface MeshyRiggingCreateInput {
  /** Prefer Meshy task id (text/image/remesh). Takes priority over modelUrl. */
  inputTaskId?: string;
  /** Public https GLB URL or data URI — only when no inputTaskId. */
  modelUrl?: string;
  heightMeters?: number;
}

export interface MeshyRiggingProvider {
  createTask(input: MeshyRiggingCreateInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyRiggingTask>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy rigging create response missing result id');
  }
  return body.result.trim();
}

function parseHttpsUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}

export function parseMeshyRiggingTask(body: unknown): MeshyRiggingTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy rigging task response invalid');
  }
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  let riggedGlbUrl: string | undefined;
  if (isRecord(body.result)) {
    riggedGlbUrl = parseHttpsUrl(body.result.rigged_character_glb_url);
  }
  // Some responses may also expose top-level model_urls.glb — accept as fallback.
  if (!riggedGlbUrl && isRecord(body.model_urls)) {
    riggedGlbUrl = parseHttpsUrl(body.model_urls.glb);
  }
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return {
    id: body.id,
    status: body.status as MeshyRiggingTask['status'],
    progress,
    riggedGlbUrl,
    task_error,
  };
}

const DEFAULT_RIGGING_BASE = 'https://api.meshy.ai/openapi/v1';

/** Rigging lives on OpenAPI v1 (same as remesh). */
export function normalizeMeshyRiggingBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_RIGGING_BASE;
  if (/\/openapi\/v2$/i.test(trimmed)) {
    return trimmed.replace(/\/openapi\/v2$/i, '/openapi/v1');
  }
  return trimmed;
}

export function createLiveMeshyRiggingProvider(
  config: { apiKey: string; baseUrl: string },
  fetchImpl: FetchLike = fetch,
): MeshyRiggingProvider {
  const baseUrl = normalizeMeshyRiggingBaseUrl(config.baseUrl);
  return {
    async createTask(input): Promise<{ taskId: string }> {
      const inputTaskId = input.inputTaskId?.trim() ?? '';
      const modelUrl = input.modelUrl?.trim() ?? '';
      if (!inputTaskId && !modelUrl) {
        throw new Error('Meshy rigging requires input_task_id or model_url');
      }
      const payload: Record<string, unknown> = {
        height_meters: typeof input.heightMeters === 'number' && Number.isFinite(input.heightMeters)
          ? input.heightMeters
          : 1.7,
      };
      if (inputTaskId) {
        payload.input_task_id = inputTaskId;
      } else {
        payload.model_url = modelUrl;
      }
      const response = await fetchImpl(`${baseUrl}/rigging`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 280);
        throw new Error(
          `Meshy rigging create failed (${response.status})${detail ? `: ${detail}` : ''}`,
        );
      }
      const body: unknown = await response.json();
      return { taskId: parseCreateResponse(body) };
    },
    async getTask(taskId: string): Promise<MeshyRiggingTask> {
      const response = await fetchImpl(`${baseUrl}/rigging/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`Meshy rigging poll failed (${response.status})`);
      }
      const body: unknown = await response.json();
      return parseMeshyRiggingTask(body);
    },
  };
}

export function createMockMeshyRiggingProvider(
  options: { fail?: boolean; glbUrl?: string } = {},
): MeshyRiggingProvider {
  let created = false;
  return {
    async createTask(input): Promise<{ taskId: string }> {
      if (options.fail) throw new Error('Meshy rigging mock unavailable');
      if (!input.inputTaskId?.trim() && !input.modelUrl?.trim()) {
        throw new Error('Meshy rigging requires input_task_id or model_url');
      }
      created = true;
      return { taskId: 'mock-meshy-rig-task' };
    },
    async getTask(): Promise<MeshyRiggingTask> {
      if (!created) throw new Error('Meshy rigging mock task missing');
      if (options.fail) {
        return {
          id: 'mock-meshy-rig-task',
          status: 'FAILED',
          progress: 0,
          task_error: { message: 'Mock rigging failure' },
        };
      }
      return {
        id: 'mock-meshy-rig-task',
        status: 'SUCCEEDED',
        progress: 100,
        riggedGlbUrl: options.glbUrl ?? 'https://assets.meshy.ai/mock/avatar-rigged.glb',
      };
    },
  };
}
