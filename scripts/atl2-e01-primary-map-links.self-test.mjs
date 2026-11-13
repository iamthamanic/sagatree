#!/usr/bin/env node
/**
 * ATL2-E01 — Primary maps + WorldNode links for all six hierarchy levels (#1219).
 * Location: scripts/atl2-e01-primary-map-links.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const hierarchy = jiti(join(root, 'src/domains/world/hierarchy/primary-map-links.ts'));
const indexSrc = readFileSync(join(root, 'src/domains/world/hierarchy/index.ts'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e01.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e01-primary-map-links.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');

assert.ok(acceptance.includes('atl2-e01'));
assert.ok(acceptance.includes('Primärkarte'));
assert.ok(design.includes('parent_map_id'));
assert.ok(gate.includes('atl2-e01-primary-map-links.self-test.mjs'), 'wired in test-gate');
assert.ok(indexSrc.includes('assertPrimaryMapLinkGraph'));
assert.ok(indexSrc.includes('expectedPrimaryMapParentId'));
assert.equal(hierarchy.ATLAS_HIERARCHY_LEVELS.length, 6);
assert.deepEqual([...hierarchy.canonicalNodeKindChain()], [
  'continent',
  'country',
  'place',
  'building',
  'room',
]);

/* --- Domain invariants --- */
const contParent = hierarchy.expectedPrimaryMapParentId({
  kind: 'continent',
  parentPlaceId: null,
  parentPrimaryMapId: null,
  worldRootMapId: 'root',
});
assert.equal(contParent.ok, true);
assert.equal(contParent.parentMapId, 'root');
const placeParent = hierarchy.expectedPrimaryMapParentId({
  kind: 'place',
  parentPlaceId: 'country-1',
  parentPrimaryMapId: 'map-country',
  worldRootMapId: 'root',
});
assert.equal(placeParent.ok, true);
assert.equal(placeParent.parentMapId, 'map-country');
const missingParentPrimary = hierarchy.expectedPrimaryMapParentId({
  kind: 'place',
  parentPlaceId: 'country-1',
  parentPrimaryMapId: null,
  worldRootMapId: 'root',
});
assert.equal(missingParentPrimary.ok, false);
assert.equal(missingParentPrimary.reason, 'missing_parent_primary_map');

assert.equal(hierarchy.assertCreateSubtype('place', 'city').ok, true);
assert.equal(hierarchy.assertCreateSubtype('place', 'kingdom').ok, false);
assert.equal(hierarchy.assertCreateSubtype('continent', 'city').ok, false);
assert.equal(hierarchy.assertCreateSubtype('room', null).ok, true);

