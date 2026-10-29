/**
 * User-avatar MIME sniff + size limits (MIG-312 / #811).
 * Location: server/src/modules/user-profile/internal/user-avatar-mime.ts
 * Parity with src/infrastructure/user-profile/supabase-user-profile.repository.ts
 */

export const USER_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
/** 7 days — refreshed on each batch/profile load for lobby stability. */
export const USER_AVATAR_SIGNED_SECONDS = 60 * 60 * 24 * 7;

export const USER_AVATAR_MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

export type UserAvatarMime = keyof typeof USER_AVATAR_MIME_EXTENSIONS;

export function sniffUserAvatarMime(bytes: Uint8Array): UserAvatarMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
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

export function assertOwnerScopedAvatarPath(storagePath: string, ownerUserId: string): string {
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
