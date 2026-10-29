#!/usr/bin/env node
/**
 * mig-308-project-adapter.self-test — Project host ports + dual-path seam (#807).
 * Location: scripts/mig-308-project-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  return { kind: 'remote-account', actorId: id, sessionId: `auth-${id}`, email: null };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const sagaUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const infraUrl = pathToFileURL(join(root, 'server/src/application/project-infra/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createProjectInfraPorts } = await import(infraUrl);
const { createHost } = await import(hostUrl);
const { create_project_from_saga_version } = await import(createCmd);

/** Load real Vite extensionless adapter into Node via rewritten temp copies. */
const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig308-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-project-ports.contract.ts', 'host-project-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/project', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostProjectAdapter }, { HOST_PROJECT_OPS, HOST_PROJECT_RPC_NAMES }] =
  await Promise.all([
    import(pathToFileURL(join(adapterLoadDir, 'host-project-adapter.ts')).href),
    import(pathToFileURL(join(adapterLoadDir, 'host-project-ports.contract.ts')).href),
  ]);
assert(typeof createHostProjectAdapter === 'function', 'createHostProjectAdapter loaded');
assert(
  Array.isArray(HOST_PROJECT_OPS) && HOST_PROJECT_OPS.length === 11,
  'HOST_PROJECT_OPS count',
);
assert(
  Array.isArray(HOST_PROJECT_RPC_NAMES) && HOST_PROJECT_RPC_NAMES.length === 11,
  'HOST_PROJECT_RPC_NAMES count',
);

