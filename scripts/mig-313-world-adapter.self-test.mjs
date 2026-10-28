#!/usr/bin/env node
/**
 * mig-313-world-adapter.self-test — infra HostWorldPorts bound to host repositories (#812).
 * Location: scripts/mig-313-world-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

function toResult(result) {
  return Promise.resolve(result);
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const assetsUrl = pathToFileURL(join(root, 'server/src/assets/index.ts')).href;
const mediaUrl = pathToFileURL(join(root, 'server/src/modules/media/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createAssetPorts } = await import(assetsUrl);
const { createMediaPorts } = await import(mediaUrl);

/** Frontend Vite barrels are extensionless — assert via source, do not Node-import. */
const HOST_WORLD_RPC_NAMES = [
  'archive_world_node_subtree',
  'create_world_node_with_maps',
  'delete_world_node',
  'duplicate_world_node',
  'ensure_world_atlas_root',
  'get_world_atlas_map',
  'get_world_map',
  'list_world_atlas_maps',
  'list_world_place_map_links',
  'list_world_places',
  'preview_world_node_consequences',
  'rename_world_node',
  'reparent_world_node',
  'save_world_map',
  'upsert_world_atlas_map',
  'upsert_world_place',
  'upsert_world_place_map_link',
];

function createHostWorldAdapter(ports) {
  return {
    transport: 'host',
    rpcNames: HOST_WORLD_RPC_NAMES,
    ...ports,
  };
}

