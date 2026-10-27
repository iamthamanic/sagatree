#!/usr/bin/env node
/**
 * rpc-world-places.self-test — world places RPC port (#863).
 * Location: scripts/rpc-world-places.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
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
const listPlacesCmd = pathToFileURL(
  join(root, 'server/src/application/commands/list_world_places.ts'),
).href;
const listLinksCmd = pathToFileURL(
  join(root, 'server/src/application/commands/list_world_place_map_links.ts'),
).href;
const upsertPlaceCmd = pathToFileURL(
  join(root, 'server/src/application/commands/upsert_world_place.ts'),
).href;
const upsertLinkCmd = pathToFileURL(
  join(root, 'server/src/application/commands/upsert_world_place_map_link.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { list_world_places } = await import(listPlacesCmd);
const { list_world_place_map_links } = await import(listLinksCmd);
const { upsert_world_place } = await import(upsertPlaceCmd);
const { upsert_world_place_map_link } = await import(upsertLinkCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-world-places-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 21, `schema>=21 got ${boot.schemaVersion}`);
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
    isActiveProjectMember: (projectId, actorIds) =>
      project.isActiveMember(projectId, actorIds) || project.isProjectGm(projectId, actorIds),
  });

  const listPlaces = list_world_places(world);
  const listLinks = list_world_place_map_links(world);
  const upsertPlace = upsert_world_place(world);
  const upsertLink = upsert_world_place_map_link(world);

  const OWNER = actor('owner-places');
  const PLAYER_A = actor('player-a');
  const PLAYER_B = actor('player-b');
  const worldId = 'world-863';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Places World', now);

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

  // Atlas map for links
  const mapA = randomUUID();
  const mapB = randomUUID();
  for (const [mapId, title] of [
    [mapA, 'Map A'],
    [mapB, 'Map B'],
  ]) {
    db.prepare(
      `INSERT INTO world_atlas_maps (
         id, world_profile_id, parent_map_id, kind, title, sort_order,
         bounds, layers, generator_meta, revision, created_at, updated_at
       ) VALUES (?, ?, NULL, 'world', ?, 0, '{}', '{"type":"FeatureCollection","features":[]}', '{}', 1, ?, ?)`,
    ).run(mapId, worldId, title, now, now);
  }

  // --- Upsert place create + revise ---
  const created = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: null,
    kind: 'site',
    name: 'Place A',
    description: 'Alpha',
    status: 'canonical',
    seedKey: 'place-a',
    sortOrder: 1,
  });
  assert(created.ok, `create place: ${created.ok ? '' : created.error}`);
  assert(created.value.revision === 0, 'new place revision 0');
  assert(created.value.name === 'Place A', 'place name');
  assert(created.value.description === 'Alpha', 'place description');
  const placeA = created.value.id;

  const revised = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    parentPlaceId: null,
    kind: 'site',
    name: 'Place A2',
    description: null,
    status: 'canonical',
    seedKey: 'place-a',
    sortOrder: 2,
  });
  assert(revised.ok, `revise place: ${revised.ok ? '' : revised.error}`);
  assert(revised.value.revision === 1, 'revision +1');
  assert(revised.value.name === 'Place A2', 'updated name');
  assert(revised.value.description === null, 'null description');

  const placeB = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: null,
    kind: 'region',
    name: 'Place B',
    description: null,
    status: 'canonical',
    seedKey: null,
    sortOrder: 3,
  });
  assert(placeB.ok, 'create place B');
  const placeBId = placeB.value.id;

  // empty kind/name → 22023
  const badName = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: null,
    kind: 'site',
    name: '  ',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
  });
  assert(!badName.ok && badName.error === '22023', `empty name: ${badName.error}`);

  // missing place → P0002
  const missing = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: randomUUID(),
    parentPlaceId: null,
    kind: 'site',
    name: 'X',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
  });
  assert(!missing.ok && missing.error === 'P0002', `missing place: ${missing.error}`);

  // player cannot write
  const playerWrite = upsertPlace(PLAYER_A, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: null,
    kind: 'site',
    name: 'Hacker',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
  });
  assert(!playerWrite.ok && playerWrite.error === '42501', `player write: ${playerWrite.error}`);

  // --- Same-world parent / cycle / foreign parent ---
  const otherWorld = 'world-other';
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(otherWorld, OWNER.actorId, 'Other', now);
  const foreignPlace = randomUUID();
  db.prepare(
    `INSERT INTO world_places (
       id, world_profile_id, parent_place_id, kind, name, status, sort_order, revision, created_at, updated_at
     ) VALUES (?, ?, NULL, 'site', 'Foreign', 'canonical', 0, 0, ?, ?)`,
  ).run(foreignPlace, otherWorld, now, now);

  const badParent = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: foreignPlace,
    kind: 'site',
    name: 'Orphan child',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
  });
  assert(!badParent.ok && badParent.error === '23514', `foreign parent: ${badParent.error}`);

  const child = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: placeA,
    kind: 'building',
    name: 'Child',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
  });
  assert(child.ok, `child under A: ${child.ok ? '' : child.error}`);
  const childId = child.value.id;

  const cycle = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    parentPlaceId: childId,
    kind: 'site',
    name: 'Place A2',
    description: null,
    status: 'canonical',
    seedKey: 'place-a',
    sortOrder: 2,
  });
  assert(!cycle.ok && cycle.error === '23514', `cycle deny: ${cycle.error}`);

  // --- Map link upsert + unique place/map/usage ---
  const link1 = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    mapId: mapA,
    usage: 'primary',
    featureId: null,
    anchor: {},
  });
  assert(link1.ok, `link1: ${link1.ok ? '' : link1.error}`);
  assert(link1.value.usage === 'primary', 'usage primary');
  assert(link1.value.featureId === null, 'null feature');
  assert(typeof link1.value.anchor === 'object', 'anchor object');
  const link1Id = link1.value.id;

  const link1b = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    mapId: mapA,
    usage: 'primary',
    featureId: 'feat-1',
    anchor: { x: 1 },
  });
  assert(link1b.ok, `link upsert same key: ${link1b.ok ? '' : link1b.error}`);
  assert(link1b.value.id === link1Id, 'same link id');
  assert(link1b.value.featureId === 'feat-1', 'feature updated');
  assert(link1b.value.anchor.x === 1, 'anchor updated');

  const secondPrimary = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    mapId: mapB,
    usage: 'primary',
    featureId: null,
    anchor: {},
  });
  assert(
    !secondPrimary.ok && secondPrimary.error === '23505',
    `second primary: ${secondPrimary.error}`,
  );

  const overview = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    mapId: mapA,
    usage: 'overview',
    featureId: null,
    anchor: {},
  });
  assert(overview.ok, 'overview link ok');

  const foreignMap = randomUUID();
  db.prepare(
    `INSERT INTO world_atlas_maps (
       id, world_profile_id, parent_map_id, kind, title, sort_order,
       bounds, layers, generator_meta, revision, created_at, updated_at
     ) VALUES (?, ?, NULL, 'world', 'Foreign Map', 0, '{}', '{"type":"FeatureCollection","features":[]}', '{}', 1, ?, ?)`,
  ).run(foreignMap, otherWorld, now, now);

  const badMapLink = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeA,
    mapId: foreignMap,
    usage: 'overview',
    featureId: null,
    anchor: {},
  });
  assert(!badMapLink.ok && badMapLink.error === '22023', `foreign map: ${badMapLink.error}`);

  const badPlaceLink = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: foreignPlace,
    mapId: mapA,
    usage: 'overview',
    featureId: null,
    anchor: {},
  });
  assert(!badPlaceLink.ok && badPlaceLink.error === '22023', `foreign place: ${badPlaceLink.error}`);

  // Place B primary on map B
  const linkB = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: placeBId,
    mapId: mapB,
    usage: 'primary',
    featureId: null,
    anchor: {},
  });
  assert(linkB.ok, 'link B');

  // Party bindings
  db.prepare(
    `INSERT INTO saga_asset_bindings (id, project_id, asset_kind, asset_id, reveal, metadata, world_place_id, updated_at)
     VALUES (?, ?, 'location', ?, 'party', '{}', ?, ?)`,
  ).run(randomUUID(), projA, placeA, placeA, now);
  db.prepare(
    `INSERT INTO saga_asset_bindings (id, project_id, asset_kind, asset_id, reveal, metadata, world_place_id, updated_at)
     VALUES (?, ?, 'location', ?, 'party', '{}', ?, ?)`,
  ).run(randomUUID(), projB, placeBId, placeBId, now);

  // --- Editor vs party projection; missing saga → empty ---
  const editorPlaces = listPlaces(OWNER, worldId, false, null);
  assert(editorPlaces.ok && editorPlaces.value.length >= 2, 'editor places');
  assert(
    editorPlaces.value.every((p) => p.bindingReveal === undefined),
    'editor has no binding fields',
  );

  const playerEmpty = listPlaces(PLAYER_A, worldId, true, null);
  assert(playerEmpty.ok && playerEmpty.value.length === 0, 'no saga → empty places');

  const playerLinksEmpty = listLinks(PLAYER_A, worldId, true, null);
  assert(playerLinksEmpty.ok && playerLinksEmpty.value.length === 0, 'no saga → empty links');

  const playerAPlaces = listPlaces(PLAYER_A, worldId, true, sagaA);
  assert(playerAPlaces.ok && playerAPlaces.value.length === 1, 'player A party places');
  assert(playerAPlaces.value[0].id === placeA, 'place A only');
  assert(playerAPlaces.value[0].bindingReveal === 'party', 'bindingReveal');
  assert(playerAPlaces.value[0].bindingAssetId === placeA, 'bindingAssetId');

  const playerALinks = listLinks(PLAYER_A, worldId, true, sagaA);
  assert(playerALinks.ok && playerALinks.value.length >= 1, 'player A links');
  assert(
    playerALinks.value.every((l) => l.placeId === placeA),
    'only place A links',
  );

  // Editor + foreign saga still sees full catalog (parity with atlas)
  const editorForeign = listPlaces(OWNER, worldId, false, sagaB);
  assert(editorForeign.ok && editorForeign.value.length >= 2, 'editor + foreign saga');

  // --- RPC-SEC-CROSS-SAGA-REVEAL ---
  const crossPlaces = listPlaces(PLAYER_A, worldId, true, sagaB);
  assert(
    !crossPlaces.ok && crossPlaces.error === '42501',
    `cross saga places deny: ${crossPlaces.error}`,
  );
  const crossLinks = listLinks(PLAYER_A, worldId, true, sagaB);
  assert(
    !crossLinks.ok && crossLinks.error === '42501',
    `cross saga links deny: ${crossLinks.error}`,
  );

  // archived excluded from editor list + party links
  const archived = upsertPlace(OWNER, {
    worldProfileId: worldId,
    placeId: null,
    parentPlaceId: null,
    kind: 'site',
    name: 'Archived',
    description: null,
    status: 'archived',
    seedKey: null,
    sortOrder: 99,
  });
  assert(archived.ok, 'archived create');
  const editorAfterArchive = listPlaces(OWNER, worldId, false, null);
  assert(
    editorAfterArchive.ok &&
      editorAfterArchive.value.every((p) => p.id !== archived.value.id),
    'archived excluded',
  );

  const archivedLink = upsertLink(OWNER, {
    worldProfileId: worldId,
    placeId: archived.value.id,
    mapId: mapA,
    usage: 'overview',
    featureId: null,
    anchor: {},
  });
  assert(archivedLink.ok, 'link on archived place (editor write)');
  db.prepare(
    `INSERT INTO saga_asset_bindings (id, project_id, asset_kind, asset_id, reveal, metadata, world_place_id, updated_at)
     VALUES (?, ?, 'location', ?, 'party', '{}', ?, ?)`,
  ).run(randomUUID(), projA, archived.value.id, archived.value.id, now);
  const partyLinksNoArchived = listLinks(PLAYER_A, worldId, true, sagaA);
  assert(partyLinksNoArchived.ok, 'party links after archive');
  assert(
    partyLinksNoArchived.value.every((l) => l.placeId !== archived.value.id),
    'party links hide archived places',
  );

  db.close();

  // --- Migration 0021: preserve links across upgrade (FK cascade regression) ---
  const migWork = mkdtempSync(join(tmpdir(), 'rpc-world-places-mig-'));
  const migData = join(migWork, 'data');
  mkdirSync(migData);
  const migThru20 = join(migWork, 'm20');
  const migThru21 = join(migWork, 'm21');
  mkdirSync(migThru20);
  mkdirSync(migThru21);
  const allMigrations = readdirSync(join(root, 'server/migrations'))
    .filter((n) => /^\d{4}_.+\.sql$/.test(n))
    .sort();
  for (const name of allMigrations) {
    const ver = Number(name.slice(0, 4));
    copyFileSync(join(root, 'server/migrations', name), join(migThru21, name));
    if (ver <= 20) {
      copyFileSync(join(root, 'server/migrations', name), join(migThru20, name));
    }
  }
  const boot20 = bootstrapHostPersistence({ dataDir: migData, migrationsDir: migThru20 });
  assert(boot20.ok && boot20.schemaVersion === 20, `schema20: ${boot20.ok ? boot20.schemaVersion : boot20.error}`);
  const db20 = boot20.db;
  const tNow = new Date().toISOString();
  db20.prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    'w-mig',
    'owner',
    'Mig',
    tNow,
  );
  const mapMig = randomUUID();
  db20
    .prepare(
      `INSERT INTO world_atlas_maps (
         id, world_profile_id, parent_map_id, kind, title, sort_order,
         bounds, layers, generator_meta, revision, created_at, updated_at
       ) VALUES (?, 'w-mig', NULL, 'world', 'M', 0, '{}', '{"type":"FeatureCollection","features":[]}', '{}', 1, ?, ?)`,
    )
    .run(mapMig, tNow, tNow);
  const placeMig = randomUUID();
  db20
    .prepare(
      `INSERT INTO world_places (id, world_profile_id, kind, name, status, created_at, updated_at)
       VALUES (?, 'w-mig', 'site', 'P', 'canonical', ?, ?)`,
    )
    .run(placeMig, tNow, tNow);
  const linkMig = randomUUID();
  // Stub 0020 allows 'detail' + 'overview' together (no unique) — upgrade must dedupe.
  db20
    .prepare(
      `INSERT INTO world_place_map_links (id, world_profile_id, place_id, map_id, usage, created_at)
       VALUES (?, 'w-mig', ?, ?, 'overview', ?)`,
    )
    .run(linkMig, placeMig, mapMig, tNow);
  db20
    .prepare(
      `INSERT INTO world_place_map_links (id, world_profile_id, place_id, map_id, usage, created_at)
       VALUES (?, 'w-mig', ?, ?, 'detail', ?)`,
    )
    .run(randomUUID(), placeMig, mapMig, tNow);
  db20
    .prepare(
      `INSERT INTO world_place_map_links (id, world_profile_id, place_id, map_id, usage, created_at)
       VALUES (?, 'w-mig', ?, ?, 'primary', ?)`,
    )
    .run(randomUUID(), placeMig, mapMig, tNow);
  const beforeLinks = db20
    .prepare(`SELECT COUNT(*) AS n FROM world_place_map_links WHERE world_profile_id = 'w-mig'`)
    .get().n;
  assert(beforeLinks === 3, `pre-upgrade links=${beforeLinks}`);
  db20.close();

  const boot21 = bootstrapHostPersistence({ dataDir: migData, migrationsDir: migThru21 });
  assert(boot21.ok && boot21.schemaVersion >= 21, `schema21: ${boot21.ok ? boot21.schemaVersion : boot21.error}`);
  const after = boot21.db
    .prepare(`SELECT COUNT(*) AS n FROM world_place_map_links WHERE world_profile_id = 'w-mig'`)
    .get().n;
  assert(after >= 1, `links preserved after 0021 (got ${after})`);
  const usages = boot21.db
    .prepare(
      `SELECT usage FROM world_place_map_links WHERE world_profile_id = 'w-mig' ORDER BY usage`,
    )
    .all()
    .map((r) => r.usage);
  assert(usages.includes('primary'), 'primary preserved');
  assert(usages.filter((u) => u === 'overview').length === 1, 'detail+overview deduped to one overview');
  boot21.db.close();
  rmSync(migWork, { recursive: true, force: true });

  console.log('PASS rpc-world-places.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
