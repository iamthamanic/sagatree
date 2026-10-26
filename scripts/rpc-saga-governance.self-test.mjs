#!/usr/bin/env node
/**
 * rpc-saga-governance.self-test — permissions/bindings/bundles (#875).
 * Location: scripts/rpc-saga-governance.self-test.mjs
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
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const getPerm = pathToFileURL(
  join(root, 'server/src/application/commands/get_my_saga_permissions.ts'),
).href;
const listBind = pathToFileURL(
  join(root, 'server/src/application/commands/list_saga_bindings.ts'),
).href;
const listMembers = pathToFileURL(
  join(root, 'server/src/application/commands/list_saga_member_permission_state.ts'),
).href;
const setBundle = pathToFileURL(
  join(root, 'server/src/application/commands/set_saga_member_bundle.ts'),
).href;
const setReveal = pathToFileURL(
  join(root, 'server/src/application/commands/set_saga_binding_reveal.ts'),
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
const { get_my_saga_permissions } = await import(getPerm);
const { list_saga_bindings } = await import(listBind);
const { list_saga_member_permission_state } = await import(listMembers);
const { set_saga_member_bundle } = await import(setBundle);
const { set_saga_binding_reveal } = await import(setReveal);

const work = mkdtempSync(join(tmpdir(), 'rpc-saga-gov-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 14, `schema>=14 got ${boot.schemaVersion}`);
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

  const create = create_project_from_saga_version({ saga, project, world });
  const joinByCode = join_project_by_code({ project, character });
  const getPerms = get_my_saga_permissions({ permissions });
  const listBindings = list_saga_bindings({ permissions });
  const listMembersState = list_saga_member_permission_state({ permissions });
  const setMemberBundle = set_saga_member_bundle({ permissions });
  const setRevealFn = set_saga_binding_reveal({ permissions });

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
  const publicId = created.value.publicId;
  project.setProjectCodeForTests(projectId, 'GOVCODE1');
  const pc = character.seedPcForTests({ ownerUserId: Player.actorId, name: 'Hero' });
  const joined = joinByCode(Player, 'GOVCODE1', pc.id);
  assert(joined.ok, `join: ${joined.ok ? '' : joined.error}`);
  const playerMember = project.getMemberForTests(projectId, Player.actorId);
  assert(playerMember?.id, 'player member id');
  const gmMember = project.getMemberForTests(projectId, GM.actorId);
  assert(gmMember?.id, 'gm member id');

  // Seed GM governance grants so last-governance guard is testable
  const seedBundle = setMemberBundle(GM, projectId, gmMember.id, 'bundle.saga.gm');
  assert(seedBundle.ok, `seed gm bundle: ${seedBundle.ok ? '' : seedBundle.error}`);

  // --- Fall 1: GM/grants determine keys; player after bundle ---
  const gmPerms = getPerms(GM, publicId);
  assert(gmPerms.ok, `gm perms: ${gmPerms.ok ? '' : gmPerms.error}`);
  assert(gmPerms.value.isGm === true, 'gm isGm');
  assert(gmPerms.value.keys.includes('saga.members.set_bundle'), 'gm has set_bundle');
  assert(gmPerms.value.bundleId === 'bundle.saga.gm', 'gm default bundle');

  const setPlayer = setMemberBundle(GM, projectId, playerMember.id, 'bundle.saga.player');
  assert(setPlayer.ok, `set player: ${setPlayer.ok ? '' : setPlayer.error}`);
  assert(setPlayer.value.grantCount > 0, 'player grant count');
  const playerPerms = getPerms(Player, publicId);
  assert(playerPerms.ok, `player perms: ${playerPerms.ok ? '' : playerPerms.error}`);
  assert(playerPerms.value.isGm === false, 'player not gm');
  assert(playerPerms.value.bundleId === 'bundle.saga.player', 'player bundle');
  assert(!playerPerms.value.keys.includes('saga.members.set_bundle'), 'player no governance');
  assert(playerPerms.value.keys.includes('saga.workspace.access'), 'player workspace');

  // --- Fall 2: cannot revoke last governance ---
  const demoteLast = setMemberBundle(GM, projectId, gmMember.id, 'bundle.saga.player');
  assert(!demoteLast.ok, `last governance guard: ${JSON.stringify(demoteLast)}`);
  assert(
    String(demoteLast.error).includes('cannot revoke last'),
    `last governance message got ${demoteLast.error}`,
  );

  // --- Fall 3/4: bindings reveal + unlisted excluded even for GM ---
  const store = permissions.sagaGovernance;
  const partyId = store.seedBindingForTests({
    projectId,
    assetKind: 'npc',
    assetId: 'n1',
    reveal: 'party',
    label: 'Party NPC',
  });
  const gmOnlyId = store.seedBindingForTests({
    projectId,
    assetKind: 'npc',
    assetId: 'n2',
    reveal: 'gm_only',
    label: 'Hidden NPC',
  });
  const unlistedId = store.seedBindingForTests({
    projectId,
    assetKind: 'npc',
    assetId: 'n3',
    reveal: 'unlisted',
    label: 'Unlisted NPC',
  });
  const gmList = listBindings(GM, publicId, 'npc');
  assert(gmList.ok, `gm list: ${gmList.ok ? '' : gmList.error}`);
  const gmIds = gmList.value.map((b) => b.id);
  assert(gmIds.includes(partyId) && gmIds.includes(gmOnlyId), 'gm sees party+gm_only');
  assert(!gmIds.includes(unlistedId), 'unlisted excluded for GM standard list');
  const playerList = listBindings(Player, publicId, 'npc');
  assert(playerList.ok, `player list: ${playerList.ok ? '' : playerList.error}`);
  const pIds = playerList.value.map((b) => b.id);
  assert(pIds.includes(partyId) && !pIds.includes(gmOnlyId) && !pIds.includes(unlistedId), 'player party only');

  const revealed = setRevealFn(GM, projectId, gmOnlyId, 'party');
  assert(revealed.ok && revealed.value.reveal === 'party', `reveal: ${JSON.stringify(revealed)}`);
  const badReveal = setRevealFn(GM, projectId, gmOnlyId, 'everyone');
  assert(!badReveal.ok, 'invalid reveal rejected');
  const strangerReveal = setRevealFn(Stranger, projectId, partyId, 'unlisted');
  assert(!strangerReveal.ok, 'stranger cannot reveal');

  // Member permission state for GM
  const members = listMembersState(GM, publicId);
  assert(members.ok && members.value.length >= 2, `members: ${JSON.stringify(members)}`);
  assert(members.value.every((m) => typeof m.canSetBundle === 'boolean'), 'canSetBundle present');

  const strangerPerms = getPerms(Stranger, publicId);
  assert(!strangerPerms.ok && strangerPerms.error === 'not a member', 'stranger denied');

  console.log('PASS rpc-saga-governance.self-test');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