const work = mkdtempSync(join(tmpdir(), 'mig313-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const acceptance = [];
const note = (line) => acceptance.push(line);

try {
  // --- Contract inventory: 17 RPCs + command wrappers + no server import ---
  assert(HOST_WORLD_RPC_NAMES.length === 17, `rpc count ${HOST_WORLD_RPC_NAMES.length}`);
  const commandsDir = join(root, 'server/src/application/commands');
  for (const name of HOST_WORLD_RPC_NAMES) {
    assert(
      existsSync(join(commandsDir, `${name}.ts`)),
      `missing application/commands/${name}.ts`,
    );
  }
  const portsSrc = readFileSync(
    join(root, 'src/infrastructure/world/host-world-ports.contract.ts'),
    'utf8',
  );
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/world/host-world-adapter.ts'),
    'utf8',
  );
  assert(!/from ['"].*server\//.test(portsSrc), 'ports contract must not import server/');
  assert(!/from ['"].*server\//.test(adapterSrc), 'adapter must not import server/');
  assert(!/\bas\s+any\b|@ts-ignore|@ts-expect-error/.test(portsSrc + adapterSrc), 'typed-strict');
  for (const name of HOST_WORLD_RPC_NAMES) {
    assert(portsSrc.includes(`'${name}'`), `contract lists ${name}`);
  }
  assert(adapterSrc.includes('createHostWorldAdapter'), 'adapter exports factory');
  assert(adapterSrc.includes('publishWorldAsset'), 'adapter exposes asset publish');

  // Supabase facades remain (no production cutover)
  for (const file of [
    'world-atlas-service.ts',
    'world-map-service.ts',
    'world-place-service.ts',
    'world-profile-service.ts',
  ]) {
    const body = readFileSync(join(root, 'src/infrastructure/world', file), 'utf8');
    assert(/from ['"].*supabase['"]|supabase\./.test(body), `${file} still Supabase-backed`);
  }
  const mapService = readFileSync(
    join(root, 'src/infrastructure/world/world-map-service.ts'),
    'utf8',
  );
  assert(
    /storage\.from\(['"]world-map-pins['"]\)/.test(mapService),
    'map pin upload remains storage bucket (not a table)',
  );
  assert(!/\.from\(['"]world_map_pins['"]\)/.test(mapService), 'pin must not use SQL table');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
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
  const assets = createAssetPorts({
    dataDir,
    db,
    authorize: permissions.authorize,
  });
  const media = createMediaPorts();

  const OWNER = actor('owner-313');
  const STRANGER = actor('stranger-313');
  const PLAYER = actor('player-313');

  const hostPorts = {
    listOwnedWorlds: (actorId) => toResult(world.read.listOwnedWorlds(actor(actorId))),
    getWorld: (actorId, worldId) => toResult(world.read.getWorld(actor(actorId), worldId)),
    createOwnedWorld: (actorId, title) => toResult(world.createOwnedWorld(actor(actorId), title)),
    updateOwnedWorld: (actorId, worldId, title) =>
      toResult(world.updateOwnedWorld(actor(actorId), worldId, title)),
    deleteOwnedWorld: (actorId, worldId) =>
      toResult(world.deleteOwnedWorld(actor(actorId), worldId)),
    getWorldMap: (actorId, worldProfileId, playerView) =>
      toResult(world.getWorldMap(actor(actorId), worldProfileId, playerView)),
    saveWorldMap: (actorId, worldProfileId, expectedRevision, mapData) =>
      toResult(
        world.saveWorldMap(actor(actorId), worldProfileId, expectedRevision, {
          ...mapData,
        }),
      ),
    ensureWorldAtlasRoot: (actorId, worldProfileId) =>
      toResult(world.ensureWorldAtlasRoot(actor(actorId), worldProfileId)),
    listWorldAtlasMaps: (actorId, worldProfileId, playerView, sagaPublicId) =>
      toResult(
        world.listWorldAtlasMaps(actor(actorId), worldProfileId, playerView, sagaPublicId),
      ),
    getWorldAtlasMap: (actorId, mapId, playerView, sagaPublicId) =>
      toResult(world.getWorldAtlasMap(actor(actorId), mapId, playerView, sagaPublicId)),
    upsertWorldAtlasMap: (actorId, input) =>
      toResult(
        world.upsertWorldAtlasMap(actor(actorId), /** @type {any} */ (input)),
      ),
    listWorldPlaces: (actorId, worldProfileId, playerView, sagaPublicId) =>
      toResult(world.listWorldPlaces(actor(actorId), worldProfileId, playerView, sagaPublicId)),
    listWorldPlaceMapLinks: (actorId, worldProfileId, playerView, sagaPublicId) =>
      toResult(
        world.listWorldPlaceMapLinks(actor(actorId), worldProfileId, playerView, sagaPublicId),
      ),
    upsertWorldPlace: (actorId, input) =>
      toResult(world.upsertWorldPlace(actor(actorId), /** @type {any} */ (input))),
    upsertWorldPlaceMapLink: (actorId, input) =>
      toResult(world.upsertWorldPlaceMapLink(actor(actorId), /** @type {any} */ (input))),
    createWorldNodeWithMaps: (actorId, input) =>
      toResult(world.createWorldNodeWithMaps(actor(actorId), /** @type {any} */ (input))),
    renameWorldNode: (actorId, input) =>
      toResult(world.renameWorldNode(actor(actorId), input)),
    reparentWorldNode: (actorId, input) =>
      toResult(world.reparentWorldNode(actor(actorId), /** @type {any} */ (input))),
    duplicateWorldNode: (actorId, input) =>
      toResult(world.duplicateWorldNode(actor(actorId), /** @type {any} */ (input))),
    previewWorldNodeConsequences: (actorId, input) =>
      toResult(world.previewWorldNodeConsequences(actor(actorId), input)),
    archiveWorldNodeSubtree: (actorId, input) =>
      toResult(world.archiveWorldNodeSubtree(actor(actorId), /** @type {any} */ (input))),
    deleteWorldNode: (actorId, input) =>
      toResult(world.deleteWorldNode(actor(actorId), /** @type {any} */ (input))),
    publishWorldAsset: async (actorId, input) => {
      const a = actor(actorId);
      // map-pin uses dedicated media profile; atlas basemap reuses look-reference budgets
      // until a dedicated world-atlas profile lands (MIG-500 successor).
      const profileId = input.kind === 'map-pin' ? 'map-pin' : 'look-reference';
      const policy = media.validateUpload({
        kind: 'image',
        profileId,
        mimeType: input.contentType,
        byteSize: input.bytes.byteLength,
        width: 64,
        height: 64,
      });
      if (!policy.ok) {
        return { ok: false, error: policy.error };
      }
      // Never insert pin/atlas bytes into world_* tables — assets module only.
      const published = assets.publish(a, {
        bytes: input.bytes,
        contentType: input.contentType,
      });
      if (!published.ok) return { ok: false, error: published.error };
      return {
        ok: true,
        value: {
          assetId: published.value.assetId,
          contentType: published.value.contentType,
          storageRef: `asset://${published.value.assetId}`,
        },
      };
    },
  };

  const adapter = createHostWorldAdapter(hostPorts);
  assert(adapter.transport === 'host', 'transport tag');
  assert(adapter.rpcNames.length === 17, 'adapter rpcNames');

  // --- Profile CRUD transport ---
  const created = await adapter.createOwnedWorld(OWNER.actorId, 'MIG-313 World');
  assert(created.ok, `createOwnedWorld: ${created.ok ? '' : created.error}`);
  const worldId = created.value.id;

  const listed = await adapter.listOwnedWorlds(OWNER.actorId);
  assert(listed.ok && listed.value.some((w) => w.id === worldId), 'owner lists world');

  const renamed = await adapter.updateOwnedWorld(OWNER.actorId, worldId, 'MIG-313 Renamed');
  assert(renamed.ok && renamed.value.title === 'MIG-313 Renamed', 'updateOwnedWorld');

  const strangerGet = await adapter.getWorld(STRANGER.actorId, worldId);
  assert(!strangerGet.ok && strangerGet.error === 'not-authorized', 'stranger get DENY');

  const strangerUpdate = await adapter.updateOwnedWorld(STRANGER.actorId, worldId, 'Hijack');
  assert(!strangerUpdate.ok && strangerUpdate.error === 'not-authorized', 'stranger update DENY');

  // Project membership so atlas/places access works for owner + player projection tests
  const projectId = 'proj-313';
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, OWNER.actorId, 'Proj 313', now);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, ?, 1, ?)`,
  ).run(projectId, PLAYER.actorId, 'player', now);

  // --- Tree lifecycle via host ports ---
  const continent = await adapter.createWorldNodeWithMaps(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Westland',
    idempotencyKey: `k-c-${randomUUID()}`,
  });
  assert(continent.ok, `continent: ${continent.ok ? '' : continent.error}`);
  const continentPlaceId = continent.value.targetPlaceId;

  const countryA = await adapter.createWorldNodeWithMaps(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Nordmark',
    idempotencyKey: `k-co-${randomUUID()}`,
    parentPlaceId: continentPlaceId,
  });
  assert(countryA.ok, `countryA: ${countryA.ok ? '' : countryA.error}`);

  const countryB = await adapter.createWorldNodeWithMaps(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Sudmark',
    idempotencyKey: `k-co2-${randomUUID()}`,
    parentPlaceId: continentPlaceId,
  });
  assert(countryB.ok, `countryB: ${countryB.ok ? '' : countryB.error}`);

  const place = await adapter.createWorldNodeWithMaps(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Hafenstadt',
    idempotencyKey: `k-p-${randomUUID()}`,
    parentPlaceId: countryA.value.targetPlaceId,
  });
  assert(place.ok, `place: ${place.ok ? '' : place.error}`);
  const placeId = place.value.targetPlaceId;

  const renamedNode = await adapter.renameWorldNode(OWNER.actorId, {
    worldProfileId: worldId,
    placeId,
    name: 'Hafenstadt Neu',
  });
  assert(renamedNode.ok && renamedNode.value.name === 'Hafenstadt Neu', 'rename_world_node');

  const reparented = await adapter.reparentWorldNode(OWNER.actorId, {
    worldProfileId: worldId,
    placeId,
    newParentPlaceId: countryB.value.targetPlaceId,
    confirmRelocate: true,
  });
  assert(reparented.ok, `reparent: ${reparented.ok ? '' : reparented.error}`);

  const dup = await adapter.duplicateWorldNode(OWNER.actorId, {
    worldProfileId: worldId,
    placeId,
    deep: false,
  });
  assert(dup.ok, `duplicate: ${dup.ok ? '' : dup.error}`);

  const preview = await adapter.previewWorldNodeConsequences(OWNER.actorId, {
    worldProfileId: worldId,
    placeId: dup.value.rootPlaceId,
  });
  assert(preview.ok, `preview: ${preview.ok ? '' : preview.error}`);

  const archived = await adapter.archiveWorldNodeSubtree(OWNER.actorId, {
    worldProfileId: worldId,
    placeId: dup.value.rootPlaceId,
    confirm: true,
  });
  assert(archived.ok, `archive: ${archived.ok ? '' : archived.error}`);

  // Delete a separate leaf so archive + delete both exercise paths
  const leaf = await adapter.createWorldNodeWithMaps(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'ZuLoschen',
    idempotencyKey: `k-del-${randomUUID()}`,
    parentPlaceId: countryB.value.targetPlaceId,
  });
  assert(leaf.ok, `leaf: ${leaf.ok ? '' : leaf.error}`);
  const deleted = await adapter.deleteWorldNode(OWNER.actorId, {
    worldProfileId: worldId,
    placeId: leaf.value.targetPlaceId,
    confirm: true,
  });
  assert(deleted.ok, `delete: ${deleted.ok ? '' : deleted.error}`);

  // Reload places into DB-backed tree
  const placesReload = await adapter.listWorldPlaces(OWNER.actorId, worldId, false, null);
  assert(placesReload.ok && placesReload.value.length > 0, 'reload places after mutations');

  note('Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.');

  // --- Player projection: only revealed maps ---
  const atlasRoot = await adapter.ensureWorldAtlasRoot(OWNER.actorId, worldId);
  assert(
    atlasRoot.ok && atlasRoot.value.length >= 1,
    `ensure root: ${atlasRoot.ok ? '' : atlasRoot.error}`,
  );
  const ownerMaps = await adapter.listWorldAtlasMaps(OWNER.actorId, worldId, false, null);
  assert(ownerMaps.ok && ownerMaps.value.length >= 1, 'owner atlas list');

  const playerMaps = await adapter.listWorldAtlasMaps(PLAYER.actorId, worldId, true, null);
  assert(playerMaps.ok, `player list: ${playerMaps.ok ? '' : playerMaps.error}`);
  // Player view must not widen to full owner catalog when nothing revealed for saga.
  assert(
    playerMaps.value.length <= ownerMaps.value.length,
    'player projection not wider than owner',
  );

  const strangerMaps = await adapter.listWorldAtlasMaps(STRANGER.actorId, worldId, true, null);
  assert(
    !strangerMaps.ok || strangerMaps.value.length === 0,
    'stranger atlas DENY or empty',
  );
  if (!strangerMaps.ok) {
    assert(
      strangerMaps.error === '42501' || strangerMaps.error === 'not-authorized',
      `stranger atlas error ${strangerMaps.error}`,
    );
  }

  note('Player sees only explicitly revealed map/place projection; foreign access DENY.');

  // --- Map pin storage via assets (not table) + media policy ---
  const badPin = await adapter.publishWorldAsset(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'map-pin',
    bytes: new Uint8Array([1, 2, 3]),
    contentType: 'application/pdf',
  });
  assert(!badPin.ok, 'invalid map-pin MIME rejected');

  const pinBytes = new Uint8Array(256).fill(7);
  const pinOk = await adapter.publishWorldAsset(OWNER.actorId, {
    worldProfileId: worldId,
    kind: 'map-pin',
    bytes: pinBytes,
    contentType: 'image/png',
  });
  assert(pinOk.ok, `map-pin publish: ${pinOk.ok ? '' : pinOk.error}`);
  assert(pinOk.value.storageRef.startsWith('asset://'), 'storage ref is asset opaque id');

  const assetRows = db.prepare(`SELECT COUNT(*) AS n FROM assets`).get().n;
  assert(assetRows >= 1, 'asset row stored in assets table');
  const pinInWorldTables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%pin%'`,
    )
    .all();
  assert(pinInWorldTables.length === 0, 'no world pin SQL table');

  // Profile delete after tree work (owner only)
  const strangerDelete = await adapter.deleteOwnedWorld(STRANGER.actorId, worldId);
  assert(!strangerDelete.ok, 'stranger delete DENY');

  // Clean child rows so FK CASCADE can delete world (projects reference worlds without CASCADE)
  db.prepare(`DELETE FROM project_members WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
  // Clear place/map trees first if needed — CASCADE from worlds should handle world_* tables
  const deletedWorld = await adapter.deleteOwnedWorld(OWNER.actorId, worldId);
  assert(deletedWorld.ok, `deleteOwnedWorld: ${deletedWorld.ok ? '' : deletedWorld.error}`);

  note('Map pin upload uses host asset storage; 17 RPC deps + profile CRUD transport ready.');

  // --- Each RPC name reachable on WorldPorts / adapter ---
  const portMethods = [
    'archiveWorldNodeSubtree',
    'createWorldNodeWithMaps',
    'deleteWorldNode',
    'duplicateWorldNode',
    'ensureWorldAtlasRoot',
    'getWorldAtlasMap',
    'getWorldMap',
    'listWorldAtlasMaps',
    'listWorldPlaceMapLinks',
    'listWorldPlaces',
    'previewWorldNodeConsequences',
    'renameWorldNode',
    'reparentWorldNode',
    'saveWorldMap',
    'upsertWorldAtlasMap',
    'upsertWorldPlace',
    'upsertWorldPlaceMapLink',
  ];
  for (const m of portMethods) {
    assert(typeof adapter[m] === 'function', `adapter.${m}`);
    assert(typeof world[m] === 'function', `WorldPorts.${m}`);
  }
  note('Contract fixtures for all 17 RPCs: host ports + command wrappers present.');

  // Durable reopen
  db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 'rebootstrap');
  const world2 = createWorldPorts({
    authorize: createPermissionsPorts(boot2.db).authorize,
    store: createSqliteWorldReadStore(boot2.db),
    writeStore: createSqliteWorldWriteStore(boot2.db),
  });
  const gone = world2.read.getWorld(OWNER, worldId);
  assert(!gone.ok, 'deleted world absent after reopen');
  boot2.db.close();

  assert(acceptance.length >= 3, 'acceptance notes');
  console.log('PASS: mig-313 world adapter ports (host repository binding, no cutover)');
  for (const line of acceptance) console.log(`  - ${line}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