const work = mkdtempSync(join(tmpdir(), 'mig308-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(TABLE_OWNERSHIP.projects === 'project', 'projects ownership');
  assert(TABLE_OWNERSHIP.project_members === 'project', 'project_members ownership');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 19, `schema>=19 got ${boot.schemaVersion}`);

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
    db,
    actorCanAccessWorld: project.actorCanAccessWorld,
  });
  const saga = createSagaPorts({
    db,
    authorize: permissions.authorize,
    project,
    loreAcl: permissions.sagaGovernance,
    world: {
      canEditWorld: (ids, wid) => world.canEditWorld(ids, wid),
      appendPromotedLoreFact: (wid, fact) => world.appendPromotedLoreFact(wid, fact),
    },
    characterNames: { getDisplayName: (id) => character.getDisplayName(id) },
  });
  const session = createSessionPorts({ db, project });
  const infra = createProjectInfraPorts({
    project,
    character,
    saga,
    world,
    permissions,
    session,
  });
  assert(infra.moduleId === 'project-infra', 'module id');

  const GM = actor('gm-owner');
  const Player = actor('player-a');
  const Stranger = actor('stranger-x');

  // Seed native + create play group for RPC surface
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
  const create = create_project_from_saga_version({ saga, project, world });
  const created = create(GM, native.sagaId, native.versionId, 'Gruppe');
  assert(created.ok, `create project: ${created.ok ? '' : created.error}`);
  const projectId = created.value.id;
  const publicId = created.value.publicId;
  project.setProjectCodeForTests(projectId, 'MIG308J1');

  // --- Fall 1: ensure starter / join / character / session / overview ---
  const ensured = infra.ensureNativeStarterProject(GM, 'dornhain.whisper');
  assert(ensured.ok, `ensure starter: ${ensured.ok ? '' : ensured.error}`);
  assert(ensured.value.created === false, 'ensure returns existing GM project');
  assert(ensured.value.publicId === publicId, 'ensure public id');

  const pc = character.seedPcForTests({
    ownerUserId: Player.actorId,
    name: 'Hero',
    sheetStatus: 'complete',
  });
  const joined = infra.joinProjectByCode(Player, '  mig308j1  ', pc.id);
  assert(joined.ok, `join: ${joined.ok ? '' : joined.error}`);
  assert(joined.value.projectId === projectId, 'join projectId');

  const setChar = infra.setMyProjectCharacter(Player, projectId, pc.id);
  assert(setChar.ok, `set character: ${setChar.ok ? '' : setChar.error}`);
  assert(typeof setChar.value.memberId === 'string', 'memberId');

  const sess = infra.createProjectSession(Player, projectId, 'Abend 1', null);
  assert(sess.ok, `create session: ${sess.ok ? '' : sess.error}`);
  assert(sess.value.projectId === projectId, 'session projectId');
  assert(typeof sess.value.id === 'string' && sess.value.id.length > 0, 'session id');

  const overview = infra.getSagaOverview(Player, publicId);
  assert(overview.ok, `overview: ${overview.ok ? '' : overview.error}`);
  assert(overview.value && typeof overview.value === 'object', 'overview object');

  // --- Fall 2: all 11 RPC ops present ---
  for (const op of HOST_PROJECT_OPS) {
    assert(typeof infra[op] === 'function', `infra has ${op}`);
  }

  // --- Fall 3: governance / bindings / lore / DENY ---
  const gmMember = project.getMemberForTests(projectId, GM.actorId);
  assert(gmMember?.id, 'gm member id');
  const playerMember = project.getMemberForTests(projectId, Player.actorId);
  assert(playerMember?.id, 'player member id');

  const seedGm = infra.setSagaMemberBundle(
    GM,
    projectId,
    gmMember.id,
    'bundle.saga.gm',
  );
  assert(seedGm.ok, `seed gm bundle: ${seedGm.ok ? '' : seedGm.error}`);
  const setPlayerBundle = infra.setSagaMemberBundle(
    GM,
    projectId,
    playerMember.id,
    'bundle.saga.player',
  );
  assert(setPlayerBundle.ok, `player bundle: ${setPlayerBundle.ok ? '' : setPlayerBundle.error}`);

  const gmPerms = infra.getMySagaPermissions(GM, publicId);
  assert(gmPerms.ok && gmPerms.value.isGm === true, 'gm perms');
  const playerPerms = infra.getMySagaPermissions(Player, publicId);
  assert(playerPerms.ok && playerPerms.value.isGm === false, 'player perms');
  assert(playerPerms.value.bundleId === 'bundle.saga.player', 'player bundle id');

  const members = infra.listSagaMemberPermissionState(GM, publicId);
  assert(members.ok && members.value.length >= 2, 'member permission state');

  // Lore requires saga.lore.read for non-GM (granted via player bundle above).
  const lore = infra.getSagaLoreTimeline(Player, publicId);
  assert(lore.ok, `lore: ${lore.ok ? '' : lore.error}`);
  const loreGm = infra.getSagaLoreTimeline(GM, publicId);
  assert(loreGm.ok, `lore gm: ${loreGm.ok ? '' : loreGm.error}`);

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

  const gmBindings = infra.listSagaBindings(GM, publicId, 'npc');
  assert(gmBindings.ok, 'gm bindings');
  const gmBindIds = gmBindings.value.map((b) => b.id);
  assert(gmBindIds.includes(partyId) && gmBindIds.includes(gmOnlyId), 'gm sees both');

  const playerBindings = infra.listSagaBindings(Player, publicId, 'npc');
  assert(playerBindings.ok, 'player bindings');
  const pBindIds = playerBindings.value.map((b) => b.id);
  assert(pBindIds.includes(partyId) && !pBindIds.includes(gmOnlyId), 'player party only');

  const revealed = infra.setSagaBindingReveal(GM, projectId, gmOnlyId, 'party');
  assert(revealed.ok && revealed.value.reveal === 'party', 'reveal to party');

  // DENY: stranger / missing actor / foreign character
  assert(!infra.getMySagaPermissions(Stranger, publicId).ok, 'stranger perms DENY');
  assert(!infra.getSagaOverview(Stranger, publicId).ok, 'stranger overview DENY');
  assert(!infra.joinProjectByCode(Stranger, 'ZZZZZZZZ', null).ok, 'unknown code DENY');
  assert(!infra.createProjectSession(Stranger, projectId, 'X').ok, 'stranger session DENY');
  assert(
    !infra.setSagaBindingReveal(Stranger, projectId, partyId, 'unlisted').ok,
    'stranger reveal DENY',
  );
  assert(
    !infra.setSagaMemberBundle(Player, projectId, playerMember.id, 'bundle.saga.gm').ok,
    'player cannot set bundle',
  );
  const foreignPc = character.seedPcForTests({
    ownerUserId: GM.actorId,
    name: 'GM-PC',
    sheetStatus: 'complete',
  });
  assert(
    !infra.setMyProjectCharacter(Player, projectId, foreignPc.id).ok,
    'foreign character DENY',
  );
  const missing = infra.joinProjectByCode(
    { kind: 'solo-local', actorId: '' },
    'MIG308J1',
    null,
  );
  assert(!missing.ok && missing.error === '42501', 'missing actor DENY');

  // Dual-path adapter seam
  const bound = createHostProjectAdapter({
    createProjectSession: async (actorId, pid, name, notes) =>
      infra.createProjectSession(actor(actorId), pid, name, notes),
    ensureNativeStarterProject: async (actorId, slug) =>
      infra.ensureNativeStarterProject(actor(actorId), slug),
    getMySagaPermissions: async (actorId, pid) =>
      infra.getMySagaPermissions(actor(actorId), pid),
    getSagaLoreTimeline: async (actorId, pid) =>
      infra.getSagaLoreTimeline(actor(actorId), pid),
    getSagaOverview: async (actorId, pid) => infra.getSagaOverview(actor(actorId), pid),
    joinProjectByCode: async (actorId, code, characterId) =>
      infra.joinProjectByCode(actor(actorId), code, characterId),
    listSagaBindings: async (actorId, pid, kind) =>
      infra.listSagaBindings(actor(actorId), pid, kind),
    listSagaMemberPermissionState: async (actorId, pid) =>
      infra.listSagaMemberPermissionState(actor(actorId), pid),
    setMyProjectCharacter: async (actorId, pid, characterId) =>
      infra.setMyProjectCharacter(actor(actorId), pid, characterId),
    setSagaBindingReveal: async (actorId, pid, bindingId, reveal) =>
      infra.setSagaBindingReveal(actor(actorId), pid, bindingId, reveal),
    setSagaMemberBundle: async (actorId, pid, memberId, bundleId) =>
      infra.setSagaMemberBundle(actor(actorId), pid, memberId, bundleId),
  });
  assert(bound.transport === 'host', 'adapter transport');
  assert(bound.rpcNames.length === 11, 'adapter rpcNames');
  const viaAdapter = await bound.getMySagaPermissions(GM.actorId, publicId);
  assert(viaAdapter.ok && viaAdapter.value.isGm === true, 'adapter getMySagaPermissions');
  const viaOverview = await bound.getSagaOverview(Player.actorId, publicId);
  assert(viaOverview.ok, 'adapter overview');

  // create-host wires projectInfra
  const hostWork = mkdtempSync(join(tmpdir(), 'mig308-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18769',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.projectInfra?.moduleId === 'project-infra', 'create-host exposes projectInfra');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  // Client dual-path wiring + Supabase default remains
  const serviceFiles = [
    'project-member-service.ts',
    'project-service.ts',
    'saga-overview-service.ts',
    'saga-permission-service.ts',
  ];
  for (const name of serviceFiles) {
    const src = readFileSync(join(root, 'src/infrastructure/project', name), 'utf8');
    assert(/Dual-path \(MIG-308\)/.test(src), `dual-path note on ${name}`);
    assert(/from ['"].*supabase['"]/.test(src) || /supabase\.rpc|supabase\n/.test(src) || /supabase\./.test(src), `${name} uses supabase`);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!/VITE_SAGATREE_HOST/i.test(code), `${name}: flags do not redirect facade`);
  }
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/project/host-project-adapter.ts'),
    'utf8',
  );
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(
    !/mountProjectInfra|project-infra-http|projectInfraHttp/i.test(createApp),
    'no project-infra HTTP mount yet',
  );

  console.log('PASS mig-308-project-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
