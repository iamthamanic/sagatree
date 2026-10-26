#!/usr/bin/env node
/**
 * rpc-project-membership.self-test — join_project_by_code + set_my_project_character (#874).
 * Location: scripts/rpc-project-membership.self-test.mjs
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
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;
const joinCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;
const setCmd = pathToFileURL(
  join(root, 'server/src/application/commands/set_my_project_character.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinCmd);
const { set_my_project_character } = await import(setCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-proj-mem-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 13, `schema>=13 got ${boot.schemaVersion}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const character = createCharacterPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  });
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
  });
  const saga = createSagaPorts({ db, authorize: permissions.authorize, project });

  const create = create_project_from_saga_version({ saga, project, world });
  const joinByCode = join_project_by_code({ project, character });
  const setChar = set_my_project_character({ project, character });

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
      initialAdventure: { scene: 'gate' },
    },
  });
  const created = create(GM, native.sagaId, native.versionId, 'Gruppe');
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  const projectId = created.value.id;
  project.setProjectCodeForTests(projectId, 'ab12cd34');

  // --- Fall 1: normalize code + one active player membership ---
  const pc = character.seedPcForTests({ ownerUserId: Player.actorId, name: 'Hero', sheetStatus: 'complete' });
  const joined = joinByCode(Player, '  ab12cd34  ', pc.id);
  assert(joined.ok, `join: ${joined.ok ? '' : joined.error}`);
  assert(joined.projectId === projectId, 'join returns project id');
  const member = project.getMemberForTests(projectId, Player.actorId);
  assert(member && member.active === 1 && member.role === 'player', 'active player row');
  assert(member.characterId === pc.id, 'character bound on join');
  assert(typeof member.id === 'string' && member.id.length > 0, 'member id present');

  // --- Fall 2: duplicate membership / unknown code ---
  const dup = joinByCode(Player, 'AB12CD34', null);
  assert(!dup.ok && dup.error === 'P0001', `dup membership got ${JSON.stringify(dup)}`);
  assert(dup.detail === 'active', `dup detail status got ${dup.detail}`);
  const missing = joinByCode(Stranger, 'ZZZZZZZZ', null);
  assert(!missing.ok && missing.error === 'P0002', `unknown code got ${JSON.stringify(missing)}`);
  const empty = joinByCode(Stranger, '   ', null);
  assert(!empty.ok && empty.error === '22023', `empty code got ${JSON.stringify(empty)}`);
  const unauth = joinByCode({ kind: 'solo-local', actorId: '' }, 'AB12CD34', null);
  assert(!unauth.ok && unauth.error === '42501', 'auth required');

  // --- Fall 3: only complete owned PC; NULL clears ---
  const incomplete = character.seedPcForTests({
    ownerUserId: Player.actorId,
    name: 'Draft',
    sheetStatus: 'incomplete',
  });
  const badSheet = setChar(Player, projectId, incomplete.id);
  assert(!badSheet.ok && badSheet.error === '22023', `incomplete sheet got ${JSON.stringify(badSheet)}`);
  const foreignPc = character.seedPcForTests({ ownerUserId: Stranger.actorId, name: 'Other' });
  const stolen = setChar(Player, projectId, foreignPc.id);
  assert(!stolen.ok && stolen.error === '42501', `foreign pc got ${JSON.stringify(stolen)}`);
  const cleared = setChar(Player, projectId, null);
  assert(cleared.ok, `clear: ${cleared.ok ? '' : cleared.error}`);
  assert(project.getMemberForTests(projectId, Player.actorId)?.characterId == null, 'cleared');

  // --- Fall 4: set requires own active membership; no foreign mutation ---
  const rebound = setChar(Player, projectId, pc.id);
  assert(rebound.ok && rebound.memberId === member.id, 'set returns same member id');
  assert(project.getMemberForTests(projectId, Player.actorId)?.characterId === pc.id, 'rebound');
  const noMember = setChar(Stranger, projectId, foreignPc.id);
  assert(!noMember.ok && noMember.error === 'P0002', `stranger set got ${JSON.stringify(noMember)}`);
  assert(project.getMemberForTests(projectId, GM.actorId)?.characterId == null, 'gm row untouched');

  console.log('PASS rpc-project-membership.self-test');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