const skipGraph = hierarchy.assertPrimaryMapLinkGraph({
  worldProfileId: 'w',
  worldRootMapId: 'root',
  nodes: [
    {
      placeId: 'p1',
      kind: 'place',
      parentPlaceId: null,
      primaryMapId: 'm1',
      primaryMapParentId: 'root',
    },
  ],
});
assert.equal(skipGraph.ok, false, 'place without country parent fails');

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
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_world_node_with_maps.ts'),
).href;
const renameCmd = pathToFileURL(
  join(root, 'server/src/application/commands/rename_world_node.ts'),
).href;
const deleteMapCmd = pathToFileURL(
  join(root, 'server/src/application/commands/delete_world_atlas_map.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);
const { rename_world_node } = await import(renameCmd);
const { delete_world_atlas_map } = await import(deleteMapCmd);

const work = mkdtempSync(join(tmpdir(), 'atl2-e01-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const evidence = {
  slug: 'atl2-e01',
  issue: 1219,
  verdict: 'CLEAR',
  checks: [],
};

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.ok(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert.ok(boot.schemaVersion >= 22, `schema>=22 got ${boot.schemaVersion}`);
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
    isActiveProjectMember: (projectId, actorIds) =>
      project.isActiveMember(projectId, actorIds) || project.isProjectGm(projectId, actorIds),
  });

  const createNode = create_world_node_with_maps(world);
  const renameNode = rename_world_node(world);
  const deleteMap = delete_world_atlas_map(world);

  const OWNER = actor('owner-e01');
  const STRANGER = actor('stranger-e01');
  const worldId = 'world-e01';
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'E01 World', now);

  /* 1. Six levels: create room → full chain + world root map */
  const room = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'room',
    name: 'Schankraum',
    subtype: 'chamber',
    idempotencyKey: `e01-room-${randomUUID()}`,
  });
  assert.ok(room.ok, `create room: ${room.ok ? '' : room.error}`);
  assert.equal(room.value.created.length, 5);
  assert.deepEqual(
    room.value.created.map((c) => c.kind),
    ['continent', 'country', 'place', 'building', 'room'],
  );

  const maps = world.listWorldAtlasMaps(OWNER, worldId);
  assert.ok(maps.ok, `list maps: ${maps.ok ? '' : maps.error}`);
  assert.ok(maps.value.length >= 6, `maps>=6 got ${maps.value.length}`);
  const rootMap = maps.value.find((m) => m.parentMapId == null);
  assert.ok(rootMap, 'world root map');
  assert.equal(rootMap.id, room.value.worldRootMapId);

  const places = world.listWorldPlaces(OWNER, worldId);
  assert.ok(places.ok);
  const links = world.listWorldPlaceMapLinks(OWNER, worldId);
  assert.ok(links.ok);
  const primaryByPlace = new Map(
    links.value.filter((l) => l.usage === 'primary').map((l) => [l.placeId, l.mapId]),
  );
  assert.equal(primaryByPlace.size, 5, 'five primary links');

  const nodeLinks = room.value.created.map((c) => {
    const place = places.value.find((p) => p.id === c.placeId);
    const map = maps.value.find((m) => m.id === c.mapId);
    assert.ok(place, `place loaded ${c.placeId}`);
    assert.ok(map, `map loaded ${c.mapId}`);
    const got = world.getWorldAtlasMap(OWNER, c.mapId);
    assert.ok(got.ok, `get map ${c.mapId}`);
    return {
      placeId: c.placeId,
      kind: c.kind,
      parentPlaceId: place.parentPlaceId,
      primaryMapId: c.mapId,
      primaryMapParentId: map.parentMapId,
    };
  });

  const graphCheck = hierarchy.assertPrimaryMapLinkGraph({
    worldProfileId: worldId,
    worldRootMapId: room.value.worldRootMapId,
    nodes: nodeLinks,
  });
  assert.equal(graphCheck.ok, true, `graph: ${graphCheck.ok ? '' : graphCheck.reason}`);
  const pathCheck = hierarchy.assertContiguousHierarchyPath(nodeLinks, 'room');
  assert.equal(pathCheck.ok, true, `path: ${pathCheck.ok ? '' : pathCheck.reason}`);
  evidence.checks.push('six-level-create-list-get');

  /* 2. Subtype reject */
  const badSubtype = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'building',
    name: 'Bad',
    subtype: 'chamber',
    idempotencyKey: `e01-bad-sub-${randomUUID()}`,
  });
  assert.equal(badSubtype.ok, false);
  assert.equal(badSubtype.error, '22023');
  evidence.checks.push('subtype-reject');

  /* 3. Level skip / cycle edge */
  const tipRoom = room.value.created.find((c) => c.kind === 'room');
  const skip = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Skip',
    idempotencyKey: `e01-skip-${randomUUID()}`,
    parentPlaceId: tipRoom.placeId,
  });
  assert.equal(skip.ok, false);
  assert.equal(skip.error, '23514');

  const otherWorld = 'world-e01-other';
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(otherWorld, OWNER.actorId, 'Other', now);
  const foreignPlace = randomUUID();
  db.prepare(
    `INSERT INTO world_places (
       id, world_profile_id, parent_place_id, kind, name, description,
       status, seed_key, sort_order, revision, subtype, created_at, updated_at
     ) VALUES (?, ?, NULL, 'continent', 'Alien', NULL, 'draft', NULL, 0, 0, NULL, ?, ?)`,
  ).run(foreignPlace, otherWorld, now, now);
  const crossWorld = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Cross',
    idempotencyKey: `e01-cross-${randomUUID()}`,
    parentPlaceId: foreignPlace,
  });
  assert.equal(crossWorld.ok, false);
  assert.equal(crossWorld.error, '23514');
  evidence.checks.push('skip-cross-world-reject');

  /* 4. Immutable IDs after rename */
  const beforePlace = tipRoom.placeId;
  const beforeMap = tipRoom.mapId;
  const renamed = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: beforePlace,
    name: 'Schankraum Nord',
  });
  assert.ok(renamed.ok);
  assert.equal(renamed.value.id, beforePlace);
  const links2 = world.listWorldPlaceMapLinks(OWNER, worldId);
  assert.ok(links2.ok);
  const primaryAfter = links2.value.find((l) => l.placeId === beforePlace && l.usage === 'primary');
  assert.ok(primaryAfter);
  const imm = hierarchy.assertImmutableNodeIdentity({
    beforePlaceId: beforePlace,
    afterPlaceId: renamed.value.id,
    beforePrimaryMapId: beforeMap,
    afterPrimaryMapId: primaryAfter.mapId,
  });
  assert.equal(imm.ok, true);
  evidence.checks.push('immutable-ids');

  /* 5. Map create/list/delete — secondary ok; primary/root refuse */
  const secondary = world.upsertWorldAtlasMap(OWNER, {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: beforeMap,
    kind: 'scene',
    title: 'Notizkarte',
    sortOrder: 99,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    layers: { type: 'FeatureCollection', features: [] },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: { engine: 'unified_canvas', mapStatus: 'unsketched' },
    expectedRevision: null,
  });
  assert.ok(secondary.ok, `secondary create: ${secondary.ok ? '' : secondary.error}`);

  const delPrimary = deleteMap(OWNER, worldId, beforeMap);
  assert.equal(delPrimary.ok, false);
  assert.equal(delPrimary.error, '23514');

  const delRoot = deleteMap(OWNER, worldId, room.value.worldRootMapId);
  assert.equal(delRoot.ok, false);
  assert.equal(delRoot.error, '23514');

  const delSecondary = deleteMap(OWNER, worldId, secondary.value.id);
  assert.ok(delSecondary.ok, `delete secondary: ${delSecondary.ok ? '' : delSecondary.error}`);
  assert.equal(delSecondary.value.deletedMapId, secondary.value.id);

  const strangerDel = deleteMap(STRANGER, worldId, beforeMap);
  assert.equal(strangerDel.ok, false);
  assert.equal(strangerDel.error, '42501');
  evidence.checks.push('map-create-list-delete');

  /* 6. Primary map parent lock on upsert */
  const primaryVm = world.getWorldAtlasMap(OWNER, beforeMap);
  assert.ok(primaryVm.ok);
  const lockAttempt = world.upsertWorldAtlasMap(OWNER, {
    worldProfileId: worldId,
    mapId: beforeMap,
    parentMapId: room.value.worldRootMapId,
    kind: primaryVm.value.kind,
    title: primaryVm.value.title,
    sortOrder: primaryVm.value.sortOrder,
    bounds: primaryVm.value.bounds,
    layers: primaryVm.value.layers,
    basemapStoragePath: primaryVm.value.basemapStoragePath,
    azgaarMapStoragePath: primaryVm.value.azgaarMapStoragePath,
    generatorMeta: primaryVm.value.generatorMeta,
    expectedRevision: primaryVm.value.revision,
  });
  assert.ok(lockAttempt.ok);
  assert.equal(
    lockAttempt.value.parentMapId,
    primaryVm.value.parentMapId,
    'primary parent_map_id unchanged',
  );
  evidence.checks.push('primary-parent-lock');

  /* typed-strict scan on touched sources */
  for (const rel of [
    'src/domains/world/hierarchy/primary-map-links.ts',
    'server/src/modules/world/internal/world-atlas-store.ts',
    'server/src/modules/world/internal/world-create-helpers.ts',
    'src/infrastructure/world/world-atlas-service.ts',
  ]) {
    const body = readFileSync(join(root, rel), 'utf8');
    assert.ok(!/\bas\s+any\b|@ts-ignore|@ts-expect-error/.test(body), `typed-strict ${rel}`);
  }
  evidence.checks.push('typed-strict');

  mkdirSync(join(root, '.qa/runs'), { recursive: true });
  writeFileSync(
    join(root, '.qa/runs/atl2-e01-primary-map-links.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  writeFileSync(
    join(root, '.qa/runs/atl2-e01-primary-map-links.md'),
    `# ATL2-E01 primary-map links

- Issue: #1219
- Verdict: **CLEAR**
- Checks: ${evidence.checks.join(', ')}
- SQLite schema: ${boot.schemaVersion}
- World root + five node primary maps parent-chained; subtype/skip/cross-world/delete gates green.
`,
  );

  console.log('PASS atl2-e01-primary-map-links.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
