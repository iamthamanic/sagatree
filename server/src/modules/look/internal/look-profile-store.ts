/**
 * SQLite LookProfile store — owner-scoped CRUD + append-only versions (MIG-304).
 * Location: server/src/modules/look/internal/look-profile-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import {
  normalizeLookProfileWriteDraft,
  type LookCapability,
  type LookExecutionMode,
  type LookProfileWriteDraft,
  type LookReference,
  type LookScope,
  type LookSource,
} from './look-draft.ts';
import { generateLookPublicId, isLookPublicId } from './public-look-id.ts';

export type LookProfileStatus = 'active' | 'archived';

export type LookProfileVersionRecord = {
  readonly profileId: string;
  readonly version: number;
  readonly source: LookSource;
  readonly displayName: string;
  readonly references: readonly LookReference[];
  readonly capabilities: readonly LookCapability[];
  readonly executionModes: readonly LookExecutionMode[];
  readonly createdAtIso: string;
};

export type LookProfileIdentity = {
  readonly id: string;
  readonly publicId: string;
  readonly currentVersion: number;
  readonly ownerScope: LookScope;
  readonly ownerId: string;
};

export type LookProfileRecord = {
  readonly profile: LookProfileIdentity;
  readonly status: LookProfileStatus;
  readonly current: LookProfileVersionRecord;
};

type ProfileRow = {
  id: string;
  public_id: string;
  owner_user_id: string;
  owner_scope: string;
  current_version: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  profile_id: string;
  version: number;
  source: string;
  display_name: string;
  capabilities_json: string;
  execution_modes_json: string;
  look_references_json: string;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapVersion(row: VersionRow): LookProfileVersionRecord | null {
  if (!(['manual', 'preset', 'reference-analysis', 'imported'] as const).includes(
    row.source as LookSource,
  )) {
    return null;
  }
  const executionModes = parseJsonArray<LookExecutionMode>(row.execution_modes_json);
  if (executionModes.length < 1) return null;
  return {
    profileId: row.profile_id,
    version: row.version,
    source: row.source as LookSource,
    displayName: row.display_name,
    references: parseJsonArray<LookReference>(row.look_references_json),
    capabilities: parseJsonArray<LookCapability>(row.capabilities_json),
    executionModes,
    createdAtIso: row.created_at,
  };
}

function mapRecord(profile: ProfileRow, version: VersionRow): LookProfileRecord | null {
  if (profile.status !== 'active' && profile.status !== 'archived') return null;
  if (!isLookPublicId(profile.public_id)) return null;
  const current = mapVersion(version);
  if (!current || current.version !== profile.current_version) return null;
  return {
    profile: {
      id: profile.id,
      publicId: profile.public_id,
      currentVersion: profile.current_version,
      ownerScope: profile.owner_scope as LookScope,
      ownerId: profile.owner_user_id,
    },
    status: profile.status,
    current,
  };
}

function newProfileId(): string {
  return `look:${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function createLookProfileStore(db: HostDatabase) {
  function uniquePublicId(): string {
    for (let i = 0; i < 16; i += 1) {
      const publicId = generateLookPublicId();
      const hit = db
        .prepare(`SELECT 1 AS o FROM look_profiles WHERE public_id = ? LIMIT 1`)
        .get(publicId);
      if (!hit) return publicId;
    }
    return generateLookPublicId();
  }

  function loadVersion(profileId: string, version: number): VersionRow | null {
    const row = db
      .prepare(
        `SELECT profile_id, version, source, display_name, capabilities_json,
                execution_modes_json, look_references_json, created_at
         FROM look_profile_versions
         WHERE profile_id = ? AND version = ?`,
      )
      .get(profileId, version) as VersionRow | undefined;
    return row ?? null;
  }

  function loadProfileRow(profileId: string): ProfileRow | null {
    const row = db
      .prepare(
        `SELECT id, public_id, owner_user_id, owner_scope, current_version, status,
                created_at, updated_at
         FROM look_profiles WHERE id = ?`,
      )
      .get(profileId) as ProfileRow | undefined;
    return row ?? null;
  }

  function loadRecord(profileId: string): LookProfileRecord | null {
    const profile = loadProfileRow(profileId);
    if (!profile) return null;
    const version = loadVersion(profileId, profile.current_version);
    if (!version) return null;
    return mapRecord(profile, version);
  }

  function insertVersion(
    profileId: string,
    version: number,
    draft: LookProfileWriteDraft,
    createdAt: string,
  ): void {
    db.prepare(
      `INSERT INTO look_profile_versions
         (profile_id, version, source, display_name, capabilities_json,
          execution_modes_json, look_references_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      profileId,
      version,
      draft.source,
      draft.displayName,
      JSON.stringify(draft.capabilities),
      JSON.stringify(draft.executionModes),
      JSON.stringify(draft.references),
      createdAt,
    );
  }

  return {
    loadRecord,

    listForOwner(ownerUserId: string, includeArchived: boolean): LookProfileRecord[] {
      const rows = (
        includeArchived
          ? db
              .prepare(
                `SELECT id FROM look_profiles
                 WHERE owner_user_id = ?
                 ORDER BY updated_at DESC`,
              )
              .all(ownerUserId)
          : db
              .prepare(
                `SELECT id FROM look_profiles
                 WHERE owner_user_id = ? AND status = 'active'
                 ORDER BY updated_at DESC`,
              )
              .all(ownerUserId)
      ) as { id: string }[];
      const out: LookProfileRecord[] = [];
      for (const row of rows) {
        const record = loadRecord(row.id);
        if (record) out.push(record);
      }
      return out;
    },

    create(ownerUserId: string, draftRaw: unknown): LookProfileRecord | { error: string } {
      const normalized = normalizeLookProfileWriteDraft(draftRaw);
      if (!normalized.ok) return { error: normalized.error };
      const draft = normalized.draft;
      const profileId = newProfileId();
      const publicId = uniquePublicId();
      const createdAt = nowIso();

      try {
        db.exec('BEGIN IMMEDIATE');
        db.prepare(
          `INSERT INTO look_profiles
             (id, public_id, owner_user_id, owner_scope, current_version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, 'active', ?, ?)`,
        ).run(profileId, publicId, ownerUserId, draft.ownerScope, createdAt, createdAt);
        insertVersion(profileId, 1, draft, createdAt);
        db.exec('COMMIT');
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
        const message = err instanceof Error ? err.message : String(err);
        return { error: `LookProfile konnte nicht angelegt werden: ${message}` };
      }

      const record = loadRecord(profileId);
      if (!record) return { error: 'LookProfile nach Create nicht lesbar.' };
      return record;
    },

    appendVersion(
      ownerUserId: string,
      profileId: string,
      draftRaw: unknown,
    ): LookProfileRecord | { error: string } {
      const normalized = normalizeLookProfileWriteDraft(draftRaw);
      if (!normalized.ok) return { error: normalized.error };
      const draft = normalized.draft;
      const existing = loadRecord(profileId);
      if (!existing) return { error: 'LookProfile nicht gefunden.' };
      if (existing.profile.ownerId !== ownerUserId) {
        return { error: 'Keine Berechtigung für dieses LookProfile.' };
      }
      if (existing.status === 'archived') {
        return { error: 'Archivierte Looks können nicht versioniert werden. Bitte duplizieren.' };
      }

      const nextVersion = existing.profile.currentVersion + 1;
      const createdAt = nowIso();

      try {
        db.exec('BEGIN IMMEDIATE');
        insertVersion(profileId, nextVersion, draft, createdAt);
        const bumped = db
          .prepare(
            `UPDATE look_profiles
             SET current_version = ?, updated_at = ?
             WHERE id = ? AND owner_user_id = ? AND current_version = ?`,
          )
          .run(nextVersion, createdAt, profileId, ownerUserId, existing.profile.currentVersion);
        if (bumped.changes !== 1) {
          throw new Error('version-conflict');
        }
        db.exec('COMMIT');
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
        const message = err instanceof Error ? err.message : String(err);
        if (/UNIQUE|constraint|version-conflict/i.test(message)) {
          return {
            error:
              'Konflikt: LookProfile wurde parallel aktualisiert. Bitte erneut versuchen.',
          };
        }
        return { error: `Neue Look-Version fehlgeschlagen: ${message}` };
      }

      const record = loadRecord(profileId);
      if (!record || record.profile.currentVersion !== nextVersion) {
        return {
          error: 'Konflikt: LookProfile wurde parallel aktualisiert. Bitte erneut versuchen.',
        };
      }
      return record;
    },

    archive(ownerUserId: string, profileId: string): LookProfileRecord | { error: string } {
      const existing = loadRecord(profileId);
      if (!existing) return { error: 'LookProfile nicht gefunden.' };
      if (existing.profile.ownerId !== ownerUserId) {
        return { error: 'Keine Berechtigung für dieses LookProfile.' };
      }
      db.prepare(
        `UPDATE look_profiles SET status = 'archived', updated_at = ?
         WHERE id = ? AND owner_user_id = ?`,
      ).run(nowIso(), profileId, ownerUserId);
      const record = loadRecord(profileId);
      if (!record) return { error: 'LookProfile nach Archivierung nicht lesbar.' };
      return record;
    },

    listVersions(ownerUserId: string, profileId: string): LookProfileVersionRecord[] | { error: string } {
      const profile = loadProfileRow(profileId);
      if (!profile) return { error: 'LookProfile nicht gefunden.' };
      if (profile.owner_user_id !== ownerUserId) {
        return { error: 'Keine Berechtigung für dieses LookProfile.' };
      }
      const rows = db
        .prepare(
          `SELECT profile_id, version, source, display_name, capabilities_json,
                  execution_modes_json, look_references_json, created_at
           FROM look_profile_versions
           WHERE profile_id = ?
           ORDER BY version ASC`,
        )
        .all(profileId) as VersionRow[];
      const out: LookProfileVersionRecord[] = [];
      for (const row of rows) {
        const mapped = mapVersion(row);
        if (mapped) out.push(mapped);
      }
      return out;
    },
  };
}

export type LookProfileStore = ReturnType<typeof createLookProfileStore>;
