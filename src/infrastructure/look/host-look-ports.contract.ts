/**
 * Host-aligned LookProfile ports contract (MIG-304 / #803).
 * Location: src/infrastructure/look/host-look-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/look` LookProfile ports.
 * Supabase facades remain live until cutover; this documents the host shape
 * for parity checks without importing the Node host package.
 */

export type HostLookProfileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type HostLookReference = {
  readonly id: string;
  readonly kind: 'style' | 'content';
  readonly uri: string;
  readonly label?: string;
  readonly weight?: number;
};

export type HostLookProfileVersion = {
  readonly profileId: string;
  readonly version: number;
  readonly source: string;
  readonly displayName: string;
  readonly references: readonly HostLookReference[];
  readonly capabilities: readonly string[];
  readonly executionModes: readonly string[];
  readonly createdAtIso: string;
};

export type HostLookProfileIdentity = {
  readonly id: string;
  readonly publicId: string;
  readonly currentVersion: number;
  readonly ownerScope: string;
  readonly ownerId: string;
};

export type HostLookProfileRecord = {
  readonly profile: HostLookProfileIdentity;
  readonly status: 'active' | 'archived';
  readonly current: HostLookProfileVersion;
};

/**
 * Actor id is the verified host actor — never a client-claimed owner.
 * Ports mirror host createLookPorts surface (no HTTP in this slice).
 */
export type HostLookProfilePorts = {
  readonly listProfiles: (
    actorId: string,
    options?: { readonly includeArchived?: boolean },
  ) => Promise<HostLookProfileResult<readonly HostLookProfileRecord[]>>;
  readonly getProfileById: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord | null>>;
  readonly createProfile: (
    actorId: string,
    draft: unknown,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly appendVersion: (
    actorId: string,
    profileId: string,
    draft: unknown,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly archiveProfile: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly duplicateProfile: (
    actorId: string,
    sourceProfileId: string,
    displayName?: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly listVersions: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<readonly HostLookProfileVersion[]>>;
};

/** Stable operation names for composition / future HTTP cutover documentation. */
export const HOST_LOOK_PROFILE_OPS = [
  'listProfiles',
  'getProfileById',
  'createProfile',
  'appendVersion',
  'archiveProfile',
  'duplicateProfile',
  'listVersions',
] as const;

export type HostLookProfileOp = (typeof HOST_LOOK_PROFILE_OPS)[number];
