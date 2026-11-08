/**
 * Meshy Image-to-3D provider adapter (#141).
 * Fail-closed when MESHY_API_KEY is missing. Injectable for unit tests.
 * Location: supabase/functions/_shared/item-model3d-meshy.ts
 */

export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface MeshyImageTo3dTask {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export interface MeshyImageTo3dProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Optional full Meshy Image-to-3D knobs — avatar generation supplies these from the provider adapter. */
export interface MeshyImageTo3dCreateOptions {
  texturePrompt?: string;
  poseMode?: 'a-pose' | 't-pose' | '';
  /** When true, Meshy remeshes to targetPolycount before returning GLB. */
  shouldRemesh?: boolean;
  targetPolycount?: number;
  aiModel?: string;
  modelType?: 'standard' | 'smart-topology';
  textureResolution?: '2k' | '4k' | '8k';
  enablePbr?: boolean;
  imageEnhancement?: boolean;
  topology?: 'triangle' | 'quad';
  ultraMode?: boolean;
  savePreRemeshedModel?: boolean;
}

/** Exactly one image source per create — prefer input_task_id when chaining from text-to-image. */
export type MeshyImageTo3dCreateInput =
  | ({ kind: 'input_task_id'; inputTaskId: string } & MeshyImageTo3dCreateOptions)
  | ({ kind: 'image_url'; imageUrl: string } & MeshyImageTo3dCreateOptions);

export interface MeshyImageTo3dProvider {
  createTask(input: MeshyImageTo3dCreateInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyImageTo3dTask>;
}

type FetchLike = typeof fetch;

const DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1';
const DEFAULT_MODEL = 'latest';

/**
 * Build Meshy Image-to-3D config.
 * - No second arg: legacy env `MESHY_API_KEY` (tests / explicit host paths).
 * - With second arg (incl. null): only that key — no silent env fallback.
 */
export function resolveMeshyImageTo3dConfig(
  env: { get(key: string): string | undefined } = Deno.env,
  apiKeyOverride?: string | null,
): MeshyImageTo3dProviderConfig | null {
  const apiKey = apiKeyOverride !== undefined
    ? (apiKeyOverride?.trim() ?? '')
    : (env.get('MESHY_API_KEY')?.trim() ?? '');
  if (!apiKey) return null;

  const baseUrl = (env.get('MESHY_API_BASE_URL')?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const model = env.get('MESHY_IMAGE_TO_3D_MODEL')?.trim() || DEFAULT_MODEL;

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

function parseTask(body: unknown): MeshyImageTo3dTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy task response invalid');
  }
  const status = body.status as MeshyTaskStatus;
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;

  let model_urls: { glb?: string } | undefined;
  if (isRecord(body.model_urls)) {
    const glb = typeof body.model_urls.glb === 'string' && body.model_urls.glb.startsWith('https://')
      ? body.model_urls.glb
      : undefined;
    if (glb) model_urls = { glb };
  } else if (typeof body.model_url === 'string' && body.model_url.startsWith('https://')) {
    model_urls = { glb: body.model_url };
  }

  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;

  return { id: body.id, status, progress, model_urls, task_error };
}

export function createLiveMeshyImageTo3dProvider(
  config: MeshyImageTo3dProviderConfig,
  fetchImpl: FetchLike = fetch,
): MeshyImageTo3dProvider {
  return {
    async createTask(input: MeshyImageTo3dCreateInput): Promise<{ taskId: string }> {
      // Defaults keep item-model3d path stable; avatar passes full adapter-mapped options.
      const textureResolution =
        input.textureResolution === '4k' || input.textureResolution === '8k' || input.textureResolution === '2k'
          ? input.textureResolution
          : '2k';
      const payload: Record<string, unknown> = {
        ai_model: (input.aiModel?.trim() || config.model),
        should_texture: true,
        texture_resolution: textureResolution,
        target_formats: ['glb'],
        enable_pbr: input.enablePbr !== false,
      };
      if (input.modelType === 'standard' || input.modelType === 'smart-topology') {
        payload.model_type = input.modelType;
      }
      if (input.imageEnhancement === true) {
        payload.image_enhancement = true;
      }
      if (input.ultraMode === true) {
        payload.ultra_mode = true;
      }
      if (input.topology === 'triangle' || input.topology === 'quad') {
        payload.topology = input.topology;
      }
      if (input.savePreRemeshedModel === true) {
        payload.save_pre_remeshed_model = true;
      }
      if (input.kind === 'input_task_id') {
        payload.input_task_id = input.inputTaskId;
      } else {
        payload.image_url = input.imageUrl;
      }
      const texturePrompt = input.texturePrompt?.trim();
      if (texturePrompt) {
        payload.texture_prompt = texturePrompt.slice(0, 800);
      }
      if (input.poseMode === 'a-pose' || input.poseMode === 't-pose') {
        payload.pose_mode = input.poseMode;
      } else if (input.poseMode === '') {
        payload.pose_mode = '';
      }
      if (input.shouldRemesh === true) {
        payload.should_remesh = true;
        const poly = typeof input.targetPolycount === 'number' && Number.isFinite(input.targetPolycount)
          ? Math.max(100, Math.min(300_000, Math.round(input.targetPolycount)))
          : 50_000;
        payload.target_polycount = poly;
      } else if (input.shouldRemesh === false) {
        payload.should_remesh = false;
      }
      if (
        input.modelType === 'smart-topology'
        && typeof input.targetPolycount === 'number'
        && Number.isFinite(input.targetPolycount)
      ) {
        payload.target_polycount = Math.max(100, Math.min(15_000, Math.round(input.targetPolycount)));
      }

      const response = await fetchImpl(`${config.baseUrl}/image-to-3d`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 402) throw new Error('MESHY_CREDITS');
      if (response.status === 429) throw new Error('MESHY_RATE');
      if (!response.ok) throw new Error(`Meshy image-to-3d create failed (${response.status})`);

      const body: unknown = await response.json();
      return { taskId: parseCreateResponse(body) };
    },

    async getTask(taskId: string): Promise<MeshyImageTo3dTask> {
      const response = await fetchImpl(
        `${config.baseUrl}/image-to-3d/${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok) throw new Error(`Meshy image-to-3d status failed (${response.status})`);
      const body: unknown = await response.json();
      return parseTask(body);
    },
  };
}

/** Deterministic mock for offline CI — never calls the network. */
export function createMockMeshyImageTo3dProvider(options?: {
  failCreate?: boolean;
  failStatus?: boolean;
  modelUrl?: string;
}): MeshyImageTo3dProvider {
  const taskId = 'mock-meshy-i23d-001';
  let polls = 0;
  return {
    async createTask(_input: MeshyImageTo3dCreateInput): Promise<{ taskId: string }> {
      if (options?.failCreate) throw new Error('MESHY_CREDITS');
      return { taskId };
    },
    async getTask(id: string): Promise<MeshyImageTo3dTask> {
      if (options?.failStatus) throw new Error('Meshy status failed (500)');
      polls += 1;
      if (polls < 2) {
        return { id, status: 'IN_PROGRESS', progress: 40 };
      }
      return {
        id,
        status: 'SUCCEEDED',
        progress: 100,
        model_urls: {
          glb: options?.modelUrl ?? 'https://assets.meshy.ai/mock/output.glb',
        },
      };
    },
  };
}

export function mapMeshyImageTo3dStatusToJob(status: MeshyTaskStatus): {
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
