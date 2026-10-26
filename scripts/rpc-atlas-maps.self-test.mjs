#!/usr/bin/env node
/**
 * rpc-atlas-maps.self-test — atlas map RPC port (#862).
 * Location: scripts/rpc-atlas-maps.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const ensureCmd = pathToFileURL(
  join(root, 'server/src/application/commands/ensure_world_atlas_root.ts'),
).href;
const listCmd = pathToFileURL(
  join(root, 'server/src/application/commands/list_world_atlas_maps.ts'),
).href;
const getCmd = pathToFileURL(join(root, 'server/src/application/commands/get_world_atlas_map.ts')).href;
const upsertCmd = pathToFileURL(
  join(root, 'server/src/application/commands/upsert_world_atlas_map.ts'),
).href;
const fixturesUrl = pathToFileURL(
  join(root, 'server/src/application/world-atlas/__tests__/fixtures.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { ensure_world_atlas_root } = await import(ensureCmd);
const { list_world_atlas_maps } = await import(listCmd);
const { get_world_atlas_map } = await import(getCmd);
const { upsert_world_atlas_map } = await import(upsertCmd);
const { VALID_LAYERS, DEFAULT_BOUNDS } = await import(fixturesUrl);

const work = mkdtempSync(join(tmpdir(), 'rpc-atlas-maps-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 20, `schema>=20 got ${boot.schemaVersion}`);
  const db = boot.db;

  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  }, project);
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
  const listMaps = list_world_atlas_maps(world);
  const getMap = get_world_atlas_map(world);
  const upsertMap = upsert_world_atlas_map(world);

  const OWNER = actor('owner-atlas');
  const PLAYER_A = actor('player-a');
  const PLAYER_B = actor('player-b');
  const worldId = 'world-862';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Atlas World', now);

  const projA = 'proj-a';
  const projB = 'proj-b';
  const sagaA = 'SA-AAAA1';
  const sagaB = 'SA-BBBB2';
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, public_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
  ).run(projA, worldId, OWNER.actorId, 'Saga A', now, sagaA);
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, public_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
  ).run(projB, worldId, OWNER.actorId, 'Saga B', now, sagaB);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, ?, 1, ?)`,
  ).run(projA, PLAYER_A.actorId, 'player', now);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, ?, 1, ?)`,
  ).run(projB, PLAYER_B.actorId, 'player', now);

  // --- Root ensure idempotent + legacy kind when world_maps row exists ---
  const firstRoot = ensureRoot(OWNER, worldId);
  assert(firstRoot.ok && firstRoot.value.length >= 1, 'ensure root');
  const rootId = firstRoot.value[0].id;
  assert(firstRoot.value[0].kind === 'world', 'default world root kind');

  db.prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    'world-legacy',
    OWNER.actorId,
    'Legacy',
    now,
  );
  db.prepare(`INSERT INTO world_maps (world_id, revision, map_data, updated_at) VALUES (?, 0, '{}', ?)`).run(
    'world-legacy',
    now,
  );
  const legacyRoot = ensureRoot(OWNER, 'world-legacy');
  assert(legacyRoot.ok && legacyRoot.value[0].kind === 'legacy_tiles', 'legacy_tiles root');
  const legacyRoot2 = ensureRoot(OWNER, 'world-legacy');
  assert(legacyRoot2.ok && legacyRoot2.value[0].id === legacyRoot.value[0].id, 'stable root id');

  // --- Upsert + revision conflict + validation ---
  const childUpsert = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: rootId,
    kind: 'region',
    title: 'Nord',
    sortOrder: 1,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: 'maps/az.map',
    generatorMeta: { engine: 'manual', editorSecret: true },
    expectedRevision: null,
  });
  assert(childUpsert.ok, `child upsert: ${childUpsert.ok ? '' : childUpsert.error}`);
  assert(childUpsert.value.revision === 1, 'new revision 1');
  const childId = childUpsert.value.id;

  const badKind = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'invalid',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'FeatureCollection', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(!badKind.ok && badKind.error === '22023', `bad kind: ${badKind.error}`);

  const badParent = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: randomUUID(),
    kind: 'world',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'FeatureCollection', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(!badParent.ok && badParent.error === '22023', `bad parent: ${badParent.error}`);

  const badLayers = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'Point', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(!badLayers.ok && badLayers.error === '22023', `bad layers type: ${badLayers.error}`);

  const nonObjectLayers = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: 'not-an-object',
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(
    !nonObjectLayers.ok && nonObjectLayers.error === '22023',
    `non-object layers: ${nonObjectLayers.error}`,
  );

  const huge = 'x'.repeat(1_500_001);
  const tooLarge = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'FeatureCollection', features: [{ properties: { blob: huge } }] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(!tooLarge.ok && tooLarge.error === '22023', `layers size: ${tooLarge.error}`);

  const conflict = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: childId,
    parentMapId: rootId,
    kind: 'region',
    title: 'Nord',
    sortOrder: 1,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'FeatureCollection', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: 99,
  });
  assert(!conflict.ok && conflict.error === '40001', `revision conflict: ${conflict.error}`);

  const playerWrite = upsertMap(PLAYER_A, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'X',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { type: 'FeatureCollection', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: null,
  });
  assert(!playerWrite.ok && playerWrite.error === '42501', `player upsert deny: ${playerWrite.error}`);

  // --- Party projection fixtures: map A vs map B ---
  const mapA = childId;
  const mapB = randomUUID();
  db.prepare(
    `INSERT INTO world_atlas_maps (
       id, world_profile_id, parent_map_id, kind, title, sort_order,
       bounds, layers, generator_meta, revision, created_at, updated_at
     ) VALUES (?, ?, ?, 'region', 'Secret B', 2, ?, ?, '{}', 1, ?, ?)`,
  ).run(
    mapB,
    worldId,
    rootId,
    JSON.stringify(DEFAULT_BOUNDS),
    JSON.stringify({ type: 'FeatureCollection', features: [] }),
    now,
    now,
  );

  const placeA = randomUUID();
  const placeB = randomUUID();
  db.prepare(
    `INSERT INTO world_places (id, world_profile_id, kind, name, status, created_at, updated_at)
     VALUES (?, ?, 'site', 'Place A', 'canonical', ?, ?)`,
  ).run(placeA, worldId, now, now);
  db.prepare(
    `INSERT INTO world_places (id, world_profile_id, kind, name, status, created_at, updated_at)
     VALUES (?, ?, 'site', 'Place B', 'canonical', ?, ?)`,
  ).run(placeB, worldId, now, now);
  db.prepare(
    `INSERT INTO world_place_map_links (id, world_profile_id, place_id, map_id, usage, created_at)
     VALUES (?, ?, ?, ?, 'primary', ?)`,
  ).run(randomUUID(), worldId, placeA, mapA, now);
  db.prepare(
    `INSERT INTO world_place_map_links (id, world_profile_id, place_id, map_id, usage, created_at)
     VALUES (?, ?, ?, ?, 'primary', ?)`,
  ).run(randomUUID(), worldId, placeB, mapB, now);
  db.prepare(
    `INSERT INTO saga_asset_bindings (id, project_id, asset_kind, asset_id, reveal, metadata, world_place_id, updated_at)
     VALUES (?, ?, 'location', ?, 'party', '{}', ?, ?)`,
  ).run(randomUUID(), projA, placeA, placeA, now);
  db.prepare(
    `INSERT INTO saga_asset_bindings (id, project_id, asset_kind, asset_id, reveal, metadata, world_place_id, updated_at)
     VALUES (?, ?, 'location', ?, 'party', '{}', ?, ?)`,
  ).run(randomUUID(), projB, placeB, placeB, now);

  const playerAListOwn = listMaps(PLAYER_A, worldId, true, sagaA);
  assert(playerAListOwn.ok && playerAListOwn.value.length === 1, 'player A sees own saga map');
  assert(playerAListOwn.value[0].id === mapA, 'map A id');
  assert(playerAListOwn.value[0].hasAzgaarMap === false, 'party hasAzgaar false');

  const playerAEmptyNoSaga = listMaps(PLAYER_A, worldId, true, null);
  assert(playerAEmptyNoSaga.ok && playerAEmptyNoSaga.value.length === 0, 'no saga → empty list');

  // RPC-SEC-CROSS-SAGA-REVEAL: member of A must not read B party projection
  const crossList = listMaps(PLAYER_A, worldId, true, sagaB);
  assert(!crossList.ok && crossList.error === '42501', `cross saga list deny: ${crossList.error}`);

  const crossGet = getMap(PLAYER_A, mapB, true, sagaB);
  assert(!crossGet.ok && crossGet.error === '42501', `cross saga get deny: ${crossGet.error}`);

  const playerGetA = getMap(PLAYER_A, mapA, true, sagaA);
  assert(playerGetA.ok, `player get A: ${playerGetA.ok ? '' : playerGetA.error}`);
  assert(playerGetA.value.azgaarMapStoragePath === null, 'party azgaar hidden');
  assert(
    playerGetA.value.layers.features.length === 1,
    `filtered features=${playerGetA.value.layers.features?.length}`,
  );
  assert(
    typeof playerGetA.value.generatorMeta.engine === 'string',
    'party meta engine kept',
  );
  assert(playerGetA.value.generatorMeta.editorSecret === undefined, 'party meta redacted');

  const editorList = listMaps(OWNER, worldId, false, null);
  assert(editorList.ok && editorList.value.length >= 2, 'editor sees all maps');
  const editorRow = editorList.value.find((m) => m.id === mapA);
  assert(editorRow?.hasAzgaarMap === true, 'editor hasAzgaar');

  // World owner listing with a foreign saga id must not 42501 (editor path).
  const editorListForeignSaga = listMaps(OWNER, worldId, false, sagaB);
  assert(
    editorListForeignSaga.ok && editorListForeignSaga.value.length >= 2,
    `editor + foreign saga list: ${editorListForeignSaga.ok ? editorListForeignSaga.value.length : editorListForeignSaga.error}`,
  );

  const editorGet = getMap(OWNER, mapA, false, null);
  assert(editorGet.ok && editorGet.value.azgaarMapStoragePath !== null, 'editor azgaar path');
  assert(editorGet.value.layers.features.length === 6, 'editor full layers');
  assert(
    playerGetA.value.layers.features.every(
      (f) => f?.properties?.label === 'sichtbar' || f?.properties?.discovered === true,
    ),
    'party only non-secret discovered features (incl. coerced flags)',
  );

  // get uses three-arg path; missing map → P0002
  const missing = getMap(OWNER, randomUUID(), false, null);
  assert(!missing.ok && missing.error === 'P0002', `missing map: ${missing.error}`);

  db.close();
  console.log('PASS rpc-atlas-maps.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
