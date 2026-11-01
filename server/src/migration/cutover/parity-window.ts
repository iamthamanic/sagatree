/**
 * MIG-701 Dornhain dual-run parity window (read-only shadow compare).
 * Location: server/src/migration/cutover/parity-window.ts
 *
 * One write authority; shadow side is compared at the same confirmed revision.
 * Shadow reads must not mutate business state. Discrepancy blocks shutdown-ready.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  assertDornhainCatalogPresent,
  dornhainFixtureCatalog,
  type DornhainCatalog,
} from './dornhain-catalog.ts';
import { applyDornhainCatalogToHost } from './dornhain-drill.ts';

const projectionRowSchema = z.object({
  recordId: z.string().min(1),
  kind: z.enum(['world', 'saga', 'character', 'monster', 'item', 'npc', 'asset']),
  revision: z.number().int().nonnegative(),
  digest: z.string().min(1),
});

export type ProjectionRow = z.infer<typeof projectionRowSchema>;

export type ParityDiscrepancy = {
  readonly recordId: string;
  readonly kind: ProjectionRow['kind'];
  readonly revision: number;
  readonly discrepancyKind:
    | 'missing-on-shadow'
    | 'missing-on-authority'
    | 'digest-mismatch'
    | 'revision-mismatch';
  readonly authorityDigest?: string;
  readonly shadowDigest?: string;
};

export type ParityCompareReport = {
  readonly confirmedRevision: number;
  readonly authorityRecordCount: number;
  readonly shadowRecordCount: number;
  readonly discrepancies: readonly ParityDiscrepancy[];
  readonly shutdownPredecessorMet: boolean;
  readonly shadowWroteBusinessState: boolean;
};

export type ParityRollbackArchive = {
  readonly observationStartedAt: string;
  readonly observationEndedAt: string;
  readonly observationDurationMs: number;
  readonly result: 'rollback-to-authority' | 'continue-observe';
  readonly responsibleDecision: string;
  readonly confirmedRevision: number;
  readonly discrepancyCount: number;
  readonly archivePath: string;
};

export type ParityWindowReport = {
  readonly clean: ParityCompareReport;
  readonly injected: ParityCompareReport;
  readonly rollback: ParityRollbackArchive;
  readonly catalogIntactOnAuthority: boolean;
};

function digestPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function businessFingerprint(db: HostDatabase, ownerUserId: string): string {
  const parts: string[] = [];
  for (const sql of [
    `SELECT id, title FROM worlds WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, slug, title FROM saga_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, public_id, name FROM characters WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, public_id, name FROM inventory_item_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, checksum_sha256 FROM assets WHERE owner_user_id = ? ORDER BY id`,
  ]) {
    parts.push(JSON.stringify(db.prepare(sql).all(ownerUserId)));
  }
  return digestPayload(parts);
}

/**
 * Build a revision-pinned projection snapshot from Dornhain host tables (SELECT only).
 */
