/**
 * look.persistence — DTO mapping between persisted rows and Look domain (#340).
 * Location: src/infrastructure/look/look.persistence.ts
 */

import {
  parseLookCapabilities,
  parseLookExecutionModes,
  parseLookProfile,
  parseLookProfileVersion,
  parseLookReferences,
  parseLookScope,
  type LookProfileRecord,
  type LookProfileStatus,
  type LookProfileVersion,
  type LookProfileWriteDraft,
  type LookScope,
} from '../../domains/look';

export const LOOK_PROFILE_COLUMNS =
  'id, public_id, owner_user_id, owner_scope, current_version, status, created_at, updated_at' as const;

export const LOOK_PROFILE_VERSION_COLUMNS =
  'profile_id, version, source, display_name, capabilities, execution_modes, look_references, created_at' as const;

export type LookProfileDto = {
  id: string;
  public_id?: string | null;
  owner_user_id: string;
  owner_scope: string;
  current_version: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LookProfileVersionDto = {
  profile_id: string;
  version: number;
  source: string;
  display_name: string;
  capabilities: unknown;
  execution_modes: unknown;
  look_references: unknown;
  created_at: string;
};

export function mapLookProfileVersionRow(
  row: LookProfileVersionDto,
): LookProfileVersion | null {
  return parseLookProfileVersion({
    profileId: row.profile_id,
    version: row.version,
    source: row.source,
    displayName: row.display_name,
    capabilities: row.capabilities,
    executionModes: row.execution_modes,
    references: row.look_references,
    createdAtIso: row.created_at,
  });
}

export function mapLookProfileRecord(
  profileRow: LookProfileDto,
  versionRow: LookProfileVersionDto,
): LookProfileRecord | null {
  const profile = parseLookProfile({
    id: profileRow.id,
    publicId:
      typeof profileRow.public_id === 'string' && profileRow.public_id.trim()
        ? profileRow.public_id.trim().toUpperCase()
        : undefined,
    currentVersion: profileRow.current_version,
    ownerScope: profileRow.owner_scope,
    ownerId: profileRow.owner_user_id,
  });
  if (profile === null) return null;
  if (profileRow.status !== 'active' && profileRow.status !== 'archived') {
    return null;
  }
  const current = mapLookProfileVersionRow(versionRow);
  if (current === null) return null;
  if (current.version !== profile.currentVersion) return null;
  return {
    profile,
    status: profileRow.status as LookProfileStatus,
    current,
  };
}

export function toPersistedVersionInsert(
  profileId: string,
  version: number,
  draft: LookProfileWriteDraft,
  createdAtIso: string,
): {
  profile_id: string;
  version: number;
  source: string;
  display_name: string;
  capabilities: LookProfileWriteDraft['capabilities'];
  execution_modes: LookProfileWriteDraft['executionModes'];
  look_references: LookProfileWriteDraft['references'];
  created_at: string;
} {
  return {
    profile_id: profileId,
    version,
    source: draft.source,
    display_name: draft.displayName,
    capabilities: draft.capabilities,
    execution_modes: draft.executionModes,
    look_references: draft.references,
    created_at: createdAtIso,
  };
}

export function resolveOwnerScope(draft: LookProfileWriteDraft): LookScope {
  const scope = draft.ownerScope ?? 'player-character';
  const parsed = parseLookScope(scope);
  return parsed ?? 'player-character';
}

/** Re-export parsers used by service guards for unavailable asset refs. */
export function extractReferenceUris(version: LookProfileVersion): string[] {
  return version.references.map((ref) => ref.uri);
}

export function assertParsedCapabilities(value: unknown): string[] {
  return parseLookCapabilities(value);
}

export function assertParsedExecutionModes(value: unknown): string[] {
  return parseLookExecutionModes(value);
}

export function assertParsedReferences(value: unknown) {
  return parseLookReferences(value);
}
