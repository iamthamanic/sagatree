/**
 * Host characterization of Edge `character-avatar-meshy` (MIG-404 / #820).
 * Location: server/src/modules/character/internal/character-avatar-meshy.ts
 *
 * Allowlisted Edge worker remains the live mount. Host ports pin authz/validation/
 * quota/idempotency/claim fixtures. No public activation / cutover in this slice.
 */

/** Explicit: no automatic host/public cutover (successor + MIG-600 still required). */
export const CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export const MESHY_AVATAR_PROMPT_MIN = 8 as const;
export const MESHY_AVATAR_PROMPT_MAX = 500 as const;
export const MESHY_AVATAR_NONCE_MAX = 80 as const;
export const MESHY_AVATAR_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const MESHY_AVATAR_RATE_LIMIT = 2 as const;
export const MESHY_AVATAR_RATE_WINDOW_SECONDS = 60 as const;
export const MESHY_AVATAR_IMAGE_PLACEHOLDER = 'Image-to-3D reference' as const;

const MESHY_MODELS = new Set([
  'latest',
  'meshy-5',
  'meshy-6',
  'meshy-7',
  'meshy-t1',
  'meshy-t2',
]);
const GEOMETRY = new Set(['low', 'standard', 'high', 'maximum', 'smart-topology']);
const TEXTURE = new Set(['standard', '2k', '4k', '8k']);
const POSE = new Set(['a-pose', 't-pose', 'none']);
const TOPOLOGY = new Set(['triangle', 'quad']);
const GLB_HOST_ALLOWLIST = new Set(['assets.meshy.ai', 'cdn.meshy.ai', 'localhost']);

export type MeshyAvatarMode = 'text' | 'image';
export type MeshyAvatarJobStatus =
  | 'queued'
  | 'generating'
  | 'remeshing'
  | 'rigging'
  | 'succeeded'
  | 'failed'
  | 'provider_unavailable';

export type MeshyAvatarJob = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly clientNonce: string;
  readonly generationMode: MeshyAvatarMode;
  readonly prompt: string;
  readonly idempotencyKey: string;
  status: MeshyAvatarJobStatus;
  progress: number;
  providerTaskId: string | null;
  remeshTaskId: string | null;
  remeshClaimedBy: string | null;
  storagePath: string | null;
  generationComplete: boolean;
};

export type MeshyAvatarPortsResult<T> =
  | { readonly ok: true; readonly value: T; readonly replayed?: boolean }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly code?: string;
    };

type QuotaEntry = { count: number; resetAt: number };

export type CharacterAvatarMeshyStore = {
  readonly jobs: Map<string, MeshyAvatarJob>;
  readonly byIdempotency: Map<string, string>;
  readonly quota: Map<string, QuotaEntry>;
  meshyConfigured: boolean;
  nextId: number;
};

export function createCharacterAvatarMeshyStore(
  meshyConfigured = true,
): CharacterAvatarMeshyStore {
  return {
    jobs: new Map(),
    byIdempotency: new Map(),
    quota: new Map(),
    meshyConfigured,
    nextId: 1,
  };
}

/** Legacy Edge idempotency: userId|nonce|mode|prompt.length (length, not content hash). */
export function buildAvatarMeshyIdempotencyKey(input: {
  readonly ownerUserId: string;
  readonly clientNonce: string;
  readonly generationMode: MeshyAvatarMode;
  readonly prompt: string;
}): string {
  return `${input.ownerUserId}|${input.clientNonce}|${input.generationMode}|${input.prompt.length}`;
}

export function describeAvatarMeshyIdempotencyLegacyDefect(): string {
  return 'replay key uses prompt length rather than content hash; equal-length changed input may collide';
}

export function describeAvatarMeshyStartOrderingLegacyDefect(): string {
  return 'start creates provider task before DB insert; concurrent starts may orphan a paid provider task';
}

export function describeAvatarMeshyConfigLegacyDefect(): string {
  return 'meshyConfigured can be true from an active credential row without proving successful decryption; image validation checks data-URI grammar and approx byte count, not decoded image magic';
}

export function normalizeAvatarMeshyPrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ');
}

export function validateAvatarMeshyNonce(
  nonce: unknown,
): MeshyAvatarPortsResult<string> {
  if (typeof nonce !== 'string') {
    return { ok: false, status: 400, error: 'clientNonce required', code: 'invalid_nonce' };
  }
  const trimmed = nonce.trim();
  if (trimmed.length < 1 || trimmed.length > MESHY_AVATAR_NONCE_MAX) {
    return { ok: false, status: 400, error: 'clientNonce length 1..80', code: 'invalid_nonce' };
  }
  return { ok: true, value: trimmed };
}