export function captureParitySnapshot(
  db: HostDatabase,
  ownerUserId: string,
  confirmedRevision: number,
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  for (const world of db
    .prepare(`SELECT id, title FROM worlds WHERE owner_user_id = ? ORDER BY id`)
    .all(ownerUserId) as { id: string; title: string }[]) {
    rows.push({
      recordId: world.id,
      kind: 'world',
      revision: confirmedRevision,
      digest: digestPayload({ title: world.title }),
    });
  }
  for (const saga of db
    .prepare(`SELECT id, slug, title FROM saga_definitions WHERE owner_user_id = ? ORDER BY id`)
    .all(ownerUserId) as { id: string; slug: string; title: string }[]) {
    rows.push({
      recordId: saga.id,
      kind: 'saga',
      revision: confirmedRevision,
      digest: digestPayload({ slug: saga.slug, title: saga.title }),
    });
  }
  for (const character of db
    .prepare(`SELECT id, public_id, name FROM characters WHERE owner_user_id = ? ORDER BY id`)
    .all(ownerUserId) as { id: string; public_id: string; name: string }[]) {
    rows.push({
      recordId: character.id,
      kind: 'character',
      revision: confirmedRevision,
      digest: digestPayload({ publicId: character.public_id, name: character.name }),
    });
  }
  for (const def of db
    .prepare(
      `SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ? ORDER BY id`,
    )
    .all(ownerUserId) as { id: string; payload: string }[]) {
    let kind: 'monster' | 'npc' = 'npc';
    try {
      const parsed = JSON.parse(def.payload) as { kind?: string };
      if (parsed.kind === 'monster') kind = 'monster';
    } catch {
      /* raw payload still digested */
    }
    rows.push({
      recordId: def.id,
      kind,
      revision: confirmedRevision,
      digest: digestPayload({ payload: def.payload }),
    });
  }
  for (const item of db
    .prepare(
      `SELECT id, public_id, name FROM inventory_item_definitions WHERE owner_user_id = ? ORDER BY id`,
    )
    .all(ownerUserId) as { id: string; public_id: string; name: string }[]) {
    rows.push({
      recordId: item.id,
      kind: 'item',
      revision: confirmedRevision,
      digest: digestPayload({ publicId: item.public_id, name: item.name }),
    });
  }
  for (const asset of db
    .prepare(
      `SELECT id, checksum_sha256 FROM assets WHERE owner_user_id = ? ORDER BY id`,
    )
    .all(ownerUserId) as { id: string; checksum_sha256: string }[]) {
    rows.push({
      recordId: asset.id,
      kind: 'asset',
      revision: confirmedRevision,
      digest: digestPayload({ checksum: asset.checksum_sha256 }),
    });
  }
  return rows.map((row) => projectionRowSchema.parse(row));
}

export function compareParitySnapshots(
  authority: readonly ProjectionRow[],
  shadow: readonly ProjectionRow[],
  confirmedRevision: number,
): ParityCompareReport {
  const discrepancies: ParityDiscrepancy[] = [];
  const authById = new Map(authority.map((row) => [row.recordId, row]));
  const shadowById = new Map(shadow.map((row) => [row.recordId, row]));

  for (const [id, auth] of authById) {
    const sh = shadowById.get(id);
    if (!sh) {
      discrepancies.push({
        recordId: id,
        kind: auth.kind,
        revision: confirmedRevision,
        discrepancyKind: 'missing-on-shadow',
        authorityDigest: auth.digest,
      });
      continue;
    }
    if (auth.revision !== confirmedRevision || sh.revision !== confirmedRevision) {
      discrepancies.push({
        recordId: id,
        kind: auth.kind,
        revision: confirmedRevision,
        discrepancyKind: 'revision-mismatch',
        authorityDigest: auth.digest,
        shadowDigest: sh.digest,
      });
      continue;
    }
    if (auth.digest !== sh.digest) {
      discrepancies.push({
        recordId: id,
        kind: auth.kind,
        revision: confirmedRevision,
        discrepancyKind: 'digest-mismatch',
        authorityDigest: auth.digest,
        shadowDigest: sh.digest,
      });
    }
  }
  for (const [id, sh] of shadowById) {
    if (!authById.has(id)) {
      discrepancies.push({
        recordId: id,
        kind: sh.kind,
        revision: confirmedRevision,
        discrepancyKind: 'missing-on-authority',
        shadowDigest: sh.digest,
      });
    }
  }

  return {
    confirmedRevision,
    authorityRecordCount: authority.length,
    shadowRecordCount: shadow.length,
    discrepancies,
    shutdownPredecessorMet: discrepancies.length === 0,
    shadowWroteBusinessState: false,
  };
}

function injectShadowDigestMismatch(db: HostDatabase, ownerUserId: string): string {
  const row = db
    .prepare(`SELECT id, name FROM characters WHERE owner_user_id = ? ORDER BY id LIMIT 1`)
    .get(ownerUserId) as { id: string; name: string } | undefined;
  if (!row) throw new Error('parity-inject: no character on shadow');
  db.prepare(`UPDATE characters SET name = ? WHERE id = ?`).run(`${row.name}__PARITY_POISON`, row.id);
  return row.id;
}

const COPY_TABLES_DELETE_ORDER = [
  'project_members',
  'saga_definition_versions',
  'inventory_item_definitions',
  'npc_creature_definitions',
  'characters',
  'assets',
  'projects',
  'saga_definitions',
  'worlds',
] as const;

