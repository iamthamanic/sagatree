/**
 * Item thumbnail image validation + SSRF-safe remote fetch (#140/#641).
 * Location: supabase/functions/_shared/item-thumbnail-image.ts
 */

export const ITEM_THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;
export const ITEM_THUMBNAIL_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ItemThumbnailMime = (typeof ITEM_THUMBNAIL_ALLOWED_MIME)[number];

const MESHY_HOST_ALLOWLIST = [
  'assets.meshy.ai',
  'cdn.meshy.ai',
  'meshy.ai',
  'api.meshy.ai',
];

export function isAllowedItemThumbnailMime(value: string): value is ItemThumbnailMime {
  return (ITEM_THUMBNAIL_ALLOWED_MIME as readonly string[]).includes(value);
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
  // RIFF....WEBP
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

export function extensionForItemThumbnailMime(mime: ItemThumbnailMime): 'png' | 'jpg' | 'webp' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function buildItemThumbnailStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
  mime: ItemThumbnailMime;
}): string {
  const ext = extensionForItemThumbnailMime(options.mime);
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.${ext}`;
  }
  return `${options.ownerUserId}/${options.definitionId}/${options.assetId}.${ext}`;
}

export function buildItemThumbnailAssetKey(assetId: string): string {
  return `thumbnail2d:${assetId}`;
}

export function decodeBase64Image(contentBase64: string): Uint8Array {
  const cleaned = contentBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
  if (!cleaned) throw new Error('Empty image payload');
  const binary = atob(cleaned);
  if (binary.length > ITEM_THUMBNAIL_MAX_BYTES) {
    throw new Error('Image exceeds 10 MB limit');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function validateThumbnailBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: ItemThumbnailMime; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty image');
  if (bytes.byteLength > ITEM_THUMBNAIL_MAX_BYTES) throw new Error('Image exceeds 10 MB limit');
  const sniffed = sniffItemThumbnailMime(bytes);
  if (!sniffed) throw new Error('Only PNG, JPEG and WebP images are allowed');
  if (claimedMime && claimedMime !== sniffed && !(claimedMime === 'image/jpg' && sniffed === 'image/jpeg')) {
    throw new Error('Declared MIME does not match file contents');
  }
  return { mime: sniffed, bytes };
}

function isAllowedMeshyHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return MESHY_HOST_ALLOWLIST.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

/**
 * Download a Meshy result URL with SSRF defenses: HTTPS only, host allowlist,
 * no redirects followed blindly (manual max 2), size + timeout limits.
 */
export async function downloadMeshyImageBytes(
  imageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ mime: ItemThumbnailMime; bytes: Uint8Array }> {
  let current = imageUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error('Invalid provider image URL');
    }
    if (parsed.protocol !== 'https:') throw new Error('Provider image URL must be HTTPS');
    if (!isAllowedMeshyHostname(parsed.hostname)) {
      throw new Error('Provider image host is not allowlisted');
    }

    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) throw new Error('Provider redirect without Location');
      current = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) throw new Error(`Provider image download failed (${response.status})`);

    const contentLength = Number(response.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > ITEM_THUMBNAIL_MAX_BYTES) {
      throw new Error('Provider image exceeds size limit');
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    return validateThumbnailBytes(buffer);
  }

  throw new Error('Too many redirects while downloading provider image');
}
