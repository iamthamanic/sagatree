/**
 * Host characterization of Edge `item-model3d` (MIG-409 / #825).
 * Location: server/src/modules/inventory/internal/item-model3d.ts
 *
 * Allowlisted Edge worker remains live. Isolated authz/quota/GLB/action fixtures.
 * No public activation / cutover.
 */

export const ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
export const ITEM_MODEL3D_MAX_BYTES = 50 * 1024 * 1024;
export const ITEM_MODEL3D_HEADER_MAX_BYTES = 70 * 1024 * 1024;
export const ITEM_MODEL3D_MIME = 'model/gltf-binary' as const;
export const ITEM_MODEL3D_RATE_LIMIT = 2 as const;
export const ITEM_MODEL3D_RATE_WINDOW_SECONDS = 60 as const;
export const ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS = 604_800 as const;
export const ITEM_MODEL3D_THUMBNAIL_PREFIX = 'thumbnail2d:' as const;

const MESHY_HOST_ALLOWLIST = new Set([
  'assets.meshy.ai',
  'cdn.meshy.ai',
  'meshy.ai',
  'api.meshy.ai',
]);

export type ItemModel3dDefinition = {
  id: string;
  scope: 'personal' | 'world';
  ownerUserId: string;
  worldProfileId: string | null;
  status: 'active' | 'archived';
  payload: {
    model3d?: string;
    assetKey?: string;
  };
};

export type ItemModel3dAsset = {
  id: string;
  ownerUserId: string;
  definitionId: string;
  storagePath: string;
  deletedAt: string | null;
  byteSize: number;
};

export type ItemModel3dJob = {
  id: string;
  seq: number;
  ownerUserId: string;
  definitionId: string;
  status: 'waiting' | 'in_progress' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
  errorMessage?: string;
  assetId?: string;
  providerTaskId?: string;
  /** Isolated provider poll result: succeeded | failed | in_progress */
  providerPollStatus?: 'succeeded' | 'failed' | 'in_progress' | 'canceled';
  providerModelUrl?: string;
  materializeClaimedBy?: string | null;
  paidCreateDone: boolean;
};

type QuotaEntry = { count: number; resetAt: number };

export type ItemModel3dStore = {
  definitions: Map<string, ItemModel3dDefinition>;
  worldOwners: Map<string, string>;
  assets: Map<string, ItemModel3dAsset>;
  jobs: Map<string, ItemModel3dJob>;
  quota: Map<string, QuotaEntry>;
  storageWrites: string[];
  providerCreates: number;
  meshyConfigured: boolean;
  persistentQuotaAvailable: boolean;
  nextId: number;
  /** Legacy: Content-Length envelope only (no decoded JSON byte bound). */
  readonly bodyLimitMode: 'header-only';
};

export function createItemModel3dStore(meshyConfigured = true): ItemModel3dStore {
  return {
    definitions: new Map(),
    worldOwners: new Map(),
    assets: new Map(),
    jobs: new Map(),
    quota: new Map(),
    storageWrites: [],
    providerCreates: 0,
    meshyConfigured,
    persistentQuotaAvailable: true,
    nextId: 1,
    bodyLimitMode: 'header-only',
  };
}

export function checkItemModel3dContentLengthHeader(
  contentLengthHeader: string | null,
): { ok: true } | { ok: false; status: 413; message: string } {
  const contentLength = Number.parseInt(contentLengthHeader || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > ITEM_MODEL3D_HEADER_MAX_BYTES) {
    return { ok: false, status: 413, message: 'Request body too large' };
  }
  return { ok: true };
}

export function decodeStrictBase64(contentBase64: string): Uint8Array {
  const cleaned = contentBase64
    .replace(/^data:model\/gltf-binary;base64,/, '')
    .replace(/^data:application\/octet-stream;base64,/, '')
    .trim();
  if (!cleaned) throw new Error('Empty GLB payload');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new Error('Invalid base64 payload');
  }
  const buf = Buffer.from(cleaned, 'base64');
  // Round-trip: reject silent ignore of invalid chars
  if (buf.toString('base64').replace(/=+$/, '') !== cleaned.replace(/=+$/, '')) {
    throw new Error('Invalid base64 payload');
  }
  return new Uint8Array(buf);
}