const COPY_TABLES_INSERT_ORDER = [...COPY_TABLES_DELETE_ORDER].reverse();

function cloneAuthorityIntoShadow(authority: HostDatabase, shadow: HostDatabase): void {
  for (const table of COPY_TABLES_DELETE_ORDER) {
    shadow.prepare(`DELETE FROM ${table}`).run();
  }
  for (const table of COPY_TABLES_INSERT_ORDER) {
    const rows = authority.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => '?').join(', ');
      shadow
        .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
        .run(...keys.map((key) => row[key]));
    }
  }
}

export function archiveParityRollbackDecision(args: {
  readonly archiveDir: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly result: ParityRollbackArchive['result'];
  readonly responsibleDecision: string;
  readonly confirmedRevision: number;
  readonly discrepancyCount: number;
}): ParityRollbackArchive {
  mkdirSync(args.archiveDir, { recursive: true });
  const archivePath = join(args.archiveDir, `parity-rollback-${randomUUID()}.json`);
  const payload: ParityRollbackArchive = {
    observationStartedAt: args.startedAt.toISOString(),
    observationEndedAt: args.endedAt.toISOString(),
    observationDurationMs: Math.max(0, args.endedAt.getTime() - args.startedAt.getTime()),
    result: args.result,
    responsibleDecision: args.responsibleDecision,
    confirmedRevision: args.confirmedRevision,
    discrepancyCount: args.discrepancyCount,
    archivePath,
  };
  writeFileSync(archivePath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function catalogPresenceFromDb(db: HostDatabase, ownerUserId: string, catalog: DornhainCatalog) {
  const worldTitles = (
    db.prepare(`SELECT title FROM worlds WHERE owner_user_id = ?`).all(ownerUserId) as {
      title: string;
    }[]
  ).map((r) => r.title);
  const sagaSlugs = (
    db.prepare(`SELECT slug FROM saga_definitions WHERE owner_user_id = ?`).all(ownerUserId) as {
      slug: string;
    }[]
  ).map((r) => r.slug);
  const characterIds = (
    db.prepare(`SELECT id FROM characters WHERE owner_user_id = ?`).all(ownerUserId) as {
      id: string;
    }[]
  ).map((r) => r.id);
  const defRows = db
    .prepare(`SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ?`)
    .all(ownerUserId) as { id: string; payload: string }[];
  const monsterIds = defRows
    .filter((r) => {
      try {
        return (JSON.parse(r.payload) as { kind?: string }).kind === 'monster';
      } catch {
        return false;
      }
    })
    .map((r) => r.id);
  const npcPublicIds = defRows.flatMap((r) => {
    try {
      const parsed = JSON.parse(r.payload) as { kind?: string; publicId?: string };
      return parsed.kind === 'npc' && parsed.publicId ? [parsed.publicId] : [];
    } catch {
      return [];
    }
  });
  const itemDefinitionIds = (
    db
      .prepare(`SELECT id FROM inventory_item_definitions WHERE owner_user_id = ?`)
      .all(ownerUserId) as { id: string }[]
  ).map((r) => r.id);
  return assertDornhainCatalogPresent({
    worldTitles,
    sagaSlugs,
    characterIds,
    monsterIds,
    itemDefinitionIds,
    npcPublicIds,
    catalog,
  });
}

/**
 * Seed a minimal Dornhain authority host for the parity fixture (world + saga + catalog).
 */
export function seedDornhainParityAuthority(
  db: HostDatabase,
  ownerUserId: string,
  catalog: DornhainCatalog = dornhainFixtureCatalog(),
): { worldId: string } {
  const now = new Date().toISOString();
  const worldId = randomUUID();
  const projectId = randomUUID();
  const sagaId = randomUUID().replace(/-/g, '').slice(0, 32);
  const versionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = randomUUID().replace(/-/g, '').slice(0, 32);
  const bytes = Buffer.from('dornhain-parity-cover');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  db.prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    worldId,
    ownerUserId,
    catalog.worldTitle,
    now,
  );
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, ownerUserId, 'Dornhain Parity Table', now, null);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, 'gm', 1, ?)`,
  ).run(projectId, ownerUserId, now);
  db.prepare(
    `INSERT INTO saga_definitions
     (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
     VALUES (?, ?, ?, '', 'user', ?, 0, ?, ?)`,
  ).run(sagaId, catalog.sagaSlug, catalog.sagaTitle, ownerUserId, now, now);
  db.prepare(
    `INSERT INTO saga_definition_versions
     (id, saga_id, version_label, status, payload, published_at, created_at)
     VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
  ).run(versionId, sagaId, JSON.stringify({ title: catalog.sagaTitle }), now, now);
  db.prepare(
    `INSERT INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 1, ?)`,
  ).run(assetId, ownerUserId, bytes.byteLength, checksum, assetId, now);
  applyDornhainCatalogToHost(db, ownerUserId, worldId, catalog, now);
  return { worldId };
}

