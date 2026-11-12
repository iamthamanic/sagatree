#!/usr/bin/env node
/**
 * ATL2-B03 — atomic owner-scoped atlas revisions / CAS.
 * Location: scripts/atl2-b03-atomic-revisions.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const contract = jiti(join(repoRoot, 'src/domains/world/atlas/atlas-revision-contract.ts'));
const canvasMod = jiti(join(repoRoot, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const indexSrc = readFileSync(join(repoRoot, 'src/domains/world/atlas/index.ts'), 'utf8');
assert.ok(indexSrc.includes('atlas-revision-contract'), 'barrel export');

assert.equal(
  contract.resolveAtlasSaveRevisionRequirement(null, null).ok,
  true,
);
assert.equal(
  contract.resolveAtlasSaveRevisionRequirement('map-1', null).ok,
  false,
);
assert.equal(
  contract.resolveAtlasSaveRevisionRequirement('map-1', 2).value.expectedRevision,
  2,
);

const doc = canvasMod.emptyUnifiedCanvasDoc(false);
const wall = {
  id: 'w1',
  x1: 0,
  y1: 0,
  x2: 10,
  y2: 0,
  width: 2,
};
const next = contract.applyAtlasEditChangeset(doc, [
  { op: 'add_wall', wall },
  {
    op: 'add_object',
    object: { id: 'o1', type: 'haus', x: 1, y: 2, size: 1 },
  },
]);
assert.equal(next.walls.length, 1);
assert.equal(next.objects.length, 1);

assert.deepEqual(
  contract.decideAtlasAutosave({ status: 'dirty', pendingOps: 1, msSinceLastEdit: 2_000 }),
  { action: 'save' },
);
assert.deepEqual(
  contract.decideAtlasAutosave({ status: 'conflict', pendingOps: 99, msSinceLastEdit: 9_000 }),
  { action: 'blocked_conflict' },
);
assert.equal(
  contract.atlasPersistAfterHostError('saving', 'Die Karte wurde inzwischen geändert.'),
  'conflict',
);

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(repoRoot, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(repoRoot, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(repoRoot, 'server/src/modules/project/index.ts')).href;
const worldUrl = pathToFileURL(join(repoRoot, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(repoRoot, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const ensureCmd = pathToFileURL(
  join(repoRoot, 'server/src/application/commands/ensure_world_atlas_root.ts'),
).href;
const upsertCmd = pathToFileURL(
  join(repoRoot, 'server/src/application/commands/upsert_world_atlas_map.ts'),
).href;
const fixturesUrl = pathToFileURL(
  join(repoRoot, 'server/src/application/world-atlas/__tests__/fixtures.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { ensure_world_atlas_root } = await import(ensureCmd);
const { upsert_world_atlas_map } = await import(upsertCmd);
const { VALID_LAYERS, DEFAULT_BOUNDS } = await import(fixturesUrl);

const work = mkdtempSync(join(tmpdir(), 'atl2-b03-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(repoRoot, 'server/migrations'),
  });
  assert.equal(boot.ok, true, `bootstrap ${boot.ok ? '' : boot.error}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(
    db,
    { actorHasAccessToSaga: project.actorHasAccessToSaga },
    project,
  );
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
    db,
    actorCanAccessWorld: project.actorCanAccessWorld,
    resolveSagaProjectForWorld: project.resolveProjectIdForWorldAndPublicId,
    isActiveProjectMember: project.isActiveMember,
  });
  const ensureRoot = ensure_world_atlas_root(world);
  const upsertMap = upsert_world_atlas_map(world);

  const OWNER = actor('owner-b03');
  const STRANGER = actor('stranger-b03');
  const worldId = 'world-atl2-b03';
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'B03', now);

  const root = ensureRoot(OWNER, worldId);
  assert.equal(root.ok, true, 'ensure root');
  const rootId = root.value[0].id;
  const rev0 = root.value[0].revision;

  const missingRev = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Welt',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: null,
  });
  assert.equal(missingRev.ok, false);
  assert.equal(missingRev.error, '22023', 'update requires revision');

  const okSave = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Welt',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: { engine: 'unified_canvas', tab: 'A' },
    expectedRevision: rev0,
  });
  assert.equal(okSave.ok, true, `owner save ${okSave.ok ? '' : okSave.error}`);
  assert.equal(okSave.value.revision, rev0 + 1);

  const conflict = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Welt-Tab-B',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: { engine: 'unified_canvas', tab: 'B' },
    expectedRevision: rev0,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, '40001', 'stale tab conflict');

  const stranger = upsertMap(STRANGER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Hack',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: okSave.value.revision,
  });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.error, '42501', 'non-owner deny');

  console.log('atl2-b03-atomic-revisions self-test: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}
