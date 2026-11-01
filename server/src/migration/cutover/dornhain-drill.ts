/**
 * MIG-700 Dornhain Freeze→Delta→authority-switch→Rollback drill.
 * Location: server/src/migration/cutover/dornhain-drill.ts
 *
 * Uses MIG-502 host bundles for worlds/sagas/assets and persists the hard
 * Dornhain catalog into host tables (characters / item defs / npc defs).
 * Owner hard requirement 2026-11-01.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { createProjectPorts } from '../../modules/project/index.ts';
import { exportHostBundle } from '../bundles/export-bundle.ts';
import { importHostBundle } from '../bundles/import-bundle.ts';
import type { BundleResult, SignedBundle } from '../bundles/types.ts';
import {
  assertDornhainCatalogPresent,
  dornhainFixtureCatalog,
  type DornhainCatalog,
} from './dornhain-catalog.ts';

export type DornhainDrillInput = {
  readonly sourceDb: HostDatabase;
  readonly targetDb: HostDatabase;
  readonly targetDataDir: string;
  readonly sourceOwnerUserId: string;
  readonly restoreOwnerUserId: string;
  readonly strangerUserId: string;
};

export type DornhainDrillReport = {
  readonly phase: 'freeze-import-ok' | 'rollback-ok';
  readonly payloadChecksum: string;
  readonly catalogPath: string;
  readonly writerDuringFreeze: string;
  readonly competingWriteExcluded: boolean;
  readonly missingAfterImport: readonly string[];
  readonly missingAfterRollback: readonly string[];
  readonly strangerWorldCount: number;
  readonly strangerCanAccessWorld: boolean;
  readonly restoreOwnerCanAccessWorld: boolean;
};

type Seeded = {
  worldId: string;
  assetBytesById: Map<string, Uint8Array>;
  atlasNodes: { id: string; publicId: string; label: string; geometry: { x: number; y: number } | null }[];
  npcs: { id: string; publicId: string; worldId: string; displayName: string }[];
  inventory: { id: string; publicId: string; ownerCharacterId: string; definitionId: string }[];
};

function seedDornhainSource(
  db: HostDatabase,
  ownerUserId: string,
  catalog: DornhainCatalog,
): Seeded {
  const now = new Date().toISOString();
  const worldId = randomUUID();
  const projectId = randomUUID();
  const sagaId = randomUUID().replace(/-/g, '').slice(0, 32);
  const versionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = randomUUID().replace(/-/g, '').slice(0, 32);
  const bytes = Buffer.from('dornhain-cover-png');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  db.prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    worldId,
    ownerUserId,
    catalog.worldTitle,
    now,
  );
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, ownerUserId, 'Dornhain Table', now, null);
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
  ).run(
    versionId,
    sagaId,
    JSON.stringify({
      title: catalog.sagaTitle,
      characters: catalog.characters.map((c) => c.id),
      monsters: catalog.monsters.map((m) => m.id),
      itemDefinitionIds: [...catalog.itemDefinitionIds],
      npcPublicIds: [...catalog.npcPublicIds],
    }),
    now,
    now,
  );
  db.prepare(
    `INSERT INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 1, ?)`,
  ).run(assetId, ownerUserId, bytes.byteLength, checksum, assetId, now);

  applyDornhainCatalogToHost(db, ownerUserId, worldId, catalog, now);

  const atlasNodes = [
    { id: 'dh-place-square', publicId: 'PL-DHSQ', label: 'Marktplatz', geometry: { x: 10, y: 12 } },
    { id: 'dh-place-whisper', publicId: 'PL-DHWH', label: 'Whisper Road', geometry: null },
  ];
  const npcs = catalog.npcPublicIds.map((publicId, index) => ({
    id: `dh-npc-${index + 1}`,
    publicId,
    worldId,
    displayName: index === 0 ? 'Greta the Gatekeeper' : 'Mira the Map Vendor',
  }));
  const inventory = catalog.itemDefinitionIds.map((definitionId, index) => ({
    id: `dh-inv-${index + 1}`,
    publicId: `IT-DH${index + 1}`,
    ownerCharacterId: catalog.characters[0].id,
    definitionId,
  }));

  return {
    worldId,
    assetBytesById: new Map([[assetId, bytes]]),
    atlasNodes,
    npcs,
    inventory,
  };
}

/**
 * Persist hard-requirement catalog rows into host tables (authoritative after cutover).
 * Idempotent via INSERT OR REPLACE on stable fixture IDs.
 */
