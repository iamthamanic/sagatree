#!/usr/bin/env node
/**
 * rpc-world-create.self-test — create/rename world node RPC port (#864).
 * Location: scripts/rpc-world-create.self-test.mjs
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
const renameCmd = pathToFileURL(
  join(root, 'server/src/application/commands/rename_world_node.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);
const { rename_world_node } = await import(renameCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-world-create-'));
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
  const renameNode = rename_world_node(world);

  const OWNER = actor('owner-864');
  const STRANGER = actor('stranger-864');
  const worldId = 'world-864';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Create World', now);

  // --- 1. Canonical kind (room) creates full ancestor chain + primary maps ---
  const roomKey = `key-room-${randomUUID()}`;
  const room = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'room',
    name: 'Thronsaal',
    idempotencyKey: roomKey,
  });
  assert(room.ok, `create room: ${room.ok ? '' : room.error}`);
  assert(room.value.created.length === 5, `room chain len=${room.value.created.length}`);
  const kinds = room.value.created.map((c) => c.kind);
  assert(
    JSON.stringify(kinds) ===
      JSON.stringify(['continent', 'country', 'place', 'building', 'room']),
    `kinds=${kinds.join(',')}`,
  );
  assert(
    room.value.created.slice(0, 4).every((c) => c.status === 'placeholder' && c.role === 'ancestor_placeholder'),
    'ancestors placeholder',
  );
  const target = room.value.created[4];
  assert(target.status === 'draft' && target.role === 'target', 'target draft');
  assert(target.placeId === room.value.targetPlaceId, 'targetPlaceId');
  assert(target.mapId === room.value.targetMapId, 'targetMapId');

  const placeCount = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(placeCount === 5, `places after room=${placeCount}`);
  const primaryLinks = db
    .prepare(
      `SELECT COUNT(*) AS n FROM world_place_map_links WHERE world_profile_id = ? AND usage = 'primary'`,
    )
    .get(worldId).n;
  assert(primaryLinks === 5, `primary links=${primaryLinks}`);
  const rootMaps = db
    .prepare(
      `SELECT COUNT(*) AS n FROM world_atlas_maps
       WHERE world_profile_id = ? AND kind = 'world' AND parent_map_id IS NULL`,
    )
    .get(worldId).n;
  assert(rootMaps === 1, `root maps=${rootMaps}`);

  // --- 2. Idempotency: same key returns same IDs, no extra rows ---
  const roomAgain = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'room',
    name: 'Different Name Should Be Ignored',
    idempotencyKey: roomKey,
  });
  assert(roomAgain.ok, `idempotent: ${roomAgain.ok ? '' : roomAgain.error}`);
  assert(roomAgain.value.targetPlaceId === room.value.targetPlaceId, 'same target place');
  assert(roomAgain.value.targetMapId === room.value.targetMapId, 'same target map');
  assert(
    JSON.stringify(roomAgain.value.created) === JSON.stringify(room.value.created),
    'same created payload',
  );
  const placeCount2 = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(placeCount2 === 5, `places after idempotent=${placeCount2}`);

  // --- 3. Compatible parent: only missing ancestors under tip ---
  const continent = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Dornhain',
    idempotencyKey: `key-cont-${randomUUID()}`,
  });
  assert(continent.ok, `continent: ${continent.ok ? '' : continent.error}`);
  assert(continent.value.created.length === 1, 'continent alone');

  const buildingUnderCont = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'building',
    name: 'Tempel',
    idempotencyKey: `key-bldg-${randomUUID()}`,
    parentPlaceId: continent.value.targetPlaceId,
  });
  assert(buildingUnderCont.ok, `building under cont: ${buildingUnderCont.ok ? '' : buildingUnderCont.error}`);
  // Missing: country, place (continent tip covers continent rank)
  assert(
    buildingUnderCont.value.created.map((c) => c.kind).join(',') === 'country,place,building',
    `partial chain=${buildingUnderCont.value.created.map((c) => c.kind).join(',')}`,
  );

  // --- 4. Rejects: empty name, non-canonical kind, foreign parent, stranger ---
  const emptyName = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: '   ',
    idempotencyKey: `key-empty-${randomUUID()}`,
  });
  assert(!emptyName.ok && emptyName.error === '22023', `empty name → ${emptyName.error}`);

  const badKind = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'district',
    name: 'Bad',
    idempotencyKey: `key-bad-${randomUUID()}`,
  });
  assert(!badKind.ok && badKind.error === '22023', `bad kind → ${badKind.error}`);

  const foreignParent = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Orphan',
    idempotencyKey: `key-fp-${randomUUID()}`,
    parentPlaceId: randomUUID(),
  });
  assert(!foreignParent.ok && foreignParent.error === '23514', `foreign parent → ${foreignParent.error}`);

  // Invalid edge: room under continent (chain non-empty but tip can't parent highest missing)
  // Actually: room under continent → chain = country,place,building; tip continent must satisfy
  // required parent of country (=continent) → tipSatisfies('continent','continent') = true. OK.
  // Invalid: place under room (room rank 4 > place need country rank 1, so chain empty;
  // tipSatisfies('country','room') = false)
  const invalidEdge = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'BadEdge',
    idempotencyKey: `key-edge-${randomUUID()}`,
    parentPlaceId: room.value.targetPlaceId,
  });
  assert(!invalidEdge.ok && invalidEdge.error === '23514', `invalid edge → ${invalidEdge.error}`);

  const beforeDeny = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  const stranger = createNode(STRANGER, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Hack',
    idempotencyKey: `key-hack-${randomUUID()}`,
  });
  assert(!stranger.ok && stranger.error === '42501', `stranger → ${stranger.error}`);
  const afterDeny = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(afterDeny === beforeDeny, 'no side effects on deny');

  // --- 5. Rename: placeholder→draft + revision++; other status preserved ---
  const phPlaceId = buildingUnderCont.value.created.find((c) => c.role === 'ancestor_placeholder')
    .placeId;
  const phBefore = db
    .prepare(`SELECT status, revision, name FROM world_places WHERE id = ?`)
    .get(phPlaceId);
  assert(phBefore.status === 'placeholder', 'placeholder before rename');
  const renamed = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: phPlaceId,
    name: '  Nördliches Reich  ',
  });
  assert(renamed.ok, `rename: ${renamed.ok ? '' : renamed.error}`);
  assert(renamed.value.name === 'Nördliches Reich', `trimmed name=${renamed.value.name}`);
  assert(renamed.value.status === 'draft', `status=${renamed.value.status}`);
  assert(renamed.value.revision === phBefore.revision + 1, `rev=${renamed.value.revision}`);

  const draftRename = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: room.value.targetPlaceId,
    name: 'Thronsaal Renamed',
  });
  assert(draftRename.ok, `rename draft: ${draftRename.ok ? '' : draftRename.error}`);
  assert(draftRename.value.status === 'draft', 'draft stays draft');
  assert(draftRename.value.revision === 1, `draft rev=${draftRename.value.revision}`);

  const emptyRename = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: room.value.targetPlaceId,
    name: '  ',
  });
  assert(!emptyRename.ok && emptyRename.error === '22023', `empty rename → ${emptyRename.error}`);

  const strangerRename = renameNode(STRANGER, {
    worldProfileId: worldId,
    placeId: room.value.targetPlaceId,
    name: 'Nope',
  });
  assert(!strangerRename.ok && strangerRename.error === '42501', `stranger rename → ${strangerRename.error}`);

  const missingRename = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: randomUUID(),
    name: 'Ghost',
  });
  assert(!missingRename.ok && missingRename.error === 'P0002', `missing → ${missingRename.error}`);

  console.log('PASS rpc-world-create.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
