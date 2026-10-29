/**
 * look module public API — MIG-412 reference-analysis quarantine + MIG-304 LookProfile ports.
 * Location: server/src/modules/look/index.ts
 *
 * LookProfile HTTP publicActivation remains false (cutover → MIG-600).
 * Reference-analysis publicActivationAuthorized remains false (MIG-412).
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  createLookProfileStore,
  type LookProfileRecord,
  type LookProfileVersionRecord,
} from './internal/look-profile-store.ts';

export const LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
/** LookProfile host HTTP mount is deferred to MIG-600; ports are transport-free. */
export const LOOK_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export {
  LOOK_REF_ANALYSIS_ALLOWED_MIME,
  LOOK_REF_ANALYSIS_MAX_BYTES,
  assertOwnerScopedStoragePath,
  bytesToBase64,
  decodeLookRefBase64Image,
  isAllowedLookRefAnalysisMime,
  sniffLookRefAnalysisMime,
  validateLookRefImageBytes,
  type LookRefAnalysisMime,
} from './internal/look-reference-image.ts';

export { createLookReferenceRateLimitStore } from './internal/look-reference-rate-limit.ts';

export type {
  LookProfileRecord,
  LookProfileVersionRecord,
  LookProfileIdentity,
  LookProfileStatus,
} from './internal/look-profile-store.ts';

export type LookProfileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type LookProfilePorts = {
  readonly moduleId: 'look';
  readonly listProfiles: (
    actor: Actor,
    options?: { readonly includeArchived?: boolean },
  ) => LookProfileResult<readonly LookProfileRecord[]>;
  readonly getProfileById: (
    actor: Actor,
    profileId: string,
  ) => LookProfileResult<LookProfileRecord | null>;
  readonly createProfile: (
    actor: Actor,
    draft: unknown,
  ) => LookProfileResult<LookProfileRecord>;
  readonly appendVersion: (
    actor: Actor,
    profileId: string,
    draft: unknown,
  ) => LookProfileResult<LookProfileRecord>;
  readonly archiveProfile: (
    actor: Actor,
    profileId: string,
  ) => LookProfileResult<LookProfileRecord>;
  readonly duplicateProfile: (
    actor: Actor,
    sourceProfileId: string,
    displayName?: string,
  ) => LookProfileResult<LookProfileRecord>;
  readonly listVersions: (
    actor: Actor,
    profileId: string,
  ) => LookProfileResult<readonly LookProfileVersionRecord[]>;
};

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

function assertProfileId(profileId: string): string | null {
  const trimmed = typeof profileId === 'string' ? profileId.trim() : '';
  if (trimmed.length < 8 || trimmed.length > 160) return null;
  return trimmed;
}

/** Owner ids the actor may read/mutate (remote account + linked solo). */
function actorOwnerIds(actor: Actor): readonly string[] {
  const ids = new Set<string>([actor.actorId]);
  if (actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)) {
    for (const linked of actor.linkedSoloActorIds) {
      if (typeof linked === 'string' && linked.length > 0) {
        ids.add(linked);
      }
    }
  }
  return [...ids];
}

function actorOwnsProfile(actor: Actor, ownerUserId: string): boolean {
  return actorOwnerIds(actor).includes(ownerUserId);
}

