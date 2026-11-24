/**
 * Look persistence contracts — repository surface for #340.
 * Location: src/domains/look/persistence-contracts.ts
 *
 * Infrastructure implements these; domain stays React/backend clients-free.
 */

import type {
  LookProfileRecord,
  LookProfileWriteDraft,
  LookProfileVersion,
} from './types';

export type CreateLookProfileInput = {
  readonly draft: LookProfileWriteDraft;
};

export type AppendLookProfileVersionInput = {
  readonly profileId: string;
  readonly draft: LookProfileWriteDraft;
};

export type DuplicateLookProfileInput = {
  readonly sourceProfileId: string;
  readonly displayName?: string;
};

export interface LookProfileRepository {
  listProfiles(options?: {
    includeArchived?: boolean;
  }): Promise<LookProfileRecord[]>;

  getProfileById(profileId: string): Promise<LookProfileRecord | null>;

  createProfile(input: CreateLookProfileInput): Promise<LookProfileRecord>;

  /** Append-only: creates version N+1; never mutates prior versions. */
  appendVersion(input: AppendLookProfileVersionInput): Promise<LookProfileRecord>;

  archiveProfile(profileId: string): Promise<LookProfileRecord>;

  /**
   * Duplicate creates a new active profile (version 1) from the source current
   * version. Archived sources are allowed (copy stays active).
   */
  duplicateProfile(input: DuplicateLookProfileInput): Promise<LookProfileRecord>;

  listVersions(profileId: string): Promise<LookProfileVersion[]>;
}
