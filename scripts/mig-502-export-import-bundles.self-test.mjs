#!/usr/bin/env node
/**
 * mig-502-export-import-bundles.self-test — export/import + restore drill (#843).
 * Location: scripts/mig-502-export-import-bundles.self-test.mjs
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const bundlesUrl = pathToFileURL(join(root, 'server/src/migration/bundles/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const {
  exportHostBundle,
  importHostBundle,
  validateBundleStructure,
  runRestoreDrill,
  signBundle,
  BUNDLE_FORMAT_VERSION,
} = await import(bundlesUrl);

function boot(label) {
  const work = mkdtempSync(join(tmpdir(), `mig502-${label}-`));
  const dataDir = join(work, 'data');
  mkdirSync(dataDir);
  const result = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(result.ok, `bootstrap ${label}: ${result.ok ? '' : result.error}`);
  return { work, db: result.db };
}

const OWNER = 'owner-o';
const STRANGER = 'stranger-x';
const RESTORE = 'restore-r';

const source = boot('src');
const target = boot('dst');
const poison = boot('poison');

try {
  const db = source.db;
  const now = new Date().toISOString();
  const worldId = randomUUID();
  const projectId = randomUUID();
  const sagaId = randomUUID().replace(/-/g, '').slice(0, 32);
  const versionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = randomUUID().replace(/-/g, '').slice(0, 32);
  const bytes = Buffer.from('atlas-png-bytes');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER, 'Export World', now);
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, OWNER, 'Export Project', now, null);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, 'gm', 1, ?)`,
  ).run(projectId, OWNER, now);
  db.prepare(
    `INSERT INTO saga_definitions
     (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
     VALUES (?, ?, ?, '', 'user', ?, 0, ?, ?)`,
  ).run(sagaId, `user.${sagaId}`, 'Export Saga', OWNER, now, now);
  db.prepare(
    `INSERT INTO saga_definition_versions
     (id, saga_id, version_label, status, payload, published_at, created_at)
     VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
  ).run(versionId, sagaId, JSON.stringify({ title: 'Export Saga' }), now, now);
  db.prepare(
    `INSERT INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 1, ?)`,
  ).run(assetId, OWNER, bytes.byteLength, checksum, assetId, now);

  const atlasNodes = [
    { id: 'place-1', publicId: 'PL-1', label: 'Dorf', geometry: { x: 1, y: 2 } },
    { id: 'place-2', publicId: 'PL-2', label: 'Ruine', geometry: null },
  ];
  const npcs = [{ id: 'npc-1', publicId: 'NPCC-1', worldId, displayName: 'Wächter' }];
  const inventory = [
    { id: 'inv-1', publicId: 'IT-1', ownerCharacterId: 'ch-1', definitionId: 'def-1' },
  ];
  const assetBytesById = new Map([[assetId, bytes]]);

  // --- Fall 1: round-trip preserves ids / hashes; missing geometry reported ---
  const exported = exportHostBundle({
    db,
    ownerUserId: OWNER,
    assetBytesById,
    atlasNodes,
    npcs,
    inventory,
  });
  assert(exported.ok, `export: ${exported.ok ? '' : exported.error}`);
  assert(exported.value.worlds[0].id === worldId, 'world id');
  assert(exported.value.assets[0].checksumSha256 === checksum, 'asset hash');
  assert(exported.value.npcs[0].publicId === 'NPCC-1', 'npc public id');
  assert(exported.value.inventory[0].publicId === 'IT-1', 'item public id');
  assert(
    exported.value.missingAtlasGeometryIds.includes('place-2'),
    'missing geometry reported',
  );
  assert(!exported.value.atlasNodes.find((n) => n.id === 'place-2')?.geometry, 'geometry not invented');

  const imported = importHostBundle({
    db: target.db,
    bundle: exported.value,
    importingOwnerUserId: RESTORE,
  });
  assert(imported.ok, `import: ${imported.ok ? '' : imported.error}`);
  assert(imported.value.missingAtlasGeometryIds.includes('place-2'), 'import reports missing');
  const restoredWorld = target.db.prepare(`SELECT owner_user_id FROM worlds WHERE id = ?`).get(worldId);
  assert(restoredWorld.owner_user_id === RESTORE, 'owner remapped on restore');
  const restoredAsset = target.db
    .prepare(`SELECT checksum_sha256 FROM assets WHERE id = ?`)
    .get(assetId);
  assert(restoredAsset.checksum_sha256 === checksum, 'asset hash preserved');

  // --- Fall 2: bad version / traversal / checksum abort with no partial data ---
  const badVersion = { ...exported.value, formatVersion: 999 };
  const v = validateBundleStructure(badVersion);
  assert(!v.ok && v.error === 'unsupported-format-version', `bad version: ${v.error}`);

  const traversal = {
    ...exported.value,
    assetBytes: { '../etc/passwd': Buffer.from('x').toString('base64') },
    assets: [
      {
        id: 'evil',
        ownerUserId: OWNER,
        contentType: 'text/plain',
        byteSize: 1,
        checksumSha256: createHash('sha256').update('x').digest('hex'),
        storageKey: '../etc/passwd',
      },
    ],
  };
  // re-sign would change checksum — validate path before checksum on structure
  const trav = validateBundleStructure({ ...traversal, checksumSha256: 'deadbeef'.repeat(8) });
  assert(!trav.ok && trav.error === 'path-traversal-denied', `traversal: ${trav.error}`);

  const tampered = signBundle({
    ...exported.value,
    worlds: [...exported.value.worlds, { id: 'extra', owner_user_id: OWNER, title: 'X', created_at: now }],
  });
  // Break checksum intentionally
  tampered.checksumSha256 = '0'.repeat(64);
  const beforePoison = poison.db.prepare(`SELECT COUNT(*) AS c FROM worlds`).get().c;
  const badImport = importHostBundle({
    db: poison.db,
    bundle: tampered,
    importingOwnerUserId: RESTORE,
  });
  assert(!badImport.ok && badImport.error === 'checksum-mismatch', `checksum: ${badImport.error}`);
  const afterPoison = poison.db.prepare(`SELECT COUNT(*) AS c FROM worlds`).get().c;
  assert(afterPoison === beforePoison, 'no partial worlds after checksum fail');

  // Foreign overwrite denied
  const overwrite = importHostBundle({
    db: target.db,
    bundle: exported.value,
    importingOwnerUserId: STRANGER,
  });
  assert(!overwrite.ok && overwrite.error === 'foreign-overwrite-denied', `overwrite: ${overwrite.error}`);

  // --- Fall 3: restore drill on empty host — ownership negatives + checksums ---
  const fresh = boot('fresh');
  try {
    const drill = runRestoreDrill({
      sourceDb: db,
      targetDb: fresh.db,
      sourceOwnerUserId: OWNER,
      restoreOwnerUserId: RESTORE,
      strangerUserId: STRANGER,
      assetBytesById,
      atlasNodes,
      npcs,
      inventory,
    });
    assert(drill.ok, `drill: ${drill.ok ? '' : drill.error}`);
    assert(drill.value.ownerWorldCount === 1, 'owner worlds');
    assert(drill.value.strangerWorldCount === 0, 'stranger owns nothing');
    assert(
      typeof drill.value.payloadChecksum === 'string' && drill.value.payloadChecksum.length === 64,
      'payload checksum present',
    );
    // Fresh export gets a new exportedAt — drill still verifies import of that signed payload.
    assert(drill.value.missingAtlasGeometryIds.includes('place-2'), 'drill missing geometry');
    assert(typeof drill.value.worldChecksum === 'string' && drill.value.worldChecksum.length === 64, 'world checksum');
    assert(BUNDLE_FORMAT_VERSION === 1, 'format version pinned');
  } finally {
    rmSync(fresh.work, { recursive: true, force: true });
  }

  console.log('PASS mig-502-export-import-bundles.self-test');
} finally {
  for (const b of [source, target, poison]) {
    try {
      rmSync(b.work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
