/**
 * host-look-adapter — Binds infra HostLookProfilePorts to an injected host impl (MIG-304).
 * Location: src/infrastructure/look/host-look-adapter.ts
 *
 * Production UI still calls Supabase look-service facades. This adapter is the
 * typed dual-path seam: tests and future host transport inject HostLookProfilePorts.
 * No server/ imports; no client role elevation.
 */
import type { HostLookProfilePorts } from './host-look-ports.contract';
import { HOST_LOOK_PROFILE_OPS } from './host-look-ports.contract';

export type HostLookAdapter = HostLookProfilePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_LOOK_PROFILE_OPS;
};

/**
 * Wrap an injected HostLookProfilePorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostLookAdapter(ports: HostLookProfilePorts): HostLookAdapter {
  return {
    transport: 'host',
    ops: HOST_LOOK_PROFILE_OPS,
    listProfiles: (actorId, options) => ports.listProfiles(actorId, options),
    getProfileById: (actorId, profileId) => ports.getProfileById(actorId, profileId),
    createProfile: (actorId, draft) => ports.createProfile(actorId, draft),
    appendVersion: (actorId, profileId, draft) =>
      ports.appendVersion(actorId, profileId, draft),
    archiveProfile: (actorId, profileId) => ports.archiveProfile(actorId, profileId),
    duplicateProfile: (actorId, sourceProfileId, displayName) =>
      ports.duplicateProfile(actorId, sourceProfileId, displayName),
    listVersions: (actorId, profileId) => ports.listVersions(actorId, profileId),
  };
}
