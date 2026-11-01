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

function assertOk(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const PARITY_META_TABLE = 'mig701_parity_meta';

const worldRowSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });
const sagaRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  draft_revision: z.union([z.number(), z.bigint()]).transform((v) => Number(v)),
});
const characterRowSchema = z.object({
  id: z.string().min(1),
  public_id: z.string().nullable(),
  name: z.string().min(1),
  sheet_status: z.string().min(1),
  level: z.union([z.number(), z.bigint(), z.null()]).transform((v) => (v == null ? null : Number(v))),
  sheet_json: z.string().nullable(),
  description: z.string().nullable(),
});
const defRowSchema = z.object({ id: z.string().min(1), payload: z.string().min(1) });
const npcPayloadSchema = z.object({
  kind: z.enum(['npc', 'monster']),
  publicId: z.string().min(1).optional(),
  displayName: z.string().optional(),
});
const itemRowSchema = z.object({
  id: z.string().min(1),
  public_id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  payload_json: z.string().nullable(),
});
const assetRowSchema = z.object({
  id: z.string().min(1),
  checksum_sha256: z.string().min(1),
  published: z.union([z.number(), z.bigint()]).transform((v) => Number(v)),
  byte_size: z.union([z.number(), z.bigint()]).transform((v) => Number(v)),
});
const metaRowSchema = z.object({
  confirmed_revision: z.union([z.number(), z.bigint()]).transform((v) => Number(v)),
});

const projectionRowSchema = z.object({
  recordKey: z.string().min(1),
  recordId: z.string().min(1),
  kind: z.enum(['world', 'saga', 'character', 'monster', 'item', 'npc', 'asset']),
  revision: z.number().int().nonnegative(),
  digest: z.string().min(1),
});

export type ProjectionRow = z.infer<typeof projectionRowSchema>;

export type ParityDiscrepancy = {
  readonly recordKey: string;
  readonly recordId: string;
  readonly kind: ProjectionRow['kind'];
  readonly revision: number;
  readonly discrepancyKind:
    | 'missing-on-shadow'
    | 'missing-on-authority'
    | 'digest-mismatch'
    | 'revision-mismatch'
    | 'empty-snapshot';
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

function recordKey(kind: ProjectionRow['kind'], recordId: string): string {
  return `${kind}:${recordId}`;
}

function ensureParityMeta(db: HostDatabase): void {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS ${PARITY_META_TABLE} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      confirmed_revision INTEGER NOT NULL
    )`,
  ).run();
}

export function readConfirmedRevision(db: HostDatabase): number {
  ensureParityMeta(db);
  const row = db.prepare(`SELECT confirmed_revision FROM ${PARITY_META_TABLE} WHERE id = 1`).get();
  const parsed = metaRowSchema.safeParse(row);
  if (!parsed.success) throw new Error('parity-window: confirmed revision missing on host');
  return parsed.data.confirmed_revision;
}

export function writeConfirmedRevision(db: HostDatabase, revision: number): void {
  ensureParityMeta(db);
  db.prepare(
    `INSERT INTO ${PARITY_META_TABLE} (id, confirmed_revision) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET confirmed_revision = excluded.confirmed_revision`,
  ).run(revision);
}

function businessFingerprint(db: HostDatabase, ownerUserId: string): string {
  const parts: string[] = [
    JSON.stringify(db.prepare(`SELECT * FROM ${PARITY_META_TABLE}`).all()),
  ];
  for (const sql of [
    `SELECT id, title FROM worlds WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, slug, title, draft_revision FROM saga_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, public_id, name, sheet_status, level, sheet_json, description FROM characters WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, public_id, name, status, payload_json FROM inventory_item_definitions WHERE owner_user_id = ? ORDER BY id`,
    `SELECT id, checksum_sha256, published, byte_size FROM assets WHERE owner_user_id = ? ORDER BY id`,
  ]) {
    parts.push(JSON.stringify(db.prepare(sql).all(ownerUserId)));
  }
  return digestPayload(parts);
}

function parseRows<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`parity-window: ${label} row ${index} invalid: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}