export function sniffItemModel3dGlb(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}

/** Legacy: magic + size + MIME only — no version/chunk structure. */
export function validateItemModel3dGlbBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: typeof ITEM_MODEL3D_MIME; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty GLB');
  if (bytes.byteLength > ITEM_MODEL3D_MAX_BYTES) throw new Error('GLB exceeds size limit');
  if (!sniffItemModel3dGlb(bytes)) throw new Error('Only GLB (glTF binary) files are allowed');
  if (
    claimedMime &&
    claimedMime !== ITEM_MODEL3D_MIME &&
    claimedMime !== 'application/octet-stream'
  ) {
    throw new Error('Declared MIME does not match GLB contents');
  }
  return { mime: ITEM_MODEL3D_MIME, bytes };
}

export function isAllowedItemModel3dMeshyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const allowed of MESHY_HOST_ALLOWLIST) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

export function buildItemModel3dAssetKey(assetId: string): string {
  return `model3d:${assetId}`;
}

export function buildItemModel3dStoragePath(input: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
}): string {
  if (input.worldProfileId) {
    return `${input.ownerUserId}/world/${input.worldProfileId}/${input.definitionId}/${input.assetId}.glb`;
  }
  return `${input.ownerUserId}/${input.definitionId}/${input.assetId}.glb`;
}

export function describeItemModel3dLegacyDefects(): string[] {
  return [
    'Header-only body limit (Content-Length <= 70MiB); no independent decoded JSON byte bound.',
    'Paid provider create before jobs INSERT; no idempotency key / automatic paid retry.',
    'No status claim / idempotent materialization guarantee under concurrent polls.',
    'Several job PATCH / list statuses unchecked in Edge; response alone ≠ durable update.',
    'GLB validator checks magic, size and MIME only — not version/declared length/chunks.',
    'Provider task error_message may appear in job responses; no universal recursive secret redaction.',
  ];
}

function nextId(store: ItemModel3dStore, prefix: string): string {
  const id = `${prefix}-${store.nextId}`;
  store.nextId += 1;
  return id;
}

export function seedItemModel3dDefinition(
  store: ItemModel3dStore,
  def: ItemModel3dDefinition,
): void {
  store.definitions.set(def.id, def);
  if (def.worldProfileId && def.scope === 'world') {
    // worldOwners maps profile → owner for world-scope authz
    if (!store.worldOwners.has(def.worldProfileId)) {
      store.worldOwners.set(def.worldProfileId, def.ownerUserId);
    }
  }
}

export function assertDefinitionAuthorized(
  store: ItemModel3dStore,
  userId: string,
  definitionId: string,
): ItemModel3dDefinition {
  const def = store.definitions.get(definitionId);
  if (!def) {
    const err = new Error('NOT_FOUND');
    throw err;
  }
  if (def.status === 'archived') {
    throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
  }
  if (def.scope === 'personal') {
    if (def.ownerUserId !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
    }
    return def;
  }
  // world scope: world_profiles.owner_user_id === caller (GM/membership insufficient)
  const worldOwner = def.worldProfileId
    ? store.worldOwners.get(def.worldProfileId)
    : undefined;
  if (worldOwner !== userId) {
    throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
  }
  return def;
}

export function consumeItemModel3dQuota(
  store: ItemModel3dStore,
  userId: string,
  nowMs = Date.now(),
): { ok: true } | { ok: false; status: 429 | 500; message: string; code?: string } {
  if (!store.persistentQuotaAvailable) {
    return {
      ok: false,
      status: 500,
      message: 'Rate limit store unavailable',
    };
  }
  const existing = store.quota.get(userId);
  if (!existing || existing.resetAt <= nowMs) {
    store.quota.set(userId, {
      count: 1,
      resetAt: nowMs + ITEM_MODEL3D_RATE_WINDOW_SECONDS * 1000,
    });
    return { ok: true };
  }
  if (existing.count >= ITEM_MODEL3D_RATE_LIMIT) {
    return {
      ok: false,
      status: 429,
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT',
    };
  }
  existing.count += 1;
  return { ok: true };
}

