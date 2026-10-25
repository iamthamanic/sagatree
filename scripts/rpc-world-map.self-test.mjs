#!/usr/bin/env node
/**
 * rpc-world-map.self-test — get_world_map / save_world_map (#861).
 * Location: scripts/rpc-world-map.self-test.mjs
 *
 * Covers Required Tests 1–5 including RPC-SEC-LEGACY-MAP-FLAG (player filter
 * forced by edit rights, not by client p_player_view).
 */
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
const getCmd = pathToFileURL(join(root, 'server/src/application/commands/get_world_map.ts')).href;
const saveCmd = pathToFileURL(join(root, 'server/src/application/commands/save_world_map.ts')).href;
const fixturesUrl = pathToFileURL(
  join(root, 'server/src/application/world-map/__tests__/fixtures.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { get_world_map } = await import(getCmd);
const { save_world_map } = await import(saveCmd);
const { MAP_WITH_HIDDEN_PIN, VALID_MAP } = await import(fixturesUrl);

const work = mkdtempSync(join(tmpdir(), 'rpc-world-map-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 11, `schema>=11 got ${boot.schemaVersion}`);
  const db = boot.db;

  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  });
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
    db,
  });
  const getMap = get_world_map(world);
  const saveMap = save_world_map(world);

  const OWNER = actor('owner-o');
  const PLAYER = actor('player-p');
  const STRANGER = actor('stranger-x');
  const worldId = 'world-861';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'Map World', now);
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('proj-861', worldId, OWNER.actorId, 'Group', now);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, ?, 1, ?)`,
  ).run('proj-861', PLAYER.actorId, 'player', now);

  // --- Fall 1: empty map → revision 0, size 24 ---
  const empty = getMap(OWNER, worldId, false);
  assert(empty.ok, `empty get: ${empty.ok ? '' : empty.error}`);
  assert(empty.value.revision === 0, `empty revision=${empty.value.revision}`);
  assert(empty.value.mapData.size === 24, `empty size=${empty.value.mapData.size}`);
  assert(Array.isArray(empty.value.mapData.pins), 'empty pins array');
  assert(empty.value.updatedAt === null, 'empty updatedAt null');

  // --- Fall 2: only editors save; validation ---
  const playerSave = saveMap(PLAYER, worldId, null, { ...VALID_MAP });
  assert(!playerSave.ok && playerSave.error === '42501', `player save deny: ${playerSave.error}`);

  const badSize = saveMap(OWNER, worldId, null, { ...VALID_MAP, size: 99 });
  assert(!badSize.ok && badSize.error === '22023', `bad size: ${badSize.error}`);

  const badPin = saveMap(OWNER, worldId, null, {
    ...VALID_MAP,
    pins: [{ id: 'p1', imagePath: 'data:image/png;base64,abc', discovered: true }],
  });
  assert(!badPin.ok && badPin.error === '22023', `data: pin: ${badPin.error}`);

  const notObj = saveMap(OWNER, worldId, null, /** @type {any} */ ([]));
  assert(!notObj.ok && notObj.error === '22023', `array mapData: ${notObj.error}`);

  const saved = saveMap(OWNER, worldId, null, { ...VALID_MAP });
  assert(saved.ok, `owner save: ${saved.ok ? '' : saved.error}`);
  assert(saved.value.revision === 1, `first revision=${saved.value.revision}`);
  assert(saved.value.mapData.size === 24, 'saved size');

  // --- Fall 3: CAS conflict 40001; NULL/negative bypass ---
  const conflict = saveMap(OWNER, worldId, 0, { ...VALID_MAP, size: 20 });
  assert(!conflict.ok && conflict.error === '40001', `conflict: ${conflict.error}`);
  const afterConflict = getMap(OWNER, worldId, false);
  assert(afterConflict.ok && afterConflict.value.revision === 1, 'no partial update on conflict');
  assert(afterConflict.value.mapData.size === 24, 'size unchanged after conflict');

  const bypassNull = saveMap(OWNER, worldId, null, { ...VALID_MAP, size: 30 });
  assert(bypassNull.ok && bypassNull.value.revision === 2, `null bypass: ${bypassNull.ok ? bypassNull.value.revision : bypassNull.error}`);

  const bypassNeg = saveMap(OWNER, worldId, -1, { ...VALID_MAP, size: 32 });
  assert(bypassNeg.ok && bypassNeg.value.revision === 3, `neg bypass: ${bypassNeg.ok ? bypassNeg.value.revision : bypassNeg.error}`);

  const okCas = saveMap(OWNER, worldId, 3, { ...MAP_WITH_HIDDEN_PIN });
  assert(okCas.ok && okCas.value.revision === 4, `cas ok: ${okCas.ok ? okCas.value.revision : okCas.error}`);

  // --- Fall 4 + 5 (RPC-SEC-LEGACY-MAP-FLAG): non-editor never sees undiscovered pins ---
  const playerFalse = getMap(PLAYER, worldId, false);
  assert(playerFalse.ok, `player get false: ${playerFalse.ok ? '' : playerFalse.error}`);
  const pinsFalse = playerFalse.value.mapData.pins;
  assert(Array.isArray(pinsFalse) && pinsFalse.length === 1, `player false pins=${pinsFalse?.length}`);
  assert(pinsFalse[0].id === 'visible', 'only visible pin for player false');

  const playerTrue = getMap(PLAYER, worldId, true);
  assert(playerTrue.ok, 'player get true');
  assert(playerTrue.value.mapData.pins.length === 1, 'player true still filtered');

  const playerNullish = getMap(PLAYER, worldId);
  assert(playerNullish.ok && playerNullish.value.mapData.pins.length === 1, 'player default filtered');

  const ownerFull = getMap(OWNER, worldId, false);
  assert(ownerFull.ok && ownerFull.value.mapData.pins.length === 2, 'owner sees hidden pins');

  const ownerPlayerView = getMap(OWNER, worldId, true);
  assert(ownerPlayerView.ok && ownerPlayerView.value.mapData.pins.length === 1, 'owner can request player view');

  // Stranger deny
  const strangerGet = getMap(STRANGER, worldId, false);
  assert(!strangerGet.ok && strangerGet.error === '42501', `stranger: ${strangerGet.error}`);

  const missing = getMap(OWNER, 'no-such-world', false);
  assert(!missing.ok && missing.error === 'P0002', `missing world: ${missing.error}`);

  db.close();
  console.log('PASS rpc-world-map.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
