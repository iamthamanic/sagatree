/**
 * Host characterization of Edge `item-thumbnail` (MIG-410 / #826).
 * Location: server/src/modules/inventory/internal/item-thumbnail.ts
 *
 * Allowlisted Edge worker remains live. Isolated authz/quota/image/action fixtures.
 * No public activation / cutover.
 */

export const ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
export const ITEM_THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;
export const ITEM_THUMBNAIL_HEADER_MAX_BYTES = 14 * 1024 * 1024;
export const ITEM_THUMBNAIL_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ItemThumbnailMime = (typeof ITEM_THUMBNAIL_ALLOWED_MIME)[number];
export const ITEM_THUMBNAIL_RATE_LIMIT = 4 as const;
export const ITEM_THUMBNAIL_RATE_WINDOW_SECONDS = 60 as const;
export const ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS = 604_800 as const;
export const ITEM_THUMBNAIL_ASSET_PREFIX = 'thumbnail2d:' as const;

const MESHY_HOST_ALLOWLIST = new Set([
  'assets.meshy.ai',
  'cdn.meshy.ai',
  'meshy.ai',
  'api.meshy.ai',
]);

export type ItemThumbnailDefinition = {
  id: string;
  scope: 'personal' | 'world';
  ownerUserId: string;
  worldProfileId: string | null;
  status: 'active' | 'archived';
  payload: {
    assetKey?: string;
    name?: string;
    description?: string;
  };
};

export type ItemThumbnailAsset = {
  id: string;
  ownerUserId: string;
  definitionId: string;
  storagePath: string;
  deletedAt: string | null;
  byteSize: number;
  mime: ItemThumbnailMime;
};

export type ItemThumbnailJob = {
  id: string;
  seq: number;
  ownerUserId: string;
  definitionId: string;
  status: 'waiting' | 'in_progress' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
  errorMessage?: string;
  assetId?: string;
  providerTaskId?: string;
  providerPollStatus?: 'succeeded' | 'failed' | 'in_progress' | 'canceled';
  providerImageUrl?: string;
  materializeClaimedBy?: string | null;
  paidCreateDone: boolean;
};

type QuotaEntry = { count: number; resetAt: number };

export type ItemThumbnailStore = {
  definitions: Map<string, ItemThumbnailDefinition>;
  worldOwners: Map<string, string>;
  assets: Map<string, ItemThumbnailAsset>;
  jobs: Map<string, ItemThumbnailJob>;
  quota: Map<string, QuotaEntry>;
  storageWrites: string[];
  providerCreates: number;
  meshyConfigured: boolean;
  persistentQuotaAvailable: boolean;
  nextId: number;
  readonly bodyLimitMode: 'header-only';
};

export function createItemThumbnailStore(meshyConfigured = true): ItemThumbnailStore {
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

export function checkItemThumbnailContentLengthHeader(
  contentLengthHeader: string | null,
): { ok: true } | { ok: false; status: 413; message: string } {
  const contentLength = Number.parseInt(contentLengthHeader || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > ITEM_THUMBNAIL_HEADER_MAX_BYTES) {
    return { ok: false, status: 413, message: 'Request body too large' };
  }
  return { ok: true };
}

/**
 * Strict base64 decode with Edge `atob` padding parity and O(n) validity.
 */
export function decodeStrictBase64Image(contentBase64: string): Uint8Array {
  const cleaned = contentBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
  if (!cleaned) throw new Error('Empty image payload');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 === 1) {
    throw new Error('Invalid base64 payload');
  }
  const padded = cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), '=');
  const padding = padded.endsWith('==') ? 2 : padded.endsWith('=') ? 1 : 0;
  const expectedBytes = (padded.length / 4) * 3 - padding;
  const buf = Buffer.from(padded, 'base64');
  if (buf.byteLength !== expectedBytes) {
    throw new Error('Invalid base64 payload');
  }
  return new Uint8Array(buf);
}

export function sniffItemThumbnailMime(bytes: Uint8Array): ItemThumbnailMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateItemThumbnailBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: ItemThumbnailMime; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty image');
  if (bytes.byteLength > ITEM_THUMBNAIL_MAX_BYTES) throw new Error('Image exceeds 10 MB limit');
  const sniffed = sniffItemThumbnailMime(bytes);
  if (!sniffed) throw new Error('Only PNG, JPEG and WebP images are allowed');
  if (claimedMime) {
    const normalized = claimedMime === 'image/jpg' ? 'image/jpeg' : claimedMime;
    if (normalized !== sniffed && claimedMime !== 'application/octet-stream') {
      throw new Error('Declared MIME does not match image contents');
    }
  }
  return { mime: sniffed, bytes };
}

export function isAllowedItemThumbnailMeshyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const allowed of MESHY_HOST_ALLOWLIST) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

export function buildItemThumbnailAssetKey(assetId: string): string {
  return `${ITEM_THUMBNAIL_ASSET_PREFIX}${assetId}`;
}

export function extensionForItemThumbnailMime(mime: ItemThumbnailMime): 'png' | 'jpg' | 'webp' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function buildItemThumbnailStoragePath(input: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
  mime: ItemThumbnailMime;
}): string {
  const ext = extensionForItemThumbnailMime(input.mime);
  if (input.worldProfileId) {
    return `${input.ownerUserId}/world/${input.worldProfileId}/${input.definitionId}/${input.assetId}.${ext}`;
  }
  return `${input.ownerUserId}/${input.definitionId}/${input.assetId}.${ext}`;
}

export function describeItemThumbnailLegacyDefects(): string[] {
  return [
    'Header-only body limit (Content-Length <= 14MiB); no independent decoded JSON byte bound.',
    'Paid provider create before jobs INSERT; no idempotency key / automatic paid retry.',
    'No status claim / idempotent materialization guarantee under concurrent polls (successor: first claimer).',
    'Several job PATCH / list statuses unchecked in Edge; response alone ≠ durable update.',
    'Image validator checks magic, size and MIME only.',
    'Provider task error_message may appear in job responses; no universal recursive secret redaction.',
  ];
}

function nextId(store: ItemThumbnailStore, prefix: string): string {
  const id = `${prefix}-${store.nextId}`;
  store.nextId += 1;
  return id;
}

export function seedItemThumbnailDefinition(
  store: ItemThumbnailStore,
  def: ItemThumbnailDefinition,
): void {
  store.definitions.set(def.id, def);
  if (def.worldProfileId && def.scope === 'world' && !store.worldOwners.has(def.worldProfileId)) {
    store.worldOwners.set(def.worldProfileId, def.ownerUserId);
  }
}

export function assertItemThumbnailDefinitionAuthorized(
  store: ItemThumbnailStore,
  userId: string,
  definitionId: string,
): ItemThumbnailDefinition {
  const def = store.definitions.get(definitionId);
  if (!def) throw new Error('NOT_FOUND');
  if (def.status === 'archived') {
    throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
  }
  if (def.scope === 'personal') {
    if (def.ownerUserId !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
    }
    return def;
  }
  const worldOwner = def.worldProfileId ? store.worldOwners.get(def.worldProfileId) : undefined;
  if (worldOwner !== userId) {
    throw Object.assign(new Error('FORBIDDEN'), { httpStatus: 403 });
  }
  return def;
}

