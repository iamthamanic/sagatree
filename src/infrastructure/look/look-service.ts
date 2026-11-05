/**
 * look-service — app-facing facade for LookProfile persistence (#340).
 * App slices must not query look_* tables directly.
 * Location: src/infrastructure/look/look-service.ts
 *
 * Dual-path (MIG-304): Host Library when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */

import type {
  AppendLookProfileVersionInput,
  CreateLookProfileInput,
  DuplicateLookProfileInput,
  LookProfileRecord,
  LookProfileVersion,
  LookReferenceAnalysisDraft,
  LookReferenceAnalysisOutcome,
} from '../../domains/look';
import { buildLookProfileWriteDraftFromAnalysis } from '../../domains/look';
import {
  appendHostLibraryLookVersion,
  archiveHostLibraryLook,
  createHostLibraryLook,
  duplicateHostLibraryLook,
  fetchHostLibraryLookVersions,
  fetchHostLibraryLooks,
  isHostLibraryEnabled,
} from '../host/host-library-http';
import {
  analyzeLookReferences,
  type LookReferenceAnalysisRequest,
} from './look-reference-analysis-service';
import { supabaseLookProfileRepository } from './supabase-look.repository';

function asLookRecord(value: unknown): LookProfileRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as LookProfileRecord;
  if (!record.profile || !record.current || typeof record.status !== 'string') return null;
  return record;
}

export async function listLookProfiles(options?: {
  includeArchived?: boolean;
}): Promise<LookProfileRecord[]> {
  if (isHostLibraryEnabled()) {
    const rows = await fetchHostLibraryLooks();
    return rows
      .map(asLookRecord)
      .filter((row): row is LookProfileRecord => row !== null)
      .filter((row) => options?.includeArchived === true || row.status === 'active');
  }
  return supabaseLookProfileRepository.listProfiles(options);
}

export async function getLookProfile(
  profileId: string,
): Promise<LookProfileRecord | null> {
  if (isHostLibraryEnabled()) {
    const rows = await listLookProfiles({ includeArchived: true });
    return rows.find((row) => row.profile.id === profileId) ?? null;
  }
  return supabaseLookProfileRepository.getProfileById(profileId);
}

export async function createLookProfile(
  input: CreateLookProfileInput,
): Promise<LookProfileRecord> {
  if (isHostLibraryEnabled()) {
    const created = await createHostLibraryLook(input.draft);
    const record = asLookRecord(created);
    if (!record) throw new Error('Host-Look anlegen: ungültige Antwort');
    return record;
  }
  return supabaseLookProfileRepository.createProfile(input);
}

export async function appendLookProfileVersion(
  input: AppendLookProfileVersionInput,
): Promise<LookProfileRecord> {
  if (isHostLibraryEnabled()) {
    const appended = await appendHostLibraryLookVersion(input.profileId, input.draft);
    const record = asLookRecord(appended);
    if (!record) throw new Error('Host-Look-Version anhängen: ungültige Antwort');
    return record;
  }
  return supabaseLookProfileRepository.appendVersion(input);
}

export async function archiveLookProfile(
  profileId: string,
): Promise<LookProfileRecord> {
  if (isHostLibraryEnabled()) {
    const archived = await archiveHostLibraryLook(profileId);
    const record = asLookRecord(archived);
    if (!record) throw new Error('Host-Look archivieren: ungültige Antwort');
    return record;
  }
  return supabaseLookProfileRepository.archiveProfile(profileId);
}

export async function duplicateLookProfile(
  input: DuplicateLookProfileInput,
): Promise<LookProfileRecord> {
  if (isHostLibraryEnabled()) {
    const duplicated = await duplicateHostLibraryLook(
      input.sourceProfileId,
      input.displayName,
    );
    const record = asLookRecord(duplicated);
    if (!record) throw new Error('Host-Look duplizieren: ungültige Antwort');
    return record;
  }
  return supabaseLookProfileRepository.duplicateProfile(input);
}

function asLookVersion(value: unknown): LookProfileVersion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as LookProfileVersion;
  if (
    typeof row.profileId !== 'string' ||
    typeof row.version !== 'number' ||
    typeof row.displayName !== 'string' ||
    typeof row.createdAtIso !== 'string'
  ) {
    return null;
  }
  return row;
}

export async function listLookProfileVersions(
  profileId: string,
): Promise<LookProfileVersion[]> {
  if (isHostLibraryEnabled()) {
    const rows = await fetchHostLibraryLookVersions(profileId);
    return rows
      .map(asLookVersion)
      .filter((row): row is LookProfileVersion => row !== null)
      .sort((a, b) => a.version - b.version);
  }
  return supabaseLookProfileRepository.listVersions(profileId);
}

/** Provider-neutral analysis — does not persist. */
export async function analyzeLookReferencesForDraft(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  return analyzeLookReferences(request);
}

/**
 * Persist only a previously normalized analysis draft.
 * Invalid / foreign analysis versions throw — nothing is written.
 */
export async function createLookProfileFromReferenceAnalysis(
  draft: LookReferenceAnalysisDraft,
): Promise<LookProfileRecord> {
  const writeDraft = buildLookProfileWriteDraftFromAnalysis(draft);
  if (writeDraft.source !== 'reference-analysis') {
    throw new Error('Look analysis draft rejected: invalid source');
  }
  return createLookProfile({ draft: writeDraft });
}
