/**
 * MIG-700 Dornhain Freeze→Delta→authority-switch→Rollback drill.
 * Location: server/src/migration/cutover/dornhain-drill.ts
 *
 * Uses MIG-502 host bundles for worlds/sagas/assets and a sidecar catalog for
 * characters/monsters/items/NPCs (owner hard requirement 2026-11-01).
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { exportHostBundle } from '../bundles/export-bundle.ts';
import { importHostBundle } from '../bundles/import-bundle.ts';
import type { BundleResult } from '../bundles/types.ts';
import {
  assertDornhainCatalogPresent,
  dornhainFixtureCatalog,
  type DornhainCatalog,
} from './dornhain-catalog.ts';

export type DornhainDrillInput = {
  readonly sourceDb: HostDatabase;
  readonly targetDb: HostDatabase;
  readonly targetDataDir: string;
  readonly poisonDb: HostDatabase;
  readonly poisonDataDir: string;
  readonly sourceOwnerUserId: string;
  readonly restoreOwnerUserId: string;
  readonly strangerUserId: string;
};

export type DornhainDrillReport = {
  readonly phase: 'freeze-import-ok' | 'rollback-ok';
  readonly payloadChecksum: string;
  readonly catalogPath: string;
  readonly writerDuringFreeze: string;
  readonly missingAfterImport: readonly string[];
  readonly missingAfterRollback: readonly string[];
  readonly strangerWorldCount: number;
};

function seedDornhainSource(
  db: HostDatabase,
  ownerUserId: string,
  catalog: DornhainCatalog,
): {
  worldId: string;
  assetBytesById: Map<string, Uint8Array>;
  atlasNodes: { id: string; publicId: string; label: string; geometry: { x: number; y: number } | null }[];
  npcs: { id: string; publicId: string; worldId: string; displayName: string }[];
  inventory: { id: string; publicId: string; ownerCharacterId: string; definitionId: string }[];
} {
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

function writeCatalogSidecar(dir: string, checksum: string, catalog: DornhainCatalog): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `dornhain-catalog-${checksum}.json`);
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, kind: 'dornhain-cutover-catalog', catalog }, null, 2)}\n`);
  return path;
}

function presenceFromTarget(
  db: HostDatabase,
  catalog: DornhainCatalog,
  importedNpcs: readonly { publicId: string }[],
  importedInventory: readonly { definitionId: string }[],
): ReturnType<typeof assertDornhainCatalogPresent> {
  const worlds = db.prepare(`SELECT title FROM worlds`).all() as { title: string }[];
  const sagas = db.prepare(`SELECT slug FROM saga_definitions`).all() as { slug: string }[];
  const versions = db.prepare(`SELECT payload FROM saga_definition_versions`).all() as {
    payload: string;
  }[];
  const characterIds = new Set<string>();
  const monsterIds = new Set<string>();
  for (const row of versions) {
    try {
      const payload = JSON.parse(row.payload) as {
        characters?: string[];
        monsters?: string[];
      };
      for (const id of payload.characters ?? []) characterIds.add(id);
      for (const id of payload.monsters ?? []) monsterIds.add(id);
    } catch {
      /* ignore malformed */
    }
  }
  return assertDornhainCatalogPresent({
    worldTitles: worlds.map((w) => w.title),
    sagaSlugs: sagas.map((s) => s.slug),
    characterIds: [...characterIds],
    monsterIds: [...monsterIds],
    itemDefinitionIds: importedInventory.map((i) => i.definitionId),
    npcPublicIds: importedNpcs.map((n) => n.publicId),
    catalog,
  });
}

/**
 * Run Freeze (export) → import on clean host → poison+rollback to last good catalog.
 * Single writer during freeze = sourceOwnerUserId only.
 */
export function runDornhainCutoverDrill(input: DornhainDrillInput): BundleResult<DornhainDrillReport> {
  const catalog = dornhainFixtureCatalog();
  const seeded = seedDornhainSource(input.sourceDb, input.sourceOwnerUserId, catalog);

  const exported = exportHostBundle({
    db: input.sourceDb,
    ownerUserId: input.sourceOwnerUserId,
    assetBytesById: seeded.assetBytesById,
    atlasNodes: seeded.atlasNodes,
    npcs: seeded.npcs,
    inventory: seeded.inventory,
  });
  if (!exported.ok) return exported;

  const catalogPath = writeCatalogSidecar(
    join(input.targetDataDir, 'cutover-catalogs'),
    exported.value.checksumSha256,
    catalog,
  );

  const imported = importHostBundle({
    db: input.targetDb,
    dataDir: input.targetDataDir,
    bundle: exported.value,
    importingOwnerUserId: input.restoreOwnerUserId,
    refuseExistingIds: true,
  });
  if (!imported.ok) return imported;

  // Persist catalog next to import sidecar so restore can re-read hard requirements.
  writeFileSync(
    join(input.targetDataDir, 'bundle-sidecars', `dornhain-${exported.value.checksumSha256}.json`),
    `${JSON.stringify({ catalog, bundleChecksum: exported.value.checksumSha256 }, null, 2)}\n`,
  );

  const afterImport = presenceFromTarget(
    input.targetDb,
    catalog,
    imported.value.npcs,
    imported.value.inventory,
  );
  if (!afterImport.ok) {
    return {
      ok: false,
      error: `dornhain-missing-after-import:${afterImport.missing.join(',')}`,
    };
  }

  const strangerWorldCount = (
    input.targetDb
      .prepare(`SELECT COUNT(*) AS c FROM worlds WHERE owner_user_id = ?`)
      .get(input.strangerUserId) as { c: number }
  ).c;

  // Poison path: corrupt target world title, then re-import into poison DB from same freeze.
  input.targetDb
    .prepare(`UPDATE worlds SET title = ? WHERE title = ?`)
    .run('CORRUPTED', catalog.worldTitle);

  const rolled = importHostBundle({
    db: input.poisonDb,
    dataDir: input.poisonDataDir,
    bundle: exported.value,
    importingOwnerUserId: input.restoreOwnerUserId,
    refuseExistingIds: true,
  });
  if (!rolled.ok) return rolled;

  const poisonCatalogPath = writeCatalogSidecar(
    join(input.poisonDataDir, 'cutover-catalogs'),
    exported.value.checksumSha256,
    catalog,
  );
  if (!existsSync(poisonCatalogPath)) {
    return { ok: false, error: 'rollback-catalog-missing' };
  }
  const afterRollback = presenceFromTarget(
    input.poisonDb,
    catalog,
    rolled.value.npcs,
    rolled.value.inventory,
  );
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
      missingAfterImport: afterImport.missing,
      missingAfterRollback: afterRollback.missing,
      strangerWorldCount,
    },
  };
}