export function consumeItemThumbnailQuota(
  store: ItemThumbnailStore,
  userId: string,
  nowMs = Date.now(),
): { ok: true } | { ok: false; status: 429 | 500; message: string; code?: string } {
  if (!store.persistentQuotaAvailable) {
    return { ok: false, status: 500, message: 'Rate limit store unavailable' };
  }
  const existing = store.quota.get(userId);
  if (!existing || existing.resetAt <= nowMs) {
    store.quota.set(userId, {
      count: 1,
      resetAt: nowMs + ITEM_THUMBNAIL_RATE_WINDOW_SECONDS * 1000,
    });
    return { ok: true };
  }
  if (existing.count >= ITEM_THUMBNAIL_RATE_LIMIT) {
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

export type ItemThumbnailResult =
  | { status: 'ok'; [key: string]: unknown }
  | { status: 'not-configured'; message: string; httpStatus: 503 }
  | { status: 'error'; message: string; code?: string; httpStatus: number };

function signedUrlFor(assetId: string): string {
  return `https://assets.meshy.ai/signed/${assetId}?ttl=${ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS}`;
}

function httpFromError(e: unknown): number {
  if (e instanceof Error && 'httpStatus' in e && typeof e.httpStatus === 'number') {
    return e.httpStatus;
  }
  if (e instanceof Error && e.message === 'NOT_FOUND') return 404;
  return 500;
}

export function itemThumbnailConfig(store: ItemThumbnailStore): ItemThumbnailResult {
  return {
    status: 'ok',
    meshyConfigured: store.meshyConfigured,
    maxBytes: ITEM_THUMBNAIL_MAX_BYTES,
    allowedMime: [...ITEM_THUMBNAIL_ALLOWED_MIME],
  };
}

export function normalizeItemThumbnailUserExtra(userExtra: unknown): string {
  if (userExtra === null || userExtra === undefined || userExtra === '') return '';
  if (typeof userExtra !== 'string') {
    throw Object.assign(new Error('userExtra must be a string'), { httpStatus: 400 });
  }
  return userExtra.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function itemThumbnailUpload(
  store: ItemThumbnailStore,
  userId: string,
  input: { definitionId: string; contentBase64: string; mime?: string },
): ItemThumbnailResult {
  try {
    if (typeof input.definitionId !== 'string' || !input.definitionId.trim()) {
      return { status: 'error', message: 'definitionId required', httpStatus: 400 };
    }
    if (typeof input.contentBase64 !== 'string' || !input.contentBase64.trim()) {
      return { status: 'error', message: 'contentBase64 required', httpStatus: 400 };
    }
    const def = assertItemThumbnailDefinitionAuthorized(store, userId, input.definitionId.trim());
    const bytes = decodeStrictBase64Image(input.contentBase64);
    const validated = validateItemThumbnailBytes(bytes, input.mime);
    const assetId = nextId(store, 'asset');
    const storagePath = buildItemThumbnailStoragePath({
      ownerUserId: userId,
      definitionId: def.id,
      worldProfileId: def.worldProfileId,
      assetId,
      mime: validated.mime,
    });
    store.storageWrites.push(storagePath);
    store.assets.set(assetId, {
      id: assetId,
      ownerUserId: userId,
      definitionId: def.id,
      storagePath,
      deletedAt: null,
      byteSize: validated.bytes.byteLength,
      mime: validated.mime,
    });
    def.payload.assetKey = buildItemThumbnailAssetKey(assetId);
    return {
      status: 'ok',
      assetId,
      assetKey: buildItemThumbnailAssetKey(assetId),
      signedUrl: signedUrlFor(assetId),
      mime: validated.mime,
      byteSize: validated.bytes.byteLength,
    };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'upload failed',
      httpStatus: httpFromError(e),
    };
  }
}

export function itemThumbnailGenerate(
  store: ItemThumbnailStore,
  userId: string,
  definitionId: string,
  userExtra?: unknown,
  nowMs = Date.now(),
): ItemThumbnailResult {
  if (!store.meshyConfigured) {
    return {
      status: 'not-configured',
      message: 'Meshy is not configured',
      httpStatus: 503,
    };
  }
  try {
    if (typeof definitionId !== 'string' || !definitionId.trim()) {
      return { status: 'error', message: 'definitionId required', httpStatus: 400 };
    }
    normalizeItemThumbnailUserExtra(userExtra);
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'generate failed',
      httpStatus: httpFromError(e),
    };
  }
  // Edge: quota after provider resolve, before definition/body — charge before authz here.
  const quota = consumeItemThumbnailQuota(store, userId, nowMs);
  if (!quota.ok) {
    return {
      status: 'error',
      message: quota.message,
      code: quota.code,
      httpStatus: quota.status,
    };
  }
  try {
    const def = assertItemThumbnailDefinitionAuthorized(store, userId, definitionId.trim());
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
      providerImageUrl: 'https://cdn.meshy.ai/images/ok.png',
      materializeClaimedBy: null,
    });
    return { status: 'ok', jobId, jobStatus: 'waiting', progress: 5 };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'generate failed',
      httpStatus: httpFromError(e),
    };
  }
}