export function validateAvatarMeshyTextPrompt(
  prompt: unknown,
): MeshyAvatarPortsResult<string> {
  if (typeof prompt !== 'string') {
    return { ok: false, status: 400, error: 'prompt required', code: 'invalid_prompt' };
  }
  const normalized = normalizeAvatarMeshyPrompt(prompt);
  if (normalized.length < MESHY_AVATAR_PROMPT_MIN) {
    return { ok: false, status: 400, error: 'prompt too short', code: 'invalid_prompt' };
  }
  if (normalized.length > MESHY_AVATAR_PROMPT_MAX) {
    return { ok: false, status: 400, error: 'prompt too long', code: 'invalid_prompt' };
  }
  return { ok: true, value: normalized };
}

export function validateAvatarMeshyImageDataUri(
  dataUri: unknown,
): MeshyAvatarPortsResult<string> {
  if (typeof dataUri !== 'string') {
    return { ok: false, status: 400, error: 'imageDataUri required', code: 'invalid_image' };
  }
  const normalized = dataUri.trim();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(normalized);
  if (!match) {
    return { ok: false, status: 400, error: 'image must be png/jpeg/webp data-URI', code: 'invalid_image' };
  }
  const b64 = match[2]!.replace(/\s+/g, '');
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes <= 0) {
    return { ok: false, status: 400, error: 'image empty', code: 'invalid_image' };
  }
  if (approxBytes > MESHY_AVATAR_IMAGE_MAX_BYTES) {
    return { ok: false, status: 400, error: 'image too large', code: 'invalid_image' };
  }
  return {
    ok: true,
    value: `data:image/${match[1]!.toLowerCase()};base64,${b64}`,
  };
}

export function validateAvatarMeshySettings(
  raw: unknown,
): MeshyAvatarPortsResult<Record<string, unknown>> {
  if (raw === undefined || raw === null) {
    return {
      ok: true,
      value: {
        model: 'latest',
        geometry: 'high',
        texture: '4k',
        pose: 'a-pose',
        topology: 'triangle',
        outputFormat: 'glb',
      },
    };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'settings invalid', code: 'invalid_settings' };
  }
  const s = raw as Record<string, unknown>;
  const model = typeof s.model === 'string' ? s.model : typeof s.modelId === 'string' ? s.modelId : '';
  // Accept Edge short names and canonical Avatar3dGenerationSettings field names.
  const geometry =
    typeof s.geometry === 'string'
      ? s.geometry
      : typeof s.geometryQuality === 'string'
        ? s.geometryQuality
        : '';
  const texture =
    typeof s.texture === 'string'
      ? s.texture
      : typeof s.textureQuality === 'string'
        ? s.textureQuality
        : '';
  const pose =
    typeof s.pose === 'string' ? s.pose : typeof s.poseMode === 'string' ? s.poseMode : '';
  const topology =
    typeof s.topology === 'string'
      ? s.topology
      : typeof s.topologyMode === 'string'
        ? s.topologyMode
        : '';
  const outputFormat = typeof s.outputFormat === 'string' ? s.outputFormat : 'glb';
  if (!MESHY_MODELS.has(model) || !GEOMETRY.has(geometry) || !TEXTURE.has(texture)) {
    return { ok: false, status: 400, error: 'settings enums invalid', code: 'invalid_settings' };
  }
  if (!POSE.has(pose) || !TOPOLOGY.has(topology) || outputFormat !== 'glb') {
    return { ok: false, status: 400, error: 'settings enums invalid', code: 'invalid_settings' };
  }
  return { ok: true, value: { model, geometry, texture, pose, topology, outputFormat } };
}

export function validateAvatarMeshyProvider(
  providerId: unknown,
): MeshyAvatarPortsResult<'meshy'> {
  const id = typeof providerId === 'string' && providerId.trim() ? providerId.trim() : 'meshy';
  if (id !== 'meshy') {
    return { ok: false, status: 400, error: 'unsupported provider', code: 'unsupported_provider' };
  }
  return { ok: true, value: 'meshy' };
}

export function isAllowedAvatarMeshyGlbUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && parsed.hostname === 'localhost')) {
      return false;
    }
    if (!GLB_HOST_ALLOWLIST.has(parsed.hostname)) return false;
    return parsed.pathname.toLowerCase().endsWith('.glb');
  } catch {
    return false;
  }
}

