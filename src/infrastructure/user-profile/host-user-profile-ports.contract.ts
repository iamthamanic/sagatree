/**
 * Host-aligned user-profile ports contract (MIG-312 / #811).
 * Location: src/infrastructure/user-profile/host-user-profile-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/user-profile` ports
 * (table user_profiles + storage user-avatars; 0 RPCs). Supabase facades
 * remain live until cutover; this documents the host shape for parity checks
 * without importing the Node host package.
 */

export type HostUserProfileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly code?: string };

export type HostUserProfileVm = {
  readonly id: string;
  readonly displayName: string | null;
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly updatedAt: string | null;
};

export type HostUploadUserAvatarInput = {
  readonly bytes: Uint8Array;
  readonly contentType?: string;
  /** Never trusted — foreign claim → DENY on host. */
  readonly claimedOwnerUserId?: string;
};

/**
 * Actor id is the verified host actor — never a client-claimed owner.
 * Ports mirror host createUserProfilePorts surface (no HTTP in this slice).
 */
export type HostUserProfilePorts = {
  readonly ensureOwnProfileRow: (
    actorId: string,
  ) => Promise<HostUserProfileResult<void>>;
  readonly getOwnProfile: (
    actorId: string,
  ) => Promise<HostUserProfileResult<HostUserProfileVm | null>>;
  readonly getProfilesByUserIds: (
    actorId: string,
    userIds: readonly string[],
  ) => Promise<HostUserProfileResult<readonly HostUserProfileVm[]>>;
  readonly uploadAvatar: (
    actorId: string,
    input: HostUploadUserAvatarInput,
  ) => Promise<HostUserProfileResult<HostUserProfileVm>>;
};

/** Stable operation names for composition / future HTTP cutover documentation. */
export const HOST_USER_PROFILE_OPS = [
  'ensureOwnProfileRow',
  'getOwnProfile',
  'getProfilesByUserIds',
  'uploadAvatar',
] as const;

export type HostUserProfileOp = (typeof HOST_USER_PROFILE_OPS)[number];
