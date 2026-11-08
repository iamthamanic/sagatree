/**
 * Look reference image mime sniff + size limits (#352).
 * Location: supabase/functions/_shared/look-reference-analysis-image.ts
 */

export const LOOK_REF_ANALYSIS_MAX_BYTES = 8 * 1024 * 1024;
export const LOOK_REF_ANALYSIS_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type LookRefAnalysisMime = (typeof LOOK_REF_ANALYSIS_ALLOWED_MIME)[number];

export function isAllowedLookRefAnalysisMime(
  value: string,
): value is LookRefAnalysisMime {
  return (LOOK_REF_ANALYSIS_ALLOWED_MIME as readonly string[]).includes(value);
}

export function sniffLookRefAnalysisMime(
  bytes: Uint8Array,
): LookRefAnalysisMime | null {
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

export function decodeLookRefBase64Image(contentBase64: string): Uint8Array {
  const cleaned = contentBase64
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .trim();
  if (!cleaned) throw new Error('Empty image payload');
  const binary = atob(cleaned);
  if (binary.length > LOOK_REF_ANALYSIS_MAX_BYTES) {
    throw new Error('Image exceeds 8 MB limit');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function validateLookRefImageBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: LookRefAnalysisMime; bytes: Uint8Array } {
  if (bytes.length === 0 || bytes.length > LOOK_REF_ANALYSIS_MAX_BYTES) {
    throw new Error('Image size out of range');
  }
  const sniffed = sniffLookRefAnalysisMime(bytes);
  if (!sniffed) throw new Error('Unsupported image format');
  if (claimedMime && claimedMime !== sniffed) {
    throw new Error('Claimed mime does not match image bytes');
  }
  return { mime: sniffed, bytes };
}

/** Owner-scoped storage paths: `{userId}/...` — reject traversal. */
export function assertOwnerScopedStoragePath(
  storagePath: string,
  ownerUserId: string,
): string {
  const trimmed = storagePath.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\')) {
    throw new Error('Invalid storage path');
  }
  const prefix = `${ownerUserId}/`;
  if (!trimmed.startsWith(prefix)) {
    throw new Error('Storage path is not owner-scoped');
  }
  return trimmed;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
