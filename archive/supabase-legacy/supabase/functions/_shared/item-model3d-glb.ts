/**
 * Item model3d GLB validation + SSRF-safe Meshy download (#141).
 * Location: supabase/functions/_shared/item-model3d-glb.ts
 */

export const ITEM_MODEL3D_MAX_BYTES = 50 * 1024 * 1024;
/**
 * Hard download ceiling for avatar Meshy GLBs (before remesh fallback).
 * Soft store target is lower — oversized assets are remeshed first.
 */
export const AVATAR_MESHY_GLB_MAX_BYTES = 200 * 1024 * 1024;
/** Prefer remesh when provider Content-Length exceeds this (web-friendly store). */
export const AVATAR_MESHY_GLB_SOFT_BYTES = 80 * 1024 * 1024;
/** Storage / runtime store ceiling for character-avatars (migration 034 = 150 MiB). */
export const AVATAR_MESHY_GLB_STORE_MAX_BYTES = 150 * 1024 * 1024;
export const ITEM_MODEL3D_MIME = 'model/gltf-binary' as const;
export type ItemModel3dMime = typeof ITEM_MODEL3D_MIME;

const MESHY_HOST_ALLOWLIST = [
  'assets.meshy.ai',
  'cdn.meshy.ai',
  'meshy.ai',
  'api.meshy.ai',
];

/** GLB magic: ASCII "glTF" at offset 0. */
export function sniffItemModel3dGlb(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}

export function buildItemModel3dStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
}): string {
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.glb`;
  }
  return `${options.ownerUserId}/${options.definitionId}/${options.assetId}.glb`;
}

export function buildItemModel3dAssetKey(assetId: string): string {
  return `model3d:${assetId}`;
}

export function decodeBase64Glb(contentBase64: string): Uint8Array {
  const cleaned = contentBase64
    .replace(/^data:model\/gltf-binary;base64,/, '')
    .replace(/^data:application\/octet-stream;base64,/, '')
    .trim();
  if (!cleaned) throw new Error('Empty GLB payload');
  const binary = atob(cleaned);
  if (binary.length > ITEM_MODEL3D_MAX_BYTES) {
    throw new Error('GLB exceeds 50 MB limit');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function validateGlbBytes(
  bytes: Uint8Array,
  claimedMime?: string,
  maxBytes: number = ITEM_MODEL3D_MAX_BYTES,
): { mime: ItemModel3dMime; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty GLB');
  if (bytes.byteLength > maxBytes) throw new Error('GLB exceeds size limit');
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

function isAllowedMeshyHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return MESHY_HOST_ALLOWLIST.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

/**
 * Download a Meshy GLB URL with SSRF defenses: HTTPS only, host allowlist,
 * no redirects followed blindly (manual max 2), size + timeout limits.
 */
export async function downloadMeshyGlbBytes(
  modelUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ mime: ItemModel3dMime; bytes: Uint8Array }> {
  const maxBytes = options.maxBytes ?? ITEM_MODEL3D_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let current = modelUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error('Invalid provider model URL');
    }
    if (parsed.protocol !== 'https:') throw new Error('Provider model URL must be HTTPS');
    if (!isAllowedMeshyHostname(parsed.hostname)) {
      throw new Error('Provider model host is not allowlisted');
    }

    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) throw new Error('Provider redirect without Location');
      current = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) throw new Error(`Provider model download failed (${response.status})`);

    const contentLength = Number(response.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error('Provider model exceeds size limit');
    }

    const buffer = await readResponseBodyWithByteCap(response, maxBytes);
    return validateGlbBytes(buffer, undefined, maxBytes);
  }

  throw new Error('Too many redirects while downloading provider model');
}

/** Stream body with a hard byte ceiling — does not trust Content-Length alone. */
export async function readResponseBodyWithByteCap(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) {
    const fallback = new Uint8Array(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error('Provider model exceeds size limit');
    }
    return fallback;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      throw new Error('Provider model exceeds size limit');
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Probe Content-Length for a Meshy GLB without downloading the body.
 * Returns null when unknown / not allowed — caller may fall back to GET.
 */
export async function probeMeshyGlbContentLength(
  modelUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number } = {},
): Promise<number | null> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  let current = modelUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' || !isAllowedMeshyHostname(parsed.hostname)) {
      return null;
    }
    const response = await fetchImpl(current, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) return null;
      current = new URL(location, parsed).toString();
      continue;
    }
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;
    return null;
  }
  return null;
}

/** Encode image bytes as a data URI for Meshy image_url input (#641: WebP allowed). */
export function imageBytesToDataUri(
  bytes: Uint8Array,
  mime: 'image/png' | 'image/jpeg' | 'image/webp',
): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