export type ItemModel3dResult =
  | { status: 'ok'; [key: string]: unknown }
  | { status: 'not-configured'; message: string; httpStatus: 503 }
  | { status: 'error'; message: string; code?: string; httpStatus: number };

function signedUrlFor(assetId: string): string {
  return `https://assets.meshy.ai/signed/${assetId}?ttl=${ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS}`;
}

export function itemModel3dConfig(store: ItemModel3dStore): ItemModel3dResult {
  return {
    status: 'ok',
    meshyConfigured: store.meshyConfigured,
    maxBytes: ITEM_MODEL3D_MAX_BYTES,
    allowedMime: [ITEM_MODEL3D_MIME],
  };
}

export function itemModel3dUpload(
  store: ItemModel3dStore,
  userId: string,
  input: { definitionId: string; contentBase64: string; mime?: string },
): ItemModel3dResult {
  try {
    if (typeof input.definitionId !== 'string' || !input.definitionId.trim()) {
      return { status: 'error', message: 'definitionId required', httpStatus: 400 };
    }
    if (typeof input.contentBase64 !== 'string' || !input.contentBase64.trim()) {
      return { status: 'error', message: 'contentBase64 required', httpStatus: 400 };
    }
    const def = assertDefinitionAuthorized(store, userId, input.definitionId.trim());
    const bytes = decodeStrictBase64(input.contentBase64);
    const validated = validateItemModel3dGlbBytes(bytes, input.mime);
    const assetId = nextId(store, 'asset');
    const storagePath = buildItemModel3dStoragePath({
      ownerUserId: userId,
      definitionId: def.id,
      worldProfileId: def.worldProfileId,
      assetId,
    });
    store.storageWrites.push(storagePath);
    store.assets.set(assetId, {
      id: assetId,
      ownerUserId: userId,
      definitionId: def.id,
      storagePath,
      deletedAt: null,
      byteSize: validated.bytes.byteLength,
    });
    def.payload.model3d = buildItemModel3dAssetKey(assetId);
    return {
      status: 'ok',
      assetId,
      model3d: buildItemModel3dAssetKey(assetId),
      signedUrl: signedUrlFor(assetId),
      mime: validated.mime,
      byteSize: validated.bytes.byteLength,
    };
  } catch (e) {
    const httpStatus =
      e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number'
        ? e.httpStatus
        : e instanceof Error && e.message === 'NOT_FOUND'
          ? 404
          : 500;
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'upload failed',
      httpStatus,
    };
  }
}

export function itemModel3dGenerate(
  store: ItemModel3dStore,
  userId: string,
  definitionId: string,
  nowMs = Date.now(),
): ItemModel3dResult {
  if (!store.meshyConfigured) {
    return {
      status: 'not-configured',
      message: 'Meshy is not configured',
      httpStatus: 503,
    };
  }
  const quota = consumeItemModel3dQuota(store, userId, nowMs);
  if (!quota.ok) {
    return {
      status: 'error',
      message: quota.message,
      code: quota.code,
      httpStatus: quota.status,
    };
  }
  try {
    const def = assertDefinitionAuthorized(store, userId, definitionId.trim());
    const assetKey = def.payload.assetKey;
    const thumbId =
      typeof assetKey === 'string' && assetKey.startsWith(ITEM_MODEL3D_THUMBNAIL_PREFIX)
        ? assetKey.slice(ITEM_MODEL3D_THUMBNAIL_PREFIX.length).trim()
        : '';
    if (!thumbId) {
      return {
        status: 'error',
        message: 'Thumbnail required',
        code: 'THUMBNAIL_REQUIRED',
        httpStatus: 400,
      };
    }
    // Legacy: paid create before jobs INSERT.
    store.providerCreates += 1;
    const jobId = nextId(store, 'job');
    const seq = store.nextId;
    store.jobs.set(jobId, {
      id: jobId,
      seq,
      ownerUserId: userId,
      definitionId: def.id,
      status: 'waiting',
      progress: 5,
      paidCreateDone: true,
      providerTaskId: `meshy-${jobId}`,
      providerPollStatus: 'succeeded',
      providerModelUrl: 'https://cdn.meshy.ai/models/ok.glb',
      materializeClaimedBy: null,
    });
    return { status: 'ok', jobId, jobStatus: 'waiting', progress: 5 };
  } catch (e) {
    const httpStatus =
      e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number'
        ? e.httpStatus
        : e instanceof Error && e.message === 'NOT_FOUND'
          ? 404
          : 500;
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'generate failed',
      httpStatus,
    };
  }
}