export function createLookPorts(deps: { readonly db: HostDatabase }): LookProfilePorts {
  const store = createLookProfileStore(deps.db);

  return {
    moduleId: 'look',

    listProfiles(actor, options) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const includeArchived = options?.includeArchived === true;
      const merged: LookProfileRecord[] = [];
      const seen = new Set<string>();
      for (const ownerId of actorOwnerIds(actor)) {
        for (const row of store.listForOwner(ownerId, includeArchived)) {
          if (seen.has(row.profile.id)) continue;
          seen.add(row.profile.id);
          merged.push(row);
        }
      }
      const sorted = merged.toSorted((a, b) =>
        b.current.createdAtIso.localeCompare(a.current.createdAtIso),
      );
      return { ok: true, value: sorted };
    },

    getProfileById(actor, profileId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const id = assertProfileId(profileId);
      if (!id) return { ok: false, error: 'invalid-profile-id' };
      for (const ownerId of actorOwnerIds(actor)) {
        const record = store.loadRecord(id, ownerId);
        if (record) return { ok: true, value: record };
      }
      const any = store.loadRecord(id);
      if (!any) return { ok: true, value: null };
      return { ok: false, error: 'not-authorized' };
    },

    createProfile(actor, draft) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const created = store.create(actor.actorId, draft);
      if ('error' in created) return { ok: false, error: created.error };
      return { ok: true, value: created };
    },

    appendVersion(actor, profileId, draft) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const id = assertProfileId(profileId);
      if (!id) return { ok: false, error: 'invalid-profile-id' };
      const probe = store.loadRecord(id);
      if (!probe) return { ok: false, error: 'not-found' };
      if (!actorOwnsProfile(actor, probe.profile.ownerId)) {
        return { ok: false, error: 'not-authorized' };
      }
      const updated = store.appendVersion(probe.profile.ownerId, id, draft);
      if ('error' in updated) {
        if (/Berechtigung/i.test(updated.error)) return { ok: false, error: 'not-authorized' };
        if (/nicht gefunden/i.test(updated.error)) return { ok: false, error: 'not-found' };
        return { ok: false, error: updated.error };
      }
      return { ok: true, value: updated };
    },

    archiveProfile(actor, profileId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const id = assertProfileId(profileId);
      if (!id) return { ok: false, error: 'invalid-profile-id' };
      const probe = store.loadRecord(id);
      if (!probe) return { ok: false, error: 'not-found' };
      if (!actorOwnsProfile(actor, probe.profile.ownerId)) {
        return { ok: false, error: 'not-authorized' };
      }
      const archived = store.archive(probe.profile.ownerId, id);
      if ('error' in archived) {
        if (/Berechtigung/i.test(archived.error)) return { ok: false, error: 'not-authorized' };
        if (/nicht gefunden/i.test(archived.error)) return { ok: false, error: 'not-found' };
        return { ok: false, error: archived.error };
      }
      return { ok: true, value: archived };
    },

    duplicateProfile(actor, sourceProfileId, displayName) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const sourceId = assertProfileId(sourceProfileId);
      if (!sourceId) return { ok: false, error: 'invalid-profile-id' };
      const source = store.loadRecord(sourceId);
      if (!source) return { ok: false, error: 'not-found' };
      if (!actorOwnsProfile(actor, source.profile.ownerId)) {
        return { ok: false, error: 'not-authorized' };
      }
      const suffix = ' (Kopie)';
      const name =
        typeof displayName === 'string' && displayName.trim().length > 0
          ? displayName.trim()
          : `${source.current.displayName.slice(0, 200 - suffix.length)}${suffix}`;
      const created = store.create(actor.actorId, {
        displayName: name,
        source: source.current.source,
        references: source.current.references,
        capabilities: source.current.capabilities,
        executionModes: source.current.executionModes,
        ownerScope: source.profile.ownerScope,
      });
      if ('error' in created) return { ok: false, error: created.error };
      return { ok: true, value: created };
    },

    listVersions(actor, profileId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const id = assertProfileId(profileId);
      if (!id) return { ok: false, error: 'invalid-profile-id' };
      const probe = store.loadRecord(id);
      if (!probe) return { ok: false, error: 'not-found' };
      if (!actorOwnsProfile(actor, probe.profile.ownerId)) {
        return { ok: false, error: 'not-authorized' };
      }
      const versions = store.listVersions(probe.profile.ownerId, id);
      if ('error' in versions) {
        if (/Berechtigung/i.test(versions.error)) return { ok: false, error: 'not-authorized' };
        if (/nicht gefunden/i.test(versions.error)) return { ok: false, error: 'not-found' };
        return { ok: false, error: versions.error };
      }
      return { ok: true, value: versions };
    },
  };
}

export function createLookPortsStub(): LookProfilePorts {
  const unavailable = { ok: false as const, error: 'store-unavailable' };
  return {
    moduleId: 'look',
    listProfiles: () => unavailable,
    getProfileById: () => unavailable,
    createProfile: () => unavailable,
    appendVersion: () => unavailable,
    archiveProfile: () => unavailable,
    duplicateProfile: () => unavailable,
    listVersions: () => unavailable,
  };
}
