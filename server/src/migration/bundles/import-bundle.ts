/**
 * Validated atomic import of a signed host bundle (MIG-502).
 * Location: server/src/migration/bundles/import-bundle.ts
 *
 * Failures abort before publish — no partial authoritative rows.
 */
import { createHash } from 'node:crypto';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { verifyBundleChecksum } from './checksum.ts';
import { assertSafeRelativeToken } from './path-safety.ts';
import {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  type BundleResult,
  type ImportReport,
  type SignedBundle,
} from './types.ts';

export type ImportBundleInput = {
  readonly db: HostDatabase;
  readonly bundle: SignedBundle;
  /** Importing actor becomes owner of imported worlds/assets (solo restore). */
  readonly importingOwnerUserId: string;
  /**
   * When true, refuse if any world/project/saga/asset id already exists
   * (foreign overwrite protection).
   */
  readonly refuseExistingIds?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBundleStructure(bundle: unknown): BundleResult<SignedBundle> {
  if (!isRecord(bundle)) return { ok: false, error: 'invalid-bundle' };
  if (bundle.format !== BUNDLE_FORMAT) return { ok: false, error: 'unknown-format' };
  if (bundle.formatVersion !== BUNDLE_FORMAT_VERSION) {
    return { ok: false, error: 'unsupported-format-version' };
  }
  if (typeof bundle.checksumSha256 !== 'string' || bundle.checksumSha256.length < 32) {
    return { ok: false, error: 'missing-checksum' };
  }
  if (!Array.isArray(bundle.worlds) || !Array.isArray(bundle.projects)) {
    return { ok: false, error: 'invalid-payload' };
  }
  if (!isRecord(bundle.assetBytes)) return { ok: false, error: 'invalid-asset-bytes' };

  for (const key of Object.keys(bundle.assetBytes)) {
    const safe = assertSafeRelativeToken(key);
    if (!safe.ok) return { ok: false, error: safe.error };
  }
  if (Array.isArray(bundle.assets)) {
    for (const asset of bundle.assets) {
      if (!isRecord(asset)) return { ok: false, error: 'invalid-asset-meta' };
      const key = String(asset.storageKey ?? '');
      const safe = assertSafeRelativeToken(key);
      if (!safe.ok) return { ok: false, error: safe.error };
      const idSafe = assertSafeRelativeToken(String(asset.id ?? ''));
      if (!idSafe.ok) return { ok: false, error: idSafe.error };
    }
  }

  const signed = bundle as unknown as SignedBundle;
  if (!verifyBundleChecksum(signed)) return { ok: false, error: 'checksum-mismatch' };
  return { ok: true, value: signed };
}

function countRows(db: HostDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
  return Number(row.c);
}

function idExists(db: HostDatabase, table: string, id: string): boolean {
  const row = db.prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ? LIMIT 1`).get(id) as
    | { ok: number }
    | undefined;
  return Boolean(row);
}

export function importHostBundle(input: ImportBundleInput): BundleResult<ImportReport> {
  const validated = validateBundleStructure(input.bundle);
  if (!validated.ok) return validated;

  const bundle = validated.value;
  const refuse = input.refuseExistingIds !== false;
  const owner = input.importingOwnerUserId;
  if (!owner) return { ok: false, error: 'missing-owner' };

  // Preflight — no writes yet
  for (const world of bundle.worlds) {
    const id = String(world.id ?? '');
    if (!id) return { ok: false, error: 'invalid-world' };
    if (refuse && idExists(input.db, 'worlds', id)) return { ok: false, error: 'foreign-overwrite-denied' };
  }
  for (const project of bundle.projects) {
    const id = String(project.id ?? '');
    if (!id) return { ok: false, error: 'invalid-project' };
    if (refuse && idExists(input.db, 'projects', id)) return { ok: false, error: 'foreign-overwrite-denied' };
  }
  for (const saga of bundle.sagaDefinitions) {
    const id = String(saga.id ?? '');
    if (!id) return { ok: false, error: 'invalid-saga' };
    if (refuse && idExists(input.db, 'saga_definitions', id)) {
      return { ok: false, error: 'foreign-overwrite-denied' };
    }
  }
  for (const asset of bundle.assets) {
    if (refuse && idExists(input.db, 'assets', asset.id)) {
      return { ok: false, error: 'foreign-overwrite-denied' };
    }
    const b64 = bundle.assetBytes[asset.storageKey];
    if (typeof b64 !== 'string') return { ok: false, error: `missing-asset-bytes:${asset.id}` };
    const bytes = Buffer.from(b64, 'base64');
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.checksumSha256) return { ok: false, error: 'asset-checksum-mismatch' };
    if (bytes.byteLength !== asset.byteSize) return { ok: false, error: 'asset-size-mismatch' };
  }

  const before = {
    worlds: countRows(input.db, 'worlds'),
    projects: countRows(input.db, 'projects'),
    sagas: countRows(input.db, 'saga_definitions'),
    assets: countRows(input.db, 'assets'),
  };

  try {
    input.db.exec('BEGIN IMMEDIATE');

    for (const world of bundle.worlds) {
      input.db
        .prepare(
          `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
        )
        .run(String(world.id), owner, String(world.title ?? 'World'), String(world.created_at ?? new Date().toISOString()));
    }

    for (const project of bundle.projects) {
      const cols = input.db.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[];
      const hasSaga = cols.some((c) => c.name === 'saga_id');
      if (hasSaga) {
        input.db
          .prepare(
            `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            String(project.id),
            String(project.world_id),
            owner,
            String(project.title ?? 'Project'),
            String(project.created_at ?? new Date().toISOString()),
            project.saga_id == null ? null : String(project.saga_id),
          );
      } else {
        input.db
          .prepare(
            `INSERT INTO projects (id, world_id, gm_user_id, title, created_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            String(project.id),
            String(project.world_id),
            owner,
            String(project.title ?? 'Project'),
            String(project.created_at ?? new Date().toISOString()),
          );
      }
    }

    for (const member of bundle.projectMembers) {
      input.db
        .prepare(
          `INSERT INTO project_members (project_id, user_id, role, active, joined_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          String(member.project_id),
          // Remap GM seats to importing owner; keep player seats as-is for drills
          String(member.role) === 'gm' ? owner : String(member.user_id),
          String(member.role ?? 'player'),
          Number(member.active ?? 1),
          member.joined_at == null ? null : String(member.joined_at),
        );
    }

    for (const saga of bundle.sagaDefinitions) {
      const origin = String(saga.origin ?? 'user');
      const ownerUserId = origin === 'native' ? null : owner;
      input.db
        .prepare(
          `INSERT INTO saga_definitions
           (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          String(saga.id),
          String(saga.slug),
          String(saga.title ?? 'Saga'),
          String(saga.synopsis ?? ''),
          origin,
          ownerUserId,
          Number(saga.draft_revision ?? 0),
          String(saga.created_at ?? new Date().toISOString()),
          String(saga.updated_at ?? new Date().toISOString()),
        );
    }

    for (const ver of bundle.sagaDefinitionVersions) {
      input.db
        .prepare(
          `INSERT INTO saga_definition_versions
           (id, saga_id, version_label, status, payload, published_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          String(ver.id),
          String(ver.saga_id),
          String(ver.version_label),
          String(ver.status),
          typeof ver.payload === 'string' ? ver.payload : JSON.stringify(ver.payload ?? {}),
          ver.published_at == null ? null : String(ver.published_at),
          String(ver.created_at ?? new Date().toISOString()),
        );
    }

    for (const asset of bundle.assets) {
      const b64 = bundle.assetBytes[asset.storageKey];
      const bytes = Buffer.from(b64, 'base64');
      const now = new Date().toISOString();
      input.db
        .prepare(
          `INSERT INTO assets
           (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .run(
          asset.id,
          owner,
          asset.contentType,
          bytes.byteLength,
          asset.checksumSha256,
          asset.storageKey,
          now,
        );
    }

    input.db.exec('COMMIT');
  } catch (err) {
    try {
      input.db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    // Prove no partial authoritative growth on failure paths that threw mid-tx
    const after = {
      worlds: countRows(input.db, 'worlds'),
      projects: countRows(input.db, 'projects'),
      sagas: countRows(input.db, 'saga_definitions'),
      assets: countRows(input.db, 'assets'),
    };
    if (
      after.worlds !== before.worlds ||
      after.projects !== before.projects ||
      after.sagas !== before.sagas ||
      after.assets !== before.assets
    ) {
      return { ok: false, error: 'partial-import-detected' };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'import-failed',
    };
  }

  const missing = [...bundle.missingAtlasGeometryIds];
  for (const node of bundle.atlasNodes) {
    if (node.geometry === null && !missing.includes(node.id)) missing.push(node.id);
  }

  return {
    ok: true,
    value: {
      worldIds: bundle.worlds.map((w) => String(w.id)),
      projectIds: bundle.projects.map((p) => String(p.id)),
      sagaIds: bundle.sagaDefinitions.map((s) => String(s.id)),
      assetIds: bundle.assets.map((a) => a.id),
      missingAtlasGeometryIds: missing,
      payloadChecksum: bundle.checksumSha256,
    },
  };
}