/**
 * Build a revision-pinned projection snapshot (SELECT only).
 * Revision comes from host meta — never stamped from a caller guess alone.
 */
export function captureParitySnapshot(db: HostDatabase, ownerUserId: string): ProjectionRow[] {
  const confirmedRevision = readConfirmedRevision(db);
  const rows: ProjectionRow[] = [];

  for (const world of parseRows(
    worldRowSchema,
    db.prepare(`SELECT id, title FROM worlds WHERE owner_user_id = ? ORDER BY id`).all(ownerUserId) as unknown[],
    'world',
  )) {
    rows.push({
      recordKey: recordKey('world', world.id),
      recordId: world.id,
      kind: 'world',
      revision: confirmedRevision,
      digest: digestPayload({ title: world.title }),
    });
  }

  for (const saga of parseRows(
    sagaRowSchema,
    db
      .prepare(
        `SELECT id, slug, title, draft_revision FROM saga_definitions WHERE owner_user_id = ? ORDER BY id`,
      )
      .all(ownerUserId) as unknown[],
    'saga',
  )) {
    rows.push({
      recordKey: recordKey('saga', saga.id),
      recordId: saga.id,
      kind: 'saga',
      revision: confirmedRevision,
      digest: digestPayload({
        slug: saga.slug,
        title: saga.title,
        draftRevision: saga.draft_revision,
      }),
    });
  }

  for (const character of parseRows(
    characterRowSchema,
    db
      .prepare(
        `SELECT id, public_id, name, sheet_status, level, sheet_json, description
         FROM characters WHERE owner_user_id = ? ORDER BY id`,
      )
      .all(ownerUserId) as unknown[],
    'character',
  )) {
    rows.push({
      recordKey: recordKey('character', character.id),
      recordId: character.id,
      kind: 'character',
      revision: confirmedRevision,
      digest: digestPayload({
        publicId: character.public_id,
        name: character.name,
        sheetStatus: character.sheet_status,
        level: character.level,
        sheetJson: character.sheet_json,
        description: character.description,
      }),
    });
  }

  for (const def of parseRows(
    defRowSchema,
    db
      .prepare(
        `SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ? ORDER BY id`,
      )
      .all(ownerUserId) as unknown[],
    'npc_def',
  )) {
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(def.payload);
    } catch {
      throw new Error(`parity-window: npc payload JSON invalid for ${def.id}`);
    }
    const payload = npcPayloadSchema.safeParse(rawPayload);
    if (!payload.success) {
      throw new Error(`parity-window: npc payload invalid for ${def.id}`);
    }
    const kind = payload.data.kind === 'monster' ? 'monster' : 'npc';
    rows.push({
      recordKey: recordKey(kind, def.id),
      recordId: def.id,
      kind,
      revision: confirmedRevision,
      digest: digestPayload({ payload: def.payload }),
    });
  }

  for (const item of parseRows(
    itemRowSchema,
    db
      .prepare(
        `SELECT id, public_id, name, status, payload_json
         FROM inventory_item_definitions WHERE owner_user_id = ? ORDER BY id`,
      )
      .all(ownerUserId) as unknown[],
    'item',
  )) {
    rows.push({
      recordKey: recordKey('item', item.id),
      recordId: item.id,
      kind: 'item',
      revision: confirmedRevision,
      digest: digestPayload({
        publicId: item.public_id,
        name: item.name,
        status: item.status,
        payloadJson: item.payload_json,
      }),
    });
  }

  for (const asset of parseRows(
    assetRowSchema,
    db
      .prepare(
        `SELECT id, checksum_sha256, published, byte_size
         FROM assets WHERE owner_user_id = ? ORDER BY id`,
      )
      .all(ownerUserId) as unknown[],
    'asset',
  )) {
    rows.push({
      recordKey: recordKey('asset', asset.id),
      recordId: asset.id,
      kind: 'asset',
      revision: confirmedRevision,
      digest: digestPayload({
        checksum: asset.checksum_sha256,
        published: asset.published,
        byteSize: asset.byte_size,
      }),
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

  if (authority.length === 0 || shadow.length === 0) {
    discrepancies.push({
      recordKey: 'snapshot:empty',
      recordId: 'snapshot',
      kind: 'world',
      revision: confirmedRevision,
      discrepancyKind: 'empty-snapshot',
    });
  }

  const authByKey = new Map(authority.map((row) => [row.recordKey, row]));
  const shadowByKey = new Map(shadow.map((row) => [row.recordKey, row]));

  for (const [key, auth] of authByKey) {
    const sh = shadowByKey.get(key);
    if (!sh) {
      discrepancies.push({
        recordKey: key,
        recordId: auth.recordId,
        kind: auth.kind,
        revision: confirmedRevision,
        discrepancyKind: 'missing-on-shadow',
        authorityDigest: auth.digest,
      });
      continue;
    }
    if (
      auth.revision !== confirmedRevision ||
      sh.revision !== confirmedRevision ||
      auth.revision !== sh.revision
    ) {
      discrepancies.push({
        recordKey: key,
        recordId: auth.recordId,
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
        recordKey: key,
        recordId: auth.recordId,
        kind: auth.kind,
        revision: confirmedRevision,
        discrepancyKind: 'digest-mismatch',
        authorityDigest: auth.digest,
        shadowDigest: sh.digest,
      });
    }
  }
  for (const [key, sh] of shadowByKey) {
    if (!authByKey.has(key)) {
      discrepancies.push({
        recordKey: key,
        recordId: sh.recordId,
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
  const row = characterRowSchema.parse(
    db
      .prepare(
        `SELECT id, public_id, name, sheet_status, level, sheet_json, description
         FROM characters WHERE owner_user_id = ? ORDER BY id LIMIT 1`,
      )
      .get(ownerUserId),
  );
  db.prepare(`UPDATE characters SET name = ? WHERE id = ?`).run(`${row.name}__PARITY_POISON`, row.id);
  return row.id;
}

/** Fixture clone: disable FK temporarily so dependent product tables cannot block the drill. */
function cloneAuthorityIntoShadow(authority: HostDatabase, shadow: HostDatabase): void {
  const tables = (
    authority
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[]
  ).map((r) => r.name);

  shadow.prepare(`PRAGMA foreign_keys = OFF`).run();
  authority.prepare(`PRAGMA foreign_keys = OFF`).run();
  try {
    shadow.prepare(`BEGIN`).run();
    for (const table of tables) {
      shadow.prepare(`DELETE FROM ${table}`).run();
    }
    for (const table of tables) {
      const rows = authority.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.length === 0) continue;
        const placeholders = keys.map(() => '?').join(', ');
        shadow
          .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
          .run(...keys.map((key) => row[key]));
      }
    }
    shadow.prepare(`COMMIT`).run();
  } catch (error) {
    try {
      shadow.prepare(`ROLLBACK`).run();
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    shadow.prepare(`PRAGMA foreign_keys = ON`).run();
    authority.prepare(`PRAGMA foreign_keys = ON`).run();
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
  const worldTitles = parseRows(
    worldRowSchema,
    db.prepare(`SELECT id, title FROM worlds WHERE owner_user_id = ?`).all(ownerUserId) as unknown[],
    'world',
  ).map((r) => r.title);
  const sagaSlugs = parseRows(
    sagaRowSchema,
    db
      .prepare(
        `SELECT id, slug, title, draft_revision FROM saga_definitions WHERE owner_user_id = ?`,
      )
      .all(ownerUserId) as unknown[],
    'saga',
  ).map((r) => r.slug);
  const characterIds = parseRows(
    characterRowSchema,
    db
      .prepare(
        `SELECT id, public_id, name, sheet_status, level, sheet_json, description
         FROM characters WHERE owner_user_id = ?`,
      )
      .all(ownerUserId) as unknown[],
    'character',
  ).map((r) => r.id);
  const defRows = parseRows(
    defRowSchema,
    db
      .prepare(`SELECT id, payload FROM npc_creature_definitions WHERE owner_user_id = ?`)
      .all(ownerUserId) as unknown[],
    'npc_def',
  );
  const monsterIds: string[] = [];
  const npcPublicIds: string[] = [];
  for (const def of defRows) {
    const payload = npcPayloadSchema.parse(JSON.parse(def.payload));
    if (payload.kind === 'monster') monsterIds.push(def.id);
    if (payload.kind === 'npc' && payload.publicId) npcPublicIds.push(payload.publicId);
  }
  const itemDefinitionIds = parseRows(
    itemRowSchema,
    db
      .prepare(
        `SELECT id, public_id, name, status, payload_json FROM inventory_item_definitions WHERE owner_user_id = ?`,
      )
      .all(ownerUserId) as unknown[],
    'item',
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
 * Cutover migration module intentionally writes host tables (same pattern as MIG-700).
 */
export function seedDornhainParityAuthority(
  db: HostDatabase,
  ownerUserId: string,
  confirmedRevision: number,
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
     VALUES (?, ?, ?, '', 'user', ?, ?, ?, ?)`,
  ).run(sagaId, catalog.sagaSlug, catalog.sagaTitle, ownerUserId, confirmedRevision, now, now);
  db.prepare(
    `INSERT INTO saga_definition_versions
     (id, saga_id, version_label, status, payload, published_at, created_at)
     VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
  ).run(versionId, sagaId, JSON.stringify({ title: catalog.sagaTitle }), now, now);
  // Unpublished until bytes exist on disk — fixture only needs checksum parity.
  db.prepare(
    `INSERT INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 0, ?)`,
  ).run(assetId, ownerUserId, bytes.byteLength, checksum, assetId, now);
  applyDornhainCatalogToHost(db, ownerUserId, worldId, catalog, now);
  writeConfirmedRevision(db, confirmedRevision);
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
  readonly responsibleDecision?: string;
}): ParityWindowReport {
  const catalog = dornhainFixtureCatalog();
  const startedAt = new Date();
  const confirmedRevision = readConfirmedRevision(args.authorityDb);

  cloneAuthorityIntoShadow(args.authorityDb, args.shadowDb);
  assertOk(
    readConfirmedRevision(args.shadowDb) === confirmedRevision,
    'shadow must inherit confirmed revision meta',
  );

  const authorityBefore = businessFingerprint(args.authorityDb, args.ownerUserId);
  const shadowBefore = businessFingerprint(args.shadowDb, args.ownerUserId);

  const authoritySnap = captureParitySnapshot(args.authorityDb, args.ownerUserId);
  const shadowClean = captureParitySnapshot(args.shadowDb, args.ownerUserId);

  if (
    businessFingerprint(args.authorityDb, args.ownerUserId) !== authorityBefore ||
    businessFingerprint(args.shadowDb, args.ownerUserId) !== shadowBefore
  ) {
    throw new Error('parity-window: clean compare must be read-only on both sides');
  }

  const clean = {
    ...compareParitySnapshots(authoritySnap, shadowClean, confirmedRevision),
    shadowWroteBusinessState: false,
  };
  if (!clean.shutdownPredecessorMet) {
    throw new Error('parity-window: clean clone must compare equal');
  }
  if (clean.authorityRecordCount < 1) {
    throw new Error('parity-window: authority snapshot must be non-empty');
  }

  const poisonedId = injectShadowDigestMismatch(args.shadowDb, args.ownerUserId);
  const injected = {
    ...compareParitySnapshots(
      authoritySnap,
      captureParitySnapshot(args.shadowDb, args.ownerUserId),
      confirmedRevision,
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
    captureParitySnapshot(args.shadowDb, args.ownerUserId),
    confirmedRevision,
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
    confirmedRevision,
    discrepancyCount: injected.discrepancies.length,
  });

  return {
    clean,
    injected,
    rollback,
    catalogIntactOnAuthority: catalogPresenceFromDb(args.authorityDb, args.ownerUserId, catalog).ok,
  };
}