/**
 * Successor decision (Fall 4): first concurrent status caller claims materialization;
 * others observe claimed state without a second paid create.
 */
export function itemModel3dStatus(
  store: ItemModel3dStore,
  userId: string,
  jobId: string,
  claimerId = 'poller',
): ItemModel3dResult {
  if (typeof jobId !== 'string' || !jobId.trim()) {
    return { status: 'error', message: 'jobId required', httpStatus: 400 };
  }
  const job = store.jobs.get(jobId.trim());
  if (!job || job.ownerUserId !== userId) {
    return { status: 'error', message: 'Not found', httpStatus: 404 };
  }
  if (job.status === 'waiting' || job.status === 'in_progress') {
    const poll = job.providerPollStatus ?? 'in_progress';
    if (poll === 'in_progress') {
      job.status = 'in_progress';
      job.progress = Math.max(job.progress, 10);
    } else if (poll === 'failed' || poll === 'canceled') {
      job.status = poll;
      job.progress = job.progress || 0;
      job.errorMessage = job.errorMessage || 'provider terminal failure';
    } else if (poll === 'succeeded') {
      const modelUrl = job.providerModelUrl || '';
      let hostOk = false;
      try {
        const parsed = new URL(modelUrl);
        hostOk =
          parsed.protocol === 'https:' && isAllowedItemModel3dMeshyHost(parsed.hostname);
      } catch {
        hostOk = false;
      }
      if (!hostOk) {
        job.status = 'failed';
        job.errorMessage = 'Provider model host is not allowlisted';
      } else if (!job.materializeClaimedBy) {
        try {
          assertDefinitionAuthorized(store, userId, job.definitionId);
        } catch {
          job.status = 'failed';
          job.errorMessage = 'Definition no longer mutable';
          // do not create asset
          const outEarly: Record<string, unknown> = {
            status: 'ok',
            jobId: job.id,
            jobStatus: job.status,
            progress: job.progress,
          };
          if (job.errorMessage) outEarly.errorMessage = job.errorMessage;
          return outEarly as ItemModel3dResult;
        }
        job.materializeClaimedBy = claimerId;
        job.status = 'succeeded';
        job.progress = 100;
        const assetId = nextId(store, 'asset');
        const def = store.definitions.get(job.definitionId);
        const storagePath = buildItemModel3dStoragePath({
          ownerUserId: userId,
          definitionId: job.definitionId,
          worldProfileId: def?.worldProfileId,
          assetId,
        });
        store.assets.set(assetId, {
          id: assetId,
          ownerUserId: userId,
          definitionId: job.definitionId,
          storagePath,
          deletedAt: null,
          byteSize: 1024,
        });
        job.assetId = assetId;
        if (def) def.payload.model3d = buildItemModel3dAssetKey(assetId);
      }
    }
  }
  const out: Record<string, unknown> = {
    status: 'ok',
    jobId: job.id,
    jobStatus: job.status,
    progress: job.progress,
  };
  if (job.errorMessage) out.errorMessage = job.errorMessage;
  if (job.assetId) {
    out.model3d = buildItemModel3dAssetKey(job.assetId);
    out.signedUrl = signedUrlFor(job.assetId);
  }
  return out as ItemModel3dResult;
}