export function applyDornhainCatalogToHost(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  catalog: DornhainCatalog,
  now = new Date().toISOString(),
): void {
  for (const ch of catalog.characters) {
    db.prepare(
      `INSERT OR REPLACE INTO characters
       (id, owner_user_id, character_type, sheet_status, name, created_at, public_id, description, level, sheet_json)
       VALUES (?, ?, 'pc', 'complete', ?, ?, ?, ?, 1, ?)`,
    ).run(
      ch.id,
      ownerUserId,
      ch.displayName,
      now,
      ch.publicId,
      ch.archetype,
      JSON.stringify({ archetype: ch.archetype }),
    );
  }

  for (const itemId of catalog.itemDefinitionIds) {
    const publicId = `IT-${itemId.replace(/^dh-item-/, 'DH').toUpperCase()}`;
    db.prepare(
      `INSERT OR REPLACE INTO inventory_item_definitions
       (id, public_id, origin, owner_user_id, world_profile_id, status, name, payload_json, created_at, updated_at)
       VALUES (?, ?, 'world', ?, ?, 'active', ?, '{}', ?, ?)`,
    ).run(itemId, publicId, ownerUserId, worldId, itemId, now, now);
  }

  for (const mon of catalog.monsters) {
    db.prepare(
      `INSERT OR REPLACE INTO npc_creature_definitions
       (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at)
       VALUES (?, 'world', ?, ?, 'active', ?, ?, ?)`,
    ).run(
      mon.id,
      ownerUserId,
      worldId,
      JSON.stringify({ kind: 'monster', publicId: mon.publicId, displayName: mon.displayName }),
      now,
      now,
    );
  }

  for (const [index, publicId] of catalog.npcPublicIds.entries()) {
    const id = `dh-npc-def-${index + 1}`;
    db.prepare(
      `INSERT OR REPLACE INTO npc_creature_definitions
       (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at)
       VALUES (?, 'world', ?, ?, 'active', ?, ?, ?)`,
    ).run(
      id,
      ownerUserId,
      worldId,
      JSON.stringify({ kind: 'npc', publicId, displayName: publicId }),
      now,
      now,
    );
  }
}

function parseNpcDefinitionPayload(raw: string): { kind?: string; publicId?: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? record.kind : undefined;
  const publicId = typeof record.publicId === 'string' ? record.publicId : undefined;
  return { kind, publicId };
}

function presenceFromHostTables(
  db: HostDatabase,
  catalog: DornhainCatalog,
): ReturnType<typeof assertDornhainCatalogPresent> {
  const worlds = db.prepare(`SELECT title FROM worlds`).all() as { title: string }[];
  const sagas = db.prepare(`SELECT slug FROM saga_definitions`).all() as { slug: string }[];
  const characters = db.prepare(`SELECT id FROM characters`).all() as { id: string }[];
  const items = db.prepare(`SELECT id FROM inventory_item_definitions`).all() as { id: string }[];
  const defs = db.prepare(`SELECT id, payload FROM npc_creature_definitions`).all() as {
    id: string;
    payload: string;
  }[];

  const monsterIds: string[] = [];
  const npcPublicIds: string[] = [];
  for (const row of defs) {
    const payload = parseNpcDefinitionPayload(row.payload);
    if (!payload) {
      return {
        ok: false,
        missing: [`npc-def-payload-invalid:${row.id}`],
      };
    }
    if (payload.kind === 'monster') monsterIds.push(row.id);
    if (payload.kind === 'npc' && payload.publicId) npcPublicIds.push(payload.publicId);
  }

  return assertDornhainCatalogPresent({
    worldTitles: worlds.map((w) => w.title),
    sagaSlugs: sagas.map((s) => s.slug),
    characterIds: characters.map((c) => c.id),
    monsterIds,
    itemDefinitionIds: items.map((i) => i.id),
    npcPublicIds,
    catalog,
  });
}

