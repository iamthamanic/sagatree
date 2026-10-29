/**
 * host-user-profile-adapter — Binds infra HostUserProfilePorts to an injected host impl (MIG-312).
 * Location: src/infrastructure/user-profile/host-user-profile-adapter.ts
 *
 * Production UI still calls Supabase user-profile facades. This adapter is the
 * typed dual-path seam: tests and future host transport inject HostUserProfilePorts.
 * No server/ imports; no client role elevation.
 */
import type { HostUserProfilePorts } from './host-user-profile-ports.contract';
import { HOST_USER_PROFILE_OPS } from './host-user-profile-ports.contract';

export type HostUserProfileAdapter = HostUserProfilePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_USER_PROFILE_OPS;
};

/**
 * Wrap an injected HostUserProfilePorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostUserProfileAdapter(
  ports: HostUserProfilePorts,
): HostUserProfileAdapter {
  return {
    transport: 'host',
    ops: HOST_USER_PROFILE_OPS,
    ensureOwnProfileRow: (actorId) => ports.ensureOwnProfileRow(actorId),
    getOwnProfile: (actorId) => ports.getOwnProfile(actorId),
    getProfilesByUserIds: (actorId, userIds) =>
      ports.getProfilesByUserIds(actorId, userIds),
    uploadAvatar: (actorId, input) => ports.uploadAvatar(actorId, input),
  };
}