export function itemModel3dResolve(
  store: ItemModel3dStore,
  userId: string,
  input: { model3d?: string; assetId?: string },
): ItemModel3dResult {
  let assetId = '';
  if (typeof input.model3d === 'string' && input.model3d.startsWith('model3d:')) {
    assetId = input.model3d.slice('model3d:'.length).trim();
  } else if (typeof input.assetId === 'string') {
    assetId = input.assetId.trim();
  }
  if (!assetId) {
    return { status: 'error', message: 'model3d or assetId required', httpStatus: 400 };
  }
  const asset = store.assets.get(assetId);
  if (!asset || asset.deletedAt) {
    return { status: 'error', message: 'Not found', httpStatus: 404 };
  }
  if (asset.ownerUserId === userId) {
    return {
      status: 'ok',
      model3d: buildItemModel3dAssetKey(assetId),
      signedUrl: signedUrlFor(assetId),
    };
  }
  // World-profile owner of a definition that references this asset may resolve.
  for (const def of store.definitions.values()) {
    if (
      def.payload.model3d === buildItemModel3dAssetKey(assetId) &&
      def.worldProfileId &&
      store.worldOwners.get(def.worldProfileId) === userId
    ) {
      return {
        status: 'ok',
        model3d: buildItemModel3dAssetKey(assetId),
        signedUrl: signedUrlFor(assetId),
      };
    }
  }
  return { status: 'error', message: 'Forbidden', httpStatus: 403 };
}

export function itemModel3dRemove(
  store: ItemModel3dStore,
  userId: string,
  definitionId: string,
): ItemModel3dResult {
  try {
    const def = assertDefinitionAuthorized(store, userId, definitionId.trim());
    const key = def.payload.model3d;
    def.payload.model3d = undefined;
    if (key?.startsWith('model3d:')) {
      const assetId = key.slice('model3d:'.length);
      const asset = store.assets.get(assetId);
      if (asset && asset.ownerUserId === userId) {
        asset.deletedAt = new Date().toISOString();
      }
      // World owner may clear pointer without deleting other-owner physical asset.
    }
    return { status: 'ok', removed: true };
  } catch (e) {
    const httpStatus =
      e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number'
        ? e.httpStatus
        : e instanceof Error && e.message === 'NOT_FOUND'
          ? 404
          : 500;
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'remove failed',
      httpStatus,
    };
  }
}

export function itemModel3dLatestJob(
  store: ItemModel3dStore,
  userId: string,
  definitionId: string,
): ItemModel3dResult {
  try {
    assertDefinitionAuthorized(store, userId, definitionId.trim());
  } catch (e) {
    const httpStatus =
      e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number'
        ? e.httpStatus
        : e instanceof Error && e.message === 'NOT_FOUND'
          ? 404
          : 500;
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'latest failed',
      httpStatus,
    };
  }
  let latest: ItemModel3dJob | null = null;
  for (const job of store.jobs.values()) {
    if (job.ownerUserId === userId && job.definitionId === definitionId.trim()) {
      if (!latest || job.seq > latest.seq) latest = job;
    }
  }
  if (!latest) return { status: 'ok', job: null };
  const job: Record<string, unknown> = {
    jobId: latest.id,
    jobStatus: latest.status,
    progress: latest.progress,
  };
  if (latest.errorMessage) job.errorMessage = latest.errorMessage;
  if (latest.assetId) job.model3d = buildItemModel3dAssetKey(latest.assetId);
  return { status: 'ok', job };
}

export function stripItemModel3dSecrets(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe = { ...payload };
  delete safe.apiKey;
  delete safe.authorization;
  delete safe.MESHY_API_KEY;
  delete safe.providerSecret;
  delete safe.serviceRoleKey;
  return safe;
}
