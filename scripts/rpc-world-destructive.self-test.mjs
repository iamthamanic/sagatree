#!/usr/bin/env node
/**
 * rpc-world-destructive.self-test — preview/archive/delete world node RPC (#866).
 * Location: scripts/rpc-world-destructive.self-test.mjs
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
const previewCmd = pathToFileURL(
  join(root, 'server/src/application/commands/preview_world_node_consequences.ts'),
).href;
const archiveCmd = pathToFileURL(
  join(root, 'server/src/application/commands/archive_world_node_subtree.ts'),
).href;
const deleteCmd = pathToFileURL(
  join(root, 'server/src/application/commands/delete_world_node.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);
const { preview_world_node_consequences } = await import(previewCmd);
const { archive_world_node_subtree } = await import(archiveCmd);
const { delete_world_node } = await import(deleteCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-world-destructive-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
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

  const createNode = create_world_node_with_maps(world);
  const previewNode = preview_world_node_consequences(world);
  const archiveNode = archive_world_node_subtree(world);
  const deleteNode = delete_world_node(world);

  const OWNER = actor('owner-866');
  const STRANGER = actor('stranger-866');
  const worldId = 'world-866';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Destructive World', now);

  const projectId = 'proj-866';
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, OWNER.actorId, 'Proj', now);

  // continent → country → place (+ sibling place sharing a map later)
  const continent = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Westland',
    idempotencyKey: `k-c-${randomUUID()}`,
  });
  assert(continent.ok, `continent: ${continent.ok ? '' : continent.error}`);

  const country = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Aland',
    idempotencyKey: `k-co-${randomUUID()}`,
    parentPlaceId: continent.value.targetPlaceId,
  });
  assert(country.ok, `country: ${country.ok ? '' : country.error}`);

  const place = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Hafen',
    idempotencyKey: `k-p-${randomUUID()}`,
    parentPlaceId: country.value.targetPlaceId,
  });
  assert(place.ok, `place: ${place.ok ? '' : place.error}`);

  // saga binding on place → preview requiresConfirm
  const bindingId = randomUUID();
  db.prepare(
    `INSERT INTO saga_asset_bindings (
       id, project_id, asset_kind, asset_id, reveal, label, metadata, world_place_id, updated_at
     ) VALUES (?, ?, 'item', ?, 'party', 'Bait', '{}', ?, ?)`,
  ).run(bindingId, projectId, randomUUID(), place.value.targetPlaceId, now);

  // --- 1. Preview counts children + bindings ---
  const previewCountry = previewNode(OWNER, {
    worldProfileId: worldId,
    placeId: country.value.targetPlaceId,
  });
  assert(previewCountry.ok, `preview country: ${previewCountry.ok ? '' : previewCountry.error}`);
  assert(previewCountry.value.childCount >= 1, `childCount=${previewCountry.value.childCount}`);
  assert(
    previewCountry.value.sagaBindingCount >= 1,
    `bindings=${previewCountry.value.sagaBindingCount}`,
  );
  assert(previewCountry.value.requiresConfirm === true, 'requiresConfirm');
  assert(
    previewCountry.value.descendantIds.includes(place.value.targetPlaceId),
    'descendant includes place',
  );

  const leafPreview = previewNode(OWNER, {
    worldProfileId: worldId,
    placeId: place.value.targetPlaceId,
  });
  assert(leafPreview.ok, 'leaf preview');
  // leaf has binding → still requires confirm
  assert(leafPreview.value.requiresConfirm === true, 'leaf requiresConfirm via binding');

  // --- 2. Stranger DENY on preview ---
  const strangerPrev = previewNode(STRANGER, {
    worldProfileId: worldId,
    placeId: country.value.targetPlaceId,
  });
  assert(!strangerPrev.ok && strangerPrev.error === '42501', `stranger → ${strangerPrev.error}`);

  // --- 3. Archive requires confirm when children/bindings ---
  const noConfirmArchive = archiveNode(OWNER, {
    worldProfileId: worldId,
    placeId: country.value.targetPlaceId,
    confirm: false,
  });
  assert(
    !noConfirmArchive.ok && noConfirmArchive.error === '22023',
    `archive no confirm → ${noConfirmArchive.error}`,
  );

  const archived = archiveNode(OWNER, {
    worldProfileId: worldId,
    placeId: country.value.targetPlaceId,
    confirm: true,
  });
  assert(archived.ok, `archive: ${archived.ok ? '' : archived.error}`);
  assert(archived.value.archivedCount >= 2, `archivedCount=${archived.value.archivedCount}`);
  const countryStatus = db
    .prepare(`SELECT status, revision FROM world_places WHERE id = ?`)
    .get(country.value.targetPlaceId);
  assert(countryStatus.status === 'archived', 'country archived');
  assert(countryStatus.revision >= 1, 'revision bumped');

  // Re-archive is defined (idempotent-ish: still archived, revision may bump again)
  const archivedAgain = archiveNode(OWNER, {
    worldProfileId: worldId,
    placeId: country.value.targetPlaceId,
    confirm: true,
  });
  assert(archivedAgain.ok, `re-archive: ${archivedAgain.ok ? '' : archivedAgain.error}`);

  // --- 4. Shared-map preserve (RPC-DATA-SHARED-MAP-DELETE corrective) ---
  // Build two places sharing one overview map: delete one place's subtree must keep shared map.
  const country2 = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Bland',
    idempotencyKey: `k-cb-${randomUUID()}`,
    parentPlaceId: continent.value.targetPlaceId,
  });
  assert(country2.ok, `country2: ${country2.ok ? '' : country2.error}`);
  const placeA = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Nord',
    idempotencyKey: `k-pa-${randomUUID()}`,
    parentPlaceId: country2.value.targetPlaceId,
  });
  assert(placeA.ok, `placeA: ${placeA.ok ? '' : placeA.error}`);
  const placeB = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Sued',
    idempotencyKey: `k-pb-${randomUUID()}`,
    parentPlaceId: country2.value.targetPlaceId,
  });
  assert(placeB.ok, `placeB: ${placeB.ok ? '' : placeB.error}`);

  const sharedMapId = randomUUID();
  db.prepare(
    `INSERT INTO world_atlas_maps (
       id, world_profile_id, parent_map_id, kind, title, sort_order,
       bounds, layers, generator_meta, revision, created_at, updated_at
     ) VALUES (?, ?, NULL, 'region', 'Shared', 0,
       '{"minX":0,"minY":0,"maxX":1,"maxY":1}', '{"type":"FeatureCollection","features":[]}', '{}', 0, ?, ?)`,
  ).run(sharedMapId, worldId, now, now);
  const linkA = randomUUID();
  const linkB = randomUUID();
  db.prepare(
    `INSERT INTO world_place_map_links (
       id, world_profile_id, place_id, map_id, usage, feature_id, anchor, created_at
     ) VALUES (?, ?, ?, ?, 'overview', NULL, '{}', ?)`,
  ).run(linkA, worldId, placeA.value.targetPlaceId, sharedMapId, now);
  db.prepare(
    `INSERT INTO world_place_map_links (
       id, world_profile_id, place_id, map_id, usage, feature_id, anchor, created_at
     ) VALUES (?, ?, ?, ?, 'overview', NULL, '{}', ?)`,
  ).run(linkB, worldId, placeB.value.targetPlaceId, sharedMapId, now);

  // placeA has no children/bindings → requiresConfirm false; delete without confirm ok
  const delA = deleteNode(OWNER, {
    worldProfileId: worldId,
    placeId: placeA.value.targetPlaceId,
    confirm: false,
  });
  assert(delA.ok, `delete A: ${delA.ok ? '' : delA.error}`);
  assert(delA.value.preservedSharedMapIds.includes(sharedMapId), 'shared map preserved');
  assert(!delA.value.deletedMapIds.includes(sharedMapId), 'shared map not deleted');
  const sharedStill = db
    .prepare(`SELECT id FROM world_atlas_maps WHERE id = ?`)
    .get(sharedMapId);
  assert(sharedStill, 'shared map row exists');
  const placeAGone = db
    .prepare(`SELECT id FROM world_places WHERE id = ?`)
    .get(placeA.value.targetPlaceId);
  assert(!placeAGone, 'placeA deleted');

  // --- 5. Delete with confirm clears bindings + exclusive primary map ---
  const delCountry2 = deleteNode(OWNER, {
    worldProfileId: worldId,
    placeId: country2.value.targetPlaceId,
    confirm: false,
  });
  assert(
    !delCountry2.ok && delCountry2.error === '22023',
    `delete country2 no confirm → ${delCountry2.error}`,
  );

  const placesBefore = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  const deleted = deleteNode(OWNER, {
    worldProfileId: worldId,
    placeId: country2.value.targetPlaceId,
    confirm: true,
  });
  assert(deleted.ok, `delete country2: ${deleted.ok ? '' : deleted.error}`);
  assert(deleted.value.deletedCount >= 2, `deletedCount=${deleted.value.deletedCount}`);
  const placesAfter = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert(placesAfter < placesBefore, 'places reduced');
  const placeBGone = db
    .prepare(`SELECT id FROM world_places WHERE id = ?`)
    .get(placeB.value.targetPlaceId);
  assert(!placeBGone, 'placeB deleted with country2');

  // --- 6. Stranger DENY delete ---
  const strangerDel = deleteNode(STRANGER, {
    worldProfileId: worldId,
    placeId: continent.value.targetPlaceId,
    confirm: true,
  });
  assert(!strangerDel.ok && strangerDel.error === '42501', `stranger del → ${strangerDel.error}`);

  console.log('PASS rpc-world-destructive.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
