#!/usr/bin/env node
/**
 * rpc-world-restructure.self-test — reparent/duplicate world node RPC port (#865).
 * Location: scripts/rpc-world-restructure.self-test.mjs
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
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_world_node_with_maps.ts'),
).href;
const reparentCmd = pathToFileURL(
  join(root, 'server/src/application/commands/reparent_world_node.ts'),
).href;
const duplicateCmd = pathToFileURL(
  join(root, 'server/src/application/commands/duplicate_world_node.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);
const { reparent_world_node } = await import(reparentCmd);
const { duplicate_world_node } = await import(duplicateCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-world-restructure-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 22, `schema>=22 got ${boot.schemaVersion}`);
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
  const reparentNode = reparent_world_node(world);
  const duplicateNode = duplicate_world_node(world);

  const OWNER = actor('owner-865');
  const STRANGER = actor('stranger-865');
  const worldId = 'world-865';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Restructure World', now);

  // Build a continent → country → place tree for reparent/duplicate.
  const continent = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Nordreich',
    idempotencyKey: `key-cont-${randomUUID()}`,
  });
  assert(continent.ok, `continent: ${continent.ok ? '' : continent.error}`);

  const countryA = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Aland',
    idempotencyKey: `key-ca-${randomUUID()}`,
    parentPlaceId: continent.value.targetPlaceId,
  });
  assert(countryA.ok, `countryA: ${countryA.ok ? '' : countryA.error}`);

  const countryB = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Bland',
    idempotencyKey: `key-cb-${randomUUID()}`,
    parentPlaceId: continent.value.targetPlaceId,
  });
  assert(countryB.ok, `countryB: ${countryB.ok ? '' : countryB.error}`);

  const placeUnderA = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Hafenstadt',
    idempotencyKey: `key-pl-${randomUUID()}`,
    parentPlaceId: countryA.value.targetPlaceId,
  });
  assert(placeUnderA.ok, `place: ${placeUnderA.ok ? '' : placeUnderA.error}`);

  const placeId = placeUnderA.value.targetPlaceId;
  const placeMapId = placeUnderA.value.targetMapId;
  const parentBefore = db
    .prepare(`SELECT parent_place_id FROM world_places WHERE id = ?`)
    .get(placeId).parent_place_id;
  assert(parentBefore === countryA.value.targetPlaceId, 'initial parent = countryA');

  // --- 1. Reparent requires confirm ---
  const noConfirm = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: countryB.value.targetPlaceId,
    confirmRelocate: false,
  });
  assert(!noConfirm.ok && noConfirm.error === '22023', `no confirm → ${noConfirm.error}`);

  // --- 2. Self-cycle forbidden ---
  const selfCycle = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: placeId,
    confirmRelocate: true,
  });
  assert(!selfCycle.ok && selfCycle.error === '23514', `self cycle → ${selfCycle.error}`);

  // --- 3. Descendant cycle forbidden (reparent continent under its place) ---
  const descCycle = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId: continent.value.targetPlaceId,
    newParentPlaceId: placeId,
    confirmRelocate: true,
  });
  assert(!descCycle.ok && descCycle.error === '23514', `desc cycle → ${descCycle.error}`);

  // --- 4. Invalid parent kind edge (place under place) ---
  const siblingPlace = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Bergdorf',
    idempotencyKey: `key-pl2-${randomUUID()}`,
    parentPlaceId: countryA.value.targetPlaceId,
  });
  assert(siblingPlace.ok, `sibling place: ${siblingPlace.ok ? '' : siblingPlace.error}`);
  const badEdge = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: siblingPlace.value.targetPlaceId,
    confirmRelocate: true,
  });
  assert(!badEdge.ok && badEdge.error === '23514', `bad edge → ${badEdge.error}`);
  const stillUnderA = db
    .prepare(`SELECT parent_place_id FROM world_places WHERE id = ?`)
    .get(placeId).parent_place_id;
  assert(stillUnderA === countryA.value.targetPlaceId, 'no partial move after bad edge');

  // --- 5. Foreign parent (other world) ---
  const otherWorld = 'world-865-other';
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(otherWorld, OWNER.actorId, 'Other', now);
  const foreignId = randomUUID();
  db.prepare(
    `INSERT INTO world_places (
       id, world_profile_id, parent_place_id, kind, name, description,
       status, seed_key, sort_order, revision, subtype, created_at, updated_at
     ) VALUES (?, ?, NULL, 'country', 'Foreign', NULL, 'draft', NULL, 0, 0, NULL, ?, ?)`,
  ).run(foreignId, otherWorld, now, now);
  const foreignParent = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: foreignId,
    confirmRelocate: true,
  });
  assert(!foreignParent.ok && foreignParent.error === '23514', `foreign → ${foreignParent.error}`);

  // --- 6. Successful reparent: place → countryB; map unlocated + parent updated ---
  const moved = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: countryB.value.targetPlaceId,
    confirmRelocate: true,
  });
  assert(moved.ok, `reparent ok: ${moved.ok ? '' : moved.error}`);
  assert(moved.value.relocated === true, 'relocated');
  assert(moved.value.place.parentPlaceId === countryB.value.targetPlaceId, 'new parent');
  assert(moved.value.primaryMapId === placeMapId, 'primary map preserved');
  const countryBMap = countryB.value.targetMapId;
  assert(moved.value.parentMapId === countryBMap, `parentMapId=${moved.value.parentMapId}`);
  const mapRow = db
    .prepare(`SELECT parent_map_id, generator_meta FROM world_atlas_maps WHERE id = ?`)
    .get(placeMapId);
  assert(mapRow.parent_map_id === countryBMap, 'map parent updated');
  const meta = JSON.parse(mapRow.generator_meta);
  assert(meta.mapStatus === 'unlocated', 'mapStatus unlocated');

  // --- 7. Stranger DENY ---
  const stranger = reparentNode(STRANGER, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: countryA.value.targetPlaceId,
    confirmRelocate: true,
  });
  assert(!stranger.ok && stranger.error === '42501', `stranger → ${stranger.error}`);

  // --- 8. Shallow duplicate: only root ---
  const placesBefore = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  const shallow = duplicateNode(OWNER, {
    worldProfileId: worldId,
    placeId: countryA.value.targetPlaceId,
    deep: false,
  });
  assert(shallow.ok, `shallow: ${shallow.ok ? '' : shallow.error}`);
  assert(shallow.value.deep === false, 'deep false');
  assert(shallow.value.created.length === 1, `shallow created=${shallow.value.created.length}`);
  assert(shallow.value.created[0].role === 'root', 'root role');
  assert(shallow.value.rootPlaceId === shallow.value.created[0].placeId, 'rootPlaceId');
  assert(shallow.value.rootMapId === shallow.value.created[0].mapId, 'rootMapId');
  const rootCopy = db
    .prepare(`SELECT name, status, parent_place_id FROM world_places WHERE id = ?`)
    .get(shallow.value.rootPlaceId);
  assert(rootCopy.name === 'Aland (Kopie)', `name=${rootCopy.name}`);
  assert(rootCopy.status === 'draft', 'draft status');
  assert(rootCopy.parent_place_id === continent.value.targetPlaceId, 'same parent');
  const placesAfterShallow = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(placesAfterShallow === placesBefore + 1, `places +1 shallow`);

  // --- 9. Deep duplicate: countryA subtree (country + place under A that stayed? place moved to B)
  // countryA still has siblingPlace (Bergdorf). Rebuild child under A for deep test.
  const childForDeep = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Markt',
    idempotencyKey: `key-markt-${randomUUID()}`,
    parentPlaceId: countryA.value.targetPlaceId,
  });
  assert(childForDeep.ok, `markt: ${childForDeep.ok ? '' : childForDeep.error}`);

  const placesBeforeDeep = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  const deep = duplicateNode(OWNER, {
    worldProfileId: worldId,
    placeId: countryA.value.targetPlaceId,
    deep: true,
  });
  assert(deep.ok, `deep: ${deep.ok ? '' : deep.error}`);
  assert(deep.value.deep === true, 'deep true');
  assert(deep.value.created.length >= 2, `deep created=${deep.value.created.length}`);
  assert(deep.value.created[0].role === 'root', 'deep root');
  assert(
    deep.value.created.slice(1).every((c) => c.role === 'deep_copy'),
    'deep_copy roles',
  );
  // All new IDs distinct from sources
  const sourceIds = new Set([
    countryA.value.targetPlaceId,
    siblingPlace.value.targetPlaceId,
    childForDeep.value.targetPlaceId,
  ]);
  for (const c of deep.value.created) {
    assert(!sourceIds.has(c.placeId), `new placeId ${c.placeId}`);
    assert(c.mapId && c.mapId !== c.placeId, 'blank primary map');
  }
  const placesAfterDeep = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(
    placesAfterDeep === placesBeforeDeep + deep.value.created.length,
    `places +${deep.value.created.length}`,
  );

  // --- 10. Parallel deep copies do not share IDs ---
  const deep2 = duplicateNode(OWNER, {
    worldProfileId: worldId,
    placeId: countryA.value.targetPlaceId,
    deep: true,
  });
  assert(deep2.ok, `deep2: ${deep2.ok ? '' : deep2.error}`);
  const ids1 = new Set(deep.value.created.map((c) => c.placeId));
  const ids2 = new Set(deep2.value.created.map((c) => c.placeId));
  for (const id of ids2) {
    assert(!ids1.has(id), `no shared id ${id}`);
  }

  // --- 11. Stranger duplicate DENY ---
  const strangerDup = duplicateNode(STRANGER, {
    worldProfileId: worldId,
    placeId: countryA.value.targetPlaceId,
    deep: false,
  });
  assert(!strangerDup.ok && strangerDup.error === '42501', `stranger dup → ${strangerDup.error}`);

  console.log('PASS rpc-world-restructure.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