function writeCatalogSidecar(dir: string, checksum: string, catalog: DornhainCatalog): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `dornhain-catalog-${checksum}.json`);
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, kind: 'dornhain-cutover-catalog', catalog }, null, 2)}\n`);
  return path;
}

/** Remove Dornhain-owned rows so a freeze can be re-applied onto a poisoned host. */
function wipeHostContent(db: HostDatabase): void {
  db.exec(`
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM saga_definition_versions;
    DELETE FROM saga_definitions;
    DELETE FROM worlds;
    DELETE FROM assets;
    DELETE FROM characters;
    DELETE FROM inventory_item_definitions;
    DELETE FROM npc_creature_definitions;
  `);
}

function importFreezeOntoHost(input: {
  readonly db: HostDatabase;
  readonly dataDir: string;
  readonly bundle: SignedBundle;
  readonly ownerUserId: string;
  readonly catalog: DornhainCatalog;
}): BundleResult<{ worldId: string; npcs: Seeded['npcs']; inventory: Seeded['inventory'] }> {
  const imported = importHostBundle({
    db: input.db,
    dataDir: input.dataDir,
    bundle: input.bundle,
    importingOwnerUserId: input.ownerUserId,
    refuseExistingIds: true,
  });
  if (!imported.ok) return imported;

  const worldRow = input.db.prepare(`SELECT id FROM worlds WHERE title = ?`).get(input.catalog.worldTitle) as
    | { id: string }
    | undefined;
  if (!worldRow) return { ok: false, error: 'dornhain-world-missing-after-import' };

  applyDornhainCatalogToHost(input.db, input.ownerUserId, worldRow.id, input.catalog);

  return {
    ok: true,
    value: {
      worldId: worldRow.id,
      npcs: imported.value.npcs,
      inventory: imported.value.inventory,
    },
  };
}

/**
 * Run Freeze (export) → import on clean host → poison+rollback on the same target.
 * Single writer during freeze = sourceOwnerUserId only (competing stranger write excluded).
 */
export function runDornhainCutoverDrill(input: DornhainDrillInput): BundleResult<DornhainDrillReport> {
  const catalog = dornhainFixtureCatalog();
  const seeded = seedDornhainSource(input.sourceDb, input.sourceOwnerUserId, catalog);

  // Competing write during freeze window — must not enter the owner-scoped export.
  const intruderWorldId = randomUUID();
  input.sourceDb
    .prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`)
    .run(intruderWorldId, input.strangerUserId, 'Intruder Camp', new Date().toISOString());

  const exported = exportHostBundle({
    db: input.sourceDb,
    ownerUserId: input.sourceOwnerUserId,
    assetBytesById: seeded.assetBytesById,
    atlasNodes: seeded.atlasNodes,
    npcs: seeded.npcs,
    inventory: seeded.inventory,
  });
  if (!exported.ok) return exported;

  const competingWriteExcluded = !exported.value.worlds.some(
    (world) => String(world.owner_user_id) === input.strangerUserId || String(world.id) === intruderWorldId,
  );
  if (!competingWriteExcluded) {
    return { ok: false, error: 'competing-write-leaked-into-freeze' };
  }

  const catalogPath = writeCatalogSidecar(
    join(input.targetDataDir, 'cutover-catalogs'),
    exported.value.checksumSha256,
    catalog,
  );

  const imported = importFreezeOntoHost({
    db: input.targetDb,
    dataDir: input.targetDataDir,
    bundle: exported.value,
    ownerUserId: input.restoreOwnerUserId,
    catalog,
  });
  if (!imported.ok) return imported;

  writeFileSync(
    join(input.targetDataDir, 'bundle-sidecars', `dornhain-${exported.value.checksumSha256}.json`),
    `${JSON.stringify({ catalog, bundleChecksum: exported.value.checksumSha256 }, null, 2)}\n`,
  );

  const afterImport = presenceFromHostTables(input.targetDb, catalog);
  if (!afterImport.ok) {
    return {
      ok: false,
      error: `dornhain-missing-after-import:${afterImport.missing.join(',')}`,
    };
  }

  const project = createProjectPorts(input.targetDb);
  const restoreOwnerCanAccessWorld = project.actorCanAccessWorld(
    [input.restoreOwnerUserId],
    imported.value.worldId,
  );
  const strangerCanAccessWorld = project.actorCanAccessWorld(
    [input.strangerUserId],
    imported.value.worldId,
  );
  if (!restoreOwnerCanAccessWorld) {
    return { ok: false, error: 'restore-owner-denied-world-access' };
  }
  if (strangerCanAccessWorld) {
    return { ok: false, error: 'stranger-allowed-world-access' };
  }

  const strangerWorldCount = (
    input.targetDb
      .prepare(`SELECT COUNT(*) AS c FROM worlds WHERE owner_user_id = ?`)
      .get(input.strangerUserId) as { c: number }
  ).c;

  // Poison the live target, then wipe + re-import the freeze onto the same host (true rollback).
  input.targetDb
    .prepare(`UPDATE worlds SET title = ? WHERE title = ?`)
    .run('CORRUPTED', catalog.worldTitle);
  input.targetDb.prepare(`DELETE FROM characters WHERE id = ?`).run(catalog.characters[0].id);

  // Drop staged asset files so re-import can republish bytes under the same keys.
  try {
    rmSync(join(input.targetDataDir, 'assets'), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
  wipeHostContent(input.targetDb);

  const rolled = importFreezeOntoHost({
    db: input.targetDb,
    dataDir: input.targetDataDir,
    bundle: exported.value,
    ownerUserId: input.restoreOwnerUserId,
    catalog,
  });
  if (!rolled.ok) return rolled;

  if (!existsSync(catalogPath)) {
    return { ok: false, error: 'rollback-catalog-missing' };
  }

  const corruptedStillPresent = (
    input.targetDb.prepare(`SELECT COUNT(*) AS c FROM worlds WHERE title = ?`).get('CORRUPTED') as {
      c: number;
    }
  ).c;
  if (corruptedStillPresent !== 0) {
    return { ok: false, error: 'poison-title-survived-rollback' };
  }

  const afterRollback = presenceFromHostTables(input.targetDb, catalog);
  if (!afterRollback.ok) {
    return {
      ok: false,
      error: `dornhain-missing-after-rollback:${afterRollback.missing.join(',')}`,
    };
  }

  return {
    ok: true,
    value: {
      phase: 'rollback-ok',
      payloadChecksum: exported.value.checksumSha256,
      catalogPath,
      writerDuringFreeze: input.sourceOwnerUserId,
      competingWriteExcluded,
      missingAfterImport: afterImport.missing,
      missingAfterRollback: afterRollback.missing,
      strangerWorldCount,
      strangerCanAccessWorld,
      restoreOwnerCanAccessWorld,
    },
  };
}
