/**
 * user-profile infrastructure barrel (#682 / MIG-312 dual-path).
 * Location: src/infrastructure/user-profile/index.ts
 */

export { userProfileService, prepareUserAvatarFile, type UploadUserAvatarOptions } from './user-profile-service';
export { supabaseUserProfileRepository } from './supabase-user-profile.repository';
export {
  createHostUserProfileAdapter,
  type HostUserProfileAdapter,
} from './host-user-profile-adapter';
export {
  HOST_USER_PROFILE_OPS,
  type HostUserProfileOp,
  type HostUserProfilePorts,
  type HostUserProfileResult,
  type HostUserProfileVm,
  type HostUploadUserAvatarInput,
} from './host-user-profile-ports.contract';
export {
  ACCOUNT_AVATAR_CHANGED_EVENT,
  notifyAccountAvatarChanged,
  subscribeAccountAvatarChanged,
  type AccountAvatarChangedDetail,
} from './account-avatar-changed';
export {
  clearAccountAvatarUrlCache,
  ensureAccountAvatarLoaded,
  getAccountAvatarLoadedUserId,
  getAccountAvatarUrlCache,
  publishAccountAvatarUrl,
  subscribeAccountAvatarUrl,
} from './account-avatar-store';