/**
 * Full MIG-701 fixture: clean compare → inject mismatch → fail-closed shutdown flag → rollback archive.
 */
export function runDornhainParityWindowDrill(args: {
  readonly authorityDb: HostDatabase;
  readonly shadowDb: HostDatabase;
  readonly archiveDir: string;
  readonly ownerUserId: string;
  readonly confirmedRevision: number;
  readonly responsibleDecision?: string;
}): ParityWindowReport {
  const catalog = dornhainFixtureCatalog();
  const startedAt = new Date();

  cloneAuthorityIntoShadow(args.authorityDb, args.shadowDb);

  const authorityBefore = businessFingerprint(args.authorityDb, args.ownerUserId);
  const shadowBefore = businessFingerprint(args.shadowDb, args.ownerUserId);

  const authoritySnap = captureParitySnapshot(
    args.authorityDb,
    args.ownerUserId,
    args.confirmedRevision,
  );
  const shadowClean = captureParitySnapshot(args.shadowDb, args.ownerUserId, args.confirmedRevision);

  const authorityAfterRead = businessFingerprint(args.authorityDb, args.ownerUserId);
  const shadowAfterRead = businessFingerprint(args.shadowDb, args.ownerUserId);
  if (authorityAfterRead !== authorityBefore || shadowAfterRead !== shadowBefore) {
    throw new Error('parity-window: clean compare must be read-only on both sides');
  }

  const clean = {
    ...compareParitySnapshots(authoritySnap, shadowClean, args.confirmedRevision),
    shadowWroteBusinessState: false,
  };
  if (!clean.shutdownPredecessorMet) {
    throw new Error('parity-window: clean clone must compare equal');
  }

  const poisonedId = injectShadowDigestMismatch(args.shadowDb, args.ownerUserId);
  const injected = {
    ...compareParitySnapshots(
      authoritySnap,
      captureParitySnapshot(args.shadowDb, args.ownerUserId, args.confirmedRevision),
      args.confirmedRevision,
    ),
    shadowWroteBusinessState: false,
  };
  if (injected.shutdownPredecessorMet) {
    throw new Error(`parity-window: injected mismatch on ${poisonedId} must block shutdown`);
  }
  if (
    !injected.discrepancies.some(
      (d) => d.recordId === poisonedId && d.discrepancyKind === 'digest-mismatch',
    )
  ) {
    throw new Error('parity-window: injected character digest mismatch not reported');
  }

  cloneAuthorityIntoShadow(args.authorityDb, args.shadowDb);
  const restored = compareParitySnapshots(
    authoritySnap,
    captureParitySnapshot(args.shadowDb, args.ownerUserId, args.confirmedRevision),
    args.confirmedRevision,
  );
  if (!restored.shutdownPredecessorMet) {
    throw new Error('parity-window: rollback did not restore parity');
  }

  const endedAt = new Date();
  const rollback = archiveParityRollbackDecision({
    archiveDir: args.archiveDir,
    startedAt,
    endedAt,
    result: 'rollback-to-authority',
    responsibleDecision:
      args.responsibleDecision ??
      'MIG-701 fixture: discrepancy above threshold → return to last consistent authority',
    confirmedRevision: args.confirmedRevision,
    discrepancyCount: injected.discrepancies.length,
  });

  return {
    clean,
    injected,
    rollback,
    catalogIntactOnAuthority: catalogPresenceFromDb(args.authorityDb, args.ownerUserId, catalog).ok,
  };
}
