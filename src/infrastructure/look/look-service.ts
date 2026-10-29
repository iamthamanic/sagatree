/**
 * look-service — app-facing facade for LookProfile persistence (#340).
 * App slices must not query look_* tables directly.
 * Location: src/infrastructure/look/look-service.ts
 *
 * Dual-path (MIG-304): production remains Supabase repository. Host ports are
 * bound via `createHostLookAdapter` for tests / future cutover (no accidental
 * cutover — VITE host flags alone do not redirect this facade).
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
  analyzeLookReferences,
  type LookReferenceAnalysisRequest,
} from './look-reference-analysis-service';
import { supabaseLookProfileRepository } from './supabase-look.repository';

export async function listLookProfiles(options?: {
  includeArchived?: boolean;
}): Promise<LookProfileRecord[]> {
  return supabaseLookProfileRepository.listProfiles(options);
}

export async function getLookProfile(
  profileId: string,
): Promise<LookProfileRecord | null> {
  return supabaseLookProfileRepository.getProfileById(profileId);
}

export async function createLookProfile(
  input: CreateLookProfileInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.createProfile(input);
}

export async function appendLookProfileVersion(
  input: AppendLookProfileVersionInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.appendVersion(input);
}

export async function archiveLookProfile(
  profileId: string,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.archiveProfile(profileId);
}

export async function duplicateLookProfile(
  input: DuplicateLookProfileInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.duplicateProfile(input);
}

export async function listLookProfileVersions(
  profileId: string,
): Promise<LookProfileVersion[]> {
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
  return supabaseLookProfileRepository.createProfile({ draft: writeDraft });
}