export function itemThumbnailStatus(
  store: ItemThumbnailStore,
  userId: string,
  jobId: string,
  claimerId = 'poller',
): ItemThumbnailResult {
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
      const imageUrl = job.providerImageUrl || '';
      let hostOk = false;
      try {
        const parsed = new URL(imageUrl);
        hostOk =
          parsed.protocol === 'https:' && isAllowedItemThumbnailMeshyHost(parsed.hostname);
      } catch {
        hostOk = false;
      }
      if (!hostOk) {
        job.status = 'failed';
        job.errorMessage = 'Provider image host is not allowlisted';
      } else if (!job.materializeClaimedBy) {
        try {
          assertItemThumbnailDefinitionAuthorized(store, userId, job.definitionId);
        } catch {
          job.status = 'failed';
          job.errorMessage = 'Definition no longer mutable';
          return {
            status: 'ok',
            jobId: job.id,
            jobStatus: job.status,
            progress: job.progress,
            ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
          };
        }
        job.materializeClaimedBy = claimerId;
        job.status = 'succeeded';
        job.progress = 100;
        const assetId = nextId(store, 'asset');
        const def = store.definitions.get(job.definitionId);
        const mime: ItemThumbnailMime = 'image/png';
        const storagePath = buildItemThumbnailStoragePath({
          ownerUserId: userId,
          definitionId: job.definitionId,
          worldProfileId: def?.worldProfileId,
          assetId,
          mime,
        });
        store.assets.set(assetId, {
          id: assetId,
          ownerUserId: userId,
          definitionId: job.definitionId,
          storagePath,
          deletedAt: null,
          byteSize: 1024,
          mime,
        });
        job.assetId = assetId;
        if (def) def.payload.assetKey = buildItemThumbnailAssetKey(assetId);
      }
    }
  }
  return {
    status: 'ok',
    jobId: job.id,
    jobStatus: job.status,
    progress: job.progress,
    ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    ...(job.assetId
      ? {
          assetKey: buildItemThumbnailAssetKey(job.assetId),
          signedUrl: signedUrlFor(job.assetId),
        }
      : {}),
  };
}

export function itemThumbnailResolve(
  store: ItemThumbnailStore,
  userId: string,
  input: { assetKey?: string; assetId?: string },
): ItemThumbnailResult {
  let assetId = '';
  if (typeof input.assetKey === 'string' && input.assetKey.startsWith(ITEM_THUMBNAIL_ASSET_PREFIX)) {
    assetId = input.assetKey.slice(ITEM_THUMBNAIL_ASSET_PREFIX.length).trim();
  } else if (typeof input.assetId === 'string') {
    assetId = input.assetId.trim();
  }
  if (!assetId) {
    return { status: 'error', message: 'assetKey or assetId required', httpStatus: 400 };
  }
  const asset = store.assets.get(assetId);
  if (!asset || asset.deletedAt) {
    return { status: 'error', message: 'Not found', httpStatus: 404 };
  }
  if (asset.ownerUserId === userId) {
    return {
      status: 'ok',
      assetKey: buildItemThumbnailAssetKey(assetId),
      signedUrl: signedUrlFor(assetId),
    };
  }
  for (const def of store.definitions.values()) {
    if (
      def.payload.assetKey === buildItemThumbnailAssetKey(assetId) &&
      def.worldProfileId &&
      store.worldOwners.get(def.worldProfileId) === userId
    ) {
      return {
        status: 'ok',
        assetKey: buildItemThumbnailAssetKey(assetId),
        signedUrl: signedUrlFor(assetId),
      };
    }
  }
  return { status: 'error', message: 'Forbidden', httpStatus: 403 };
}

export function itemThumbnailRemove(
  store: ItemThumbnailStore,
  userId: string,
  definitionId: string,
): ItemThumbnailResult {
  try {
    const def = assertItemThumbnailDefinitionAuthorized(store, userId, definitionId.trim());
    const key = def.payload.assetKey;
    def.payload.assetKey = undefined;
    if (key?.startsWith(ITEM_THUMBNAIL_ASSET_PREFIX)) {
      const assetId = key.slice(ITEM_THUMBNAIL_ASSET_PREFIX.length);
      const asset = store.assets.get(assetId);
      if (asset && asset.ownerUserId === userId) {
        asset.deletedAt = new Date().toISOString();
      }
    }
    return { status: 'ok', removed: true };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'remove failed',
      httpStatus: httpFromError(e),
    };
  }
}

export function itemThumbnailLatestJob(
  store: ItemThumbnailStore,
  userId: string,
  definitionId: string,
): ItemThumbnailResult {
  try {
    assertItemThumbnailDefinitionAuthorized(store, userId, definitionId.trim());
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'latest failed',
      httpStatus: httpFromError(e),
    };
  }
  let latest: ItemThumbnailJob | null = null;
  for (const job of store.jobs.values()) {
    if (job.ownerUserId === userId && job.definitionId === definitionId.trim()) {
      if (!latest || job.seq > latest.seq) latest = job;
    }
  }
  if (!latest) return { status: 'ok', job: null };
  return {
    status: 'ok',
    job: {
      jobId: latest.id,
      jobStatus: latest.status,
      progress: latest.progress,
      ...(latest.errorMessage ? { errorMessage: latest.errorMessage } : {}),
      ...(latest.assetId ? { assetKey: buildItemThumbnailAssetKey(latest.assetId) } : {}),
    },
  };
}

export function stripItemThumbnailSecrets(
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