/** Owner-scoped storage paths only: `{userId}/...`. */
export function assertAvatarMeshyStoragePathOwner(
  ownerUserId: string,
  storagePath: string,
): MeshyAvatarPortsResult<true> {
  const prefix = `${ownerUserId.trim()}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    return { ok: false, status: 403, error: 'storage path deny', code: 'storage_deny' };
  }
  return { ok: true, value: true };
}

export function consumeAvatarMeshyQuota(
  store: CharacterAvatarMeshyStore,
  userId: string,
  nowMs: number = Date.now(),
): MeshyAvatarPortsResult<true> {
  const existing = store.quota.get(userId);
  if (!existing || existing.resetAt <= nowMs) {
    store.quota.set(userId, {
      count: 1,
      resetAt: nowMs + MESHY_AVATAR_RATE_WINDOW_SECONDS * 1000,
    });
    return { ok: true, value: true };
  }
  if (existing.count >= MESHY_AVATAR_RATE_LIMIT) {
    return { ok: false, status: 429, error: 'rate limited', code: 'rate_limited' };
  }
  existing.count += 1;
  return { ok: true, value: true };
}

export function getAvatarMeshyConfig(store: CharacterAvatarMeshyStore): {
  readonly status: 'ok' | 'not-configured';
  readonly meshyConfigured: boolean;
  readonly promptMinChars: number;
  readonly promptMaxChars: number;
  readonly imageMaxBytes: number;
  readonly supportsImageTo3d: true;
  readonly defaultProviderId: 'meshy';
  readonly defaultPresetId: 'recommended';
  readonly wiredProviderIds: readonly ['meshy'];
  readonly message?: string;
} {
  if (!store.meshyConfigured) {
    return {
      status: 'not-configured',
      meshyConfigured: false,
      promptMinChars: MESHY_AVATAR_PROMPT_MIN,
      promptMaxChars: MESHY_AVATAR_PROMPT_MAX,
      imageMaxBytes: MESHY_AVATAR_IMAGE_MAX_BYTES,
      supportsImageTo3d: true,
      defaultProviderId: 'meshy',
      defaultPresetId: 'recommended',
      wiredProviderIds: ['meshy'],
      message: 'Meshy provider not configured',
    };
  }
  return {
    status: 'ok',
    meshyConfigured: true,
    promptMinChars: MESHY_AVATAR_PROMPT_MIN,
    promptMaxChars: MESHY_AVATAR_PROMPT_MAX,
    imageMaxBytes: MESHY_AVATAR_IMAGE_MAX_BYTES,
    supportsImageTo3d: true,
    defaultProviderId: 'meshy',
    defaultPresetId: 'recommended',
    wiredProviderIds: ['meshy'],
  };
}

export type StartAvatarMeshyInput = {
  readonly ownerUserId: string;
  readonly clientNonce: unknown;
  readonly generationMode?: unknown;
  readonly prompt?: unknown;
  readonly imageDataUri?: unknown;
  readonly texturePrompt?: unknown;
  readonly providerId?: unknown;
  readonly settings?: unknown;
  /** Injected provider create — returns null → provider_unavailable pseudo-job. */
  readonly createProviderTask?: () => string | null;
  readonly nowMs?: number;
};

export function startAvatarMeshyJob(
  store: CharacterAvatarMeshyStore,
  input: StartAvatarMeshyInput,
): MeshyAvatarPortsResult<MeshyAvatarJob | { readonly id: null; readonly status: 'provider_unavailable' }> {
  void CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED;
  const nonce = validateAvatarMeshyNonce(input.clientNonce);
  if (!nonce.ok) return nonce;
  const provider = validateAvatarMeshyProvider(input.providerId);
  if (!provider.ok) return provider;
  const settings = validateAvatarMeshySettings(input.settings);
  if (!settings.ok) return settings;

  const mode: MeshyAvatarMode =
    input.generationMode === 'image' ? 'image' : 'text';
  let prompt: string;
  if (mode === 'text') {
    const checked = validateAvatarMeshyTextPrompt(input.prompt);
    if (!checked.ok) return checked;
    prompt = checked.value;
  } else {
    const image = validateAvatarMeshyImageDataUri(input.imageDataUri);
    if (!image.ok) return image;
    if (typeof input.texturePrompt === 'string' && input.texturePrompt.trim()) {
      const textureNorm = normalizeAvatarMeshyPrompt(input.texturePrompt);
      if (textureNorm.length > MESHY_AVATAR_PROMPT_MAX) {
        return { ok: false, status: 400, error: 'texture prompt too long', code: 'invalid_prompt' };
      }
      prompt =
        textureNorm.length >= MESHY_AVATAR_PROMPT_MIN
          ? textureNorm
          : MESHY_AVATAR_IMAGE_PLACEHOLDER;
    } else {
      prompt = MESHY_AVATAR_IMAGE_PLACEHOLDER;
    }
  }

  if (!store.meshyConfigured) {
    return { ok: false, status: 200, error: 'not-configured', code: 'not_configured' };
  }

  const nowMs = input.nowMs ?? Date.now();
  const quota = consumeAvatarMeshyQuota(store, input.ownerUserId, nowMs);
  if (!quota.ok) return quota;

  const idempotencyKey = buildAvatarMeshyIdempotencyKey({
    ownerUserId: input.ownerUserId,
    clientNonce: nonce.value,
    generationMode: mode,
    prompt,
  });
  const existingId = store.byIdempotency.get(idempotencyKey);
  if (existingId) {
    const existing = store.jobs.get(existingId);
    if (existing && existing.ownerUserId === input.ownerUserId) {
      return { ok: true, value: existing, replayed: true };
    }
  }

  const create = input.createProviderTask ?? (() => `task-${store.nextId}`);
  const providerTaskId = create();
  if (providerTaskId === null) {
    return {
      ok: true,
      value: { id: null, status: 'provider_unavailable' },
    };
  }

  const id = `job-${store.nextId++}`;
  const job: MeshyAvatarJob = {
    id,
    ownerUserId: input.ownerUserId,
    clientNonce: nonce.value,
    generationMode: mode,
    prompt,
    idempotencyKey,
    status: 'generating',
    progress: 10,
    providerTaskId,
    remeshTaskId: null,
    remeshClaimedBy: null,
    storagePath: `${input.ownerUserId}/avatars/${id}.glb`,
    generationComplete: false,
  };
  store.jobs.set(id, job);
  store.byIdempotency.set(idempotencyKey, id);
  return { ok: true, value: job };
}

export function getAvatarMeshyJob(
  store: CharacterAvatarMeshyStore,
  ownerUserId: string,
  jobId: string,
): MeshyAvatarPortsResult<MeshyAvatarJob> {
  const job = store.jobs.get(jobId);
  if (!job || job.ownerUserId !== ownerUserId) {
    return { ok: false, status: 404, error: 'job not found', code: 'not_found' };
  }
  return { ok: true, value: job };
}

/**
 * Conditional remesh claim — only one concurrent poll wins the claim.
 * Returns true when this caller started remesh.
 */
/**
 * Mark provider generation complete (fixture / poll adapter before remesh).
 * Remesh claim requires this stage — never jump generating → remeshing.
 */
export function markAvatarMeshyGenerationComplete(
  store: CharacterAvatarMeshyStore,
  ownerUserId: string,
  jobId: string,
): MeshyAvatarPortsResult<MeshyAvatarJob> {
  const got = getAvatarMeshyJob(store, ownerUserId, jobId);
  if (!got.ok) return got;
  const job = got.value;
  if (job.status !== 'generating' && job.status !== 'queued') {
    return { ok: false, status: 400, error: 'not generating', code: 'invalid_state' };
  }
  job.status = 'generating';
  job.progress = Math.max(job.progress, 50);
  job.generationComplete = true;
  return { ok: true, value: job };
}

export function claimAvatarMeshyRemesh(
  store: CharacterAvatarMeshyStore,
  ownerUserId: string,
  jobId: string,
  claimerId: string,
): MeshyAvatarPortsResult<{ readonly claimed: boolean; readonly job: MeshyAvatarJob }> {
  const got = getAvatarMeshyJob(store, ownerUserId, jobId);
  if (!got.ok) return got;
  const job = got.value;
  if (
    !job.generationComplete ||
    job.status === 'failed' ||
    job.status === 'succeeded' ||
    job.status === 'provider_unavailable'
  ) {
    return { ok: true, value: { claimed: false, job } };
  }
  if (job.remeshClaimedBy && job.remeshClaimedBy !== claimerId) {
    return { ok: true, value: { claimed: false, job } };
  }
  if (!job.remeshClaimedBy) {
    job.remeshClaimedBy = claimerId;
    job.remeshTaskId = job.remeshTaskId ?? `remesh-${job.id}`;
    job.status = 'remeshing';
    job.progress = Math.max(job.progress, 60);
    return { ok: true, value: { claimed: true, job } };
  }
  return { ok: true, value: { claimed: false, job } };
}

export function retryAvatarMeshyJob(
  store: CharacterAvatarMeshyStore,
  ownerUserId: string,
  jobId: string,
): MeshyAvatarPortsResult<{ readonly job: MeshyAvatarJob; readonly resumedWithoutPaidCreate: boolean }> {
  const got = getAvatarMeshyJob(store, ownerUserId, jobId);
  if (!got.ok) return got;
  const job = got.value;
  if (job.status !== 'failed' && job.status !== 'provider_unavailable') {
    return { ok: false, status: 400, error: 'retry only failed/provider_unavailable', code: 'invalid_retry' };
  }
  if (job.providerTaskId) {
    job.status = 'generating';
    job.progress = Math.max(job.progress, 20);
    return { ok: true, value: { job, resumedWithoutPaidCreate: true } };
  }
  return { ok: false, status: 400, error: 'missing provider task', code: 'invalid_retry' };
}
