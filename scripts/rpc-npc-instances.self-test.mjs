#!/usr/bin/env node
/**
 * rpc-npc-instances.self-test — spawn/assign/runtime/remove/clear (#877).
 * Location: scripts/rpc-npc-instances.self-test.mjs
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

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const sagaUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const npcUrl = pathToFileURL(join(root, 'server/src/modules/npc-creature/index.ts')).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;
const joinCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;
const playCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_play_session.ts'),
).href;
const spawnCmd = pathToFileURL(
  join(root, 'server/src/application/commands/spawn_npc_creature_instance.ts'),
).href;
const assignCmd = pathToFileURL(
  join(root, 'server/src/application/commands/assign_npc_creature_controller.ts'),
).href;
const updateCmd = pathToFileURL(
  join(root, 'server/src/application/commands/update_npc_creature_instance_runtime.ts'),
).href;
const removeCmd = pathToFileURL(
  join(root, 'server/src/application/commands/remove_npc_creature_instance.ts'),
).href;
const clearCmd = pathToFileURL(
  join(root, 'server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createNpcCreaturePorts } = await import(npcUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinCmd);
const { create_play_session } = await import(playCmd);
const { spawn_npc_creature_instance } = await import(spawnCmd);
const { assign_npc_creature_controller } = await import(assignCmd);
const { update_npc_creature_instance_runtime } = await import(updateCmd);
const { remove_npc_creature_instance } = await import(removeCmd);
const { clear_npc_creature_instance_temp_controllers_for_session } = await import(clearCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-npc-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 16, `schema>=16 got ${boot.schemaVersion}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const character = createCharacterPorts(db);
  const permissions = createPermissionsPorts(
    db,
    { actorHasAccessToSaga: project.actorHasAccessToSaga },
    project,
  );
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
  });
  const saga = createSagaPorts({ db, authorize: permissions.authorize, project });
  const session = createSessionPorts({ db, project });
  const npc = createNpcCreaturePorts({
    db,
    project,
    session: {
      sessionProjectId(sessionId) {
        const row = db
          .prepare(`SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`)
          .get(sessionId);
        return row?.projectId ?? null;
      },
      sessionBelongsToProject(sessionId, projectId) {
        const row = db
          .prepare(`SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`)
          .get(sessionId);
        return Boolean(row && row.projectId === projectId);
      },
    },
    world: {
      canReadWorldProfile(actorIds, worldProfileId) {
        if (project.actorCanAccessWorld(actorIds, worldProfileId)) return true;
        const owner = db
          .prepare(`SELECT owner_user_id AS ownerUserId FROM worlds WHERE id = ?`)
          .get(worldProfileId);
        return Boolean(owner && actorIds.includes(owner.ownerUserId));
      },
      canEditWorldProfile(actorIds, worldProfileId) {
        const owner = db
          .prepare(`SELECT owner_user_id AS ownerUserId FROM worlds WHERE id = ?`)
          .get(worldProfileId);
        return Boolean(owner && actorIds.includes(owner.ownerUserId));
      },
    },
  });

  const create = create_project_from_saga_version({ saga, project, world });
  const joinByCode = join_project_by_code({ project, character });
  const createPlay = create_play_session(session);
  const spawn = spawn_npc_creature_instance(npc);
  const assign = assign_npc_creature_controller(npc);
  const updateRt = update_npc_creature_instance_runtime(npc);
  const remove = remove_npc_creature_instance(npc);
  const clearTemp = clear_npc_creature_instance_temp_controllers_for_session(npc);

  const GM = { kind: 'solo-local', actorId: 'gm-owner' };
  const Player = { kind: 'solo-local', actorId: 'player-a' };
  const Stranger = { kind: 'solo-local', actorId: 'stranger-x' };

  const native = saga.seedNativeForTests({
    slug: 'dornhain.whisper',
    title: 'Dornhain',
    synopsis: 'Starter',
    payload: {
      title: 'Dornhain',
      blurb: '',
      synopsis: 'Starter',
      knowledgeFacts: [],
      locations: [],
      pregens: [],
      packageId: null,
      initialAdventure: {},
    },
  });
  const created = create(GM, native.sagaId, native.versionId, 'Gruppe');
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  const projectId = created.value.id;
  project.setProjectCodeForTests(projectId, 'NPCJOIN1');
  assert(joinByCode(Player, 'NPCJOIN1', null).ok, 'join');

  const defId = 'personal:hero-npc-01';
  npc.seedDefinitionForTests({
    id: defId,
    scope: 'personal',
    ownerUserId: GM.actorId,
    status: 'active',
    sheetMode: 'full',
  });

  const play = createPlay(GM, projectId, 'S1');
  assert(play.ok, 'play session');
  const sessionId = play.value.sessionId;

  // --- Fall 1: spawn/remove GM + session/project checks ---
  assert(!spawn(Player, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: { a: 1 }, runtime: {}, displayName: 'Wolf', sequenceNumber: 1, sessionId,
  }).ok, 'player cannot spawn');
  assert(!spawn(Stranger, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: { a: 1 }, runtime: {}, displayName: 'Wolf', sequenceNumber: 1, sessionId,
  }).ok, 'stranger cannot spawn');
  const badSess = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: {}, runtime: {}, displayName: 'X', sequenceNumber: 1, sessionId: 'no-such',
  });
  assert(!badSess.ok, 'foreign session denied');
  const persistentBound = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'persistent',
    snapshot: {}, runtime: {}, displayName: 'Persist', sequenceNumber: 1, sessionId,
  });
  assert(!persistentBound.ok, 'persistent must not bind session');

  // P1: foreign personal definition not readable
  npc.seedDefinitionForTests({
    id: 'personal:other-owner1',
    scope: 'personal',
    ownerUserId: Stranger.actorId,
    status: 'active',
    sheetMode: 'full',
  });
  assert(
    !spawn(GM, {
      projectId,
      definitionId: 'personal:other-owner1',
      instanceKind: 'generic',
      snapshot: {},
      runtime: {},
      displayName: 'Stolen',
      sequenceNumber: 9,
      sessionId,
    }).ok,
    'foreign personal definition denied',
  );
  // core: ids are snapshot-only (no row)
  assert(
    spawn(GM, {
      projectId,
      definitionId: 'core:wolf-pack-01',
      instanceKind: 'generic',
      snapshot: { cr: 1 },
      runtime: {},
      displayName: 'CoreWolf',
      sequenceNumber: 10,
      sessionId,
    }).ok,
    'core definition allowed without row',
  );

  const spawned = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: { hp: 10 }, runtime: { temporaryControllerUserId: Player.actorId },
    displayName: 'Wolf', sequenceNumber: 1, sessionId,
  });
  assert(spawned.ok, `spawn: ${spawned.ok ? '' : spawned.error}`);
  assert(!remove(Player, spawned.value.id).ok, 'player cannot remove');
  assert(remove(GM, spawned.value.id).ok, 'gm remove');

  // --- Fall 2: runtime update GM-only; snapshot unchanged; controller no write ---
  const inst = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: { hp: 10 }, runtime: { temporaryControllerUserId: Player.actorId },
    displayName: 'Bear', sequenceNumber: 2, sessionId,
  });
  assert(inst.ok, 'inst');
  const snapBefore = inst.value.snapshot;
  assert(!updateRt(Player, inst.value.id, { hp: 3 }).ok, 'controller cannot update runtime');
  const updated = updateRt(GM, inst.value.id, { stance: 'aggressive' });
  assert(updated.ok, `update: ${updated.ok ? '' : updated.error}`);
  assert(
    JSON.stringify(updated.value.snapshot) === JSON.stringify(snapBefore),
    'snapshot unchanged',
  );
  assert(updated.value.runtime.stance === 'aggressive', 'runtime replaced');
  // P2: inactive/nonmember temporary controller rejected on runtime update
  assert(
    !updateRt(GM, inst.value.id, { temporaryControllerUserId: Stranger.actorId }).ok,
    'nonmember temp controller on update denied',
  );
  assert(
    !updateRt(GM, inst.value.id, { temporaryControllerUserId: 123 }).ok,
    'non-string temp controller denied',
  );
  assert(
    !updateRt(GM, inst.value.id, { temporaryControllerUserId: '' }).ok,
    'empty temp controller denied',
  );

  // --- Fall 3: assign controller — active member; full-sheet definition ---
  assert(!assign(Player, projectId, defId, Player.actorId).ok, 'player cannot assign');
  assert(!assign(GM, projectId, defId, '').ok, 'empty controller id denied');
  const assigned = assign(GM, projectId, defId, Player.actorId);
  assert(assigned.ok, `assign: ${assigned.ok ? '' : assigned.error}`);
  assert(assigned.value.controllerUserId === Player.actorId, 'controller set');
  npc.seedDefinitionForTests({
    id: 'personal:draft-npcxx',
    scope: 'personal',
    ownerUserId: GM.actorId,
    status: 'active',
    sheetMode: 'lite',
  });
  assert(!assign(GM, projectId, 'personal:draft-npcxx', Player.actorId).ok, 'lite sheet denied');
  assert(
    !assign(GM, projectId, 'personal:other-owner1', Player.actorId).ok,
    'foreign personal assign denied',
  );
  assert(
    !spawn(GM, {
      projectId,
      definitionId: defId,
      instanceKind: 'generic',
      snapshot: {},
      runtime: {},
      displayName: 'TooBig',
      sequenceNumber: 100001,
      sessionId,
    }).ok,
    'sequence >100000 denied',
  );

  // --- Fall 4: clear temp controllers for session only ---
  const withTemp = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: {}, runtime: { temporaryControllerUserId: Player.actorId },
    displayName: 'TempWolf', sequenceNumber: 3, sessionId,
  });
  assert(withTemp.ok, 'withTemp');
  const otherPlay = createPlay(GM, projectId, 'S2');
  assert(otherPlay.ok, 'other play');
  const other = spawn(GM, {
    projectId, definitionId: defId, instanceKind: 'generic',
    snapshot: {}, runtime: { temporaryControllerUserId: Player.actorId },
    displayName: 'Other', sequenceNumber: 1, sessionId: otherPlay.value.sessionId,
  });
  assert(other.ok, 'other inst');
  const cleared = clearTemp(GM, sessionId);
  assert(cleared.ok && cleared.value.cleared === 1, `cleared=${JSON.stringify(cleared)}`);
  const afterClear = db
    .prepare(`SELECT runtime FROM npc_creature_instances WHERE id = ?`)
    .get(withTemp.value.id);
  assert(JSON.parse(afterClear.runtime).temporaryControllerUserId === null, 'temp cleared to null');
  const clearedAgain = clearTemp(GM, sessionId);
  assert(
    clearedAgain.ok && clearedAgain.value.cleared === 0,
    `noop clear=${JSON.stringify(clearedAgain)}`,
  );
  const otherRt = db
    .prepare(`SELECT runtime FROM npc_creature_instances WHERE id = ?`)
    .get(other.value.id);
  assert(JSON.parse(otherRt.runtime).temporaryControllerUserId === Player.actorId, 'other session intact');

  console.log('rpc-npc-instances.self-test: PASS');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
