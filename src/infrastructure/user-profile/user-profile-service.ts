/**
 * User profile service — optimize + upload account avatars (#682).
 * Location: src/infrastructure/user-profile/user-profile-service.ts
 *
 * Dual-path (FE-HOST-08): Host HTTP when `VITE_SAGATREE_HOST_LIBRARY=1`.
 * Host ports also via `createHostUserProfileAdapter` for tests.
 */
import type { UserProfileVm } from '../../domains/user-profile';
import { supabaseUserProfileRepository } from './supabase-user-profile.repository';
import {
  fetchHostOwnUserProfile,
  fetchHostProfilesByUserIds,
  isHostLibraryEnabled,
  uploadHostUserAvatar,
} from '../host/host-catalog-http';

export type UploadUserAvatarOptions = {
  /**
   * When true, skip client optimize (caller already ran user-avatar intake).
   * Storage MIME/magic-byte/owner checks still run in the repository.
   */
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

/**
 * Run the user-avatar media optimizer. Never returns the original after a
 * required optimize failure (no silent fallback upload).
 */
export async function prepareUserAvatarFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'user-avatar',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Avatar-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'avatar';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Avatar-Optimierung abgebrochen.');
  }

  throw new Error(
    result.message || `Avatar-Optimierung fehlgeschlagen (${result.status}).`,
  );
}

export const userProfileService = {
  async getOwnProfile(): Promise<UserProfileVm | null> {
    if (isHostLibraryEnabled()) {
      return fetchHostOwnUserProfile();
    }
    return supabaseUserProfileRepository.getOwnProfile();
  },

  async getProfilesByUserIds(userIds: readonly string[]): Promise<UserProfileVm[]> {
    if (isHostLibraryEnabled()) {
      return fetchHostProfilesByUserIds(userIds);
    }
    return supabaseUserProfileRepository.getProfilesByUserIds(userIds);
  },

  async uploadAvatar(file: File, options?: UploadUserAvatarOptions): Promise<UserProfileVm> {
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareUserAvatarFile(file, options?.signal);
    if (isHostLibraryEnabled()) {
      return uploadHostUserAvatar(prepared);
    }
    return supabaseUserProfileRepository.uploadAvatar(prepared);
  },

  prepareAvatarFile: prepareUserAvatarFile,
};
