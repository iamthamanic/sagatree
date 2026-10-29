#!/usr/bin/env node
/**
 * mig-310-saga-adapter.self-test — Saga host ports + dual-path seam (#809).
 * Location: scripts/mig-310-saga-adapter.self-test.mjs
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
const infraUrl = pathToFileURL(join(root, 'server/src/application/saga-infra/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const playCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_play_session.ts'),
).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createSagaInfraPorts } = await import(infraUrl);
const { createHost } = await import(hostUrl);
const { create_play_session } = await import(playCmd);

/** Load real Vite extensionless adapter into Node via rewritten temp copies. */
const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig310-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-saga-ports.contract.ts', 'host-saga-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/saga', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostSagaAdapter }, { HOST_SAGA_OPS, HOST_SAGA_RPC_NAMES }] =
  await Promise.all([
    import(pathToFileURL(join(adapterLoadDir, 'host-saga-adapter.ts')).href),
    import(pathToFileURL(join(adapterLoadDir, 'host-saga-ports.contract.ts')).href),
  ]);
assert(typeof createHostSagaAdapter === 'function', 'createHostSagaAdapter loaded');
assert(Array.isArray(HOST_SAGA_OPS) && HOST_SAGA_OPS.length === 11, 'HOST_SAGA_OPS count');
assert(
  Array.isArray(HOST_SAGA_RPC_NAMES) && HOST_SAGA_RPC_NAMES.length === 11,
  'HOST_SAGA_RPC_NAMES count',
);
assert(
  HOST_SAGA_RPC_NAMES.includes('promote_session_outcome_to_saga') &&
    HOST_SAGA_RPC_NAMES.includes('promote_session_outcome_to_world'),
  'both promote RPCs listed',
);

const work = mkdtempSync(join(tmpdir(), 'mig310-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(TABLE_OWNERSHIP.saga_definitions === 'saga', 'saga_definitions ownership');

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
  const infra = createSagaInfraPorts({ saga, project, world });
  assert(infra.moduleId === 'saga-infra', 'module id');

  const Owner = actor('owner-o');
  const GM = actor('gm-owner');
  const Stranger = actor('stranger-x');
  const createPlay = create_play_session(session);

  // --- Fall 1: create / edit / save / publish / read / copy / instantiate ---
  const created = infra.createUserSagaDefinition(Owner, 'Meine Saga', 'Blurb');
  assert(created.ok, `create user saga: ${created.ok ? '' : created.error}`);
  assert(created.value.revision === 0, 'revision 0');
  assert(typeof created.value.sagaId === 'string', 'sagaId');

  const editor = infra.getSagaDefinitionEditor(Owner, created.value.sagaId);
  assert(editor.ok && editor.value.canEdit === true, 'editor owner canEdit');

  const saved = infra.saveSagaDefinitionDraft(
    Owner,
    created.value.sagaId,
    { title: 'Meine Saga', blurb: 'x', synopsis: 'x' },
    0,
  );
  assert(saved.ok && saved.value.revision === 1, `save: ${saved.ok ? saved.value.revision : saved.error}`);

  const conflict = infra.saveSagaDefinitionDraft(
    Owner,
    created.value.sagaId,
    { title: 'stale' },
    0,
  );
  assert(!conflict.ok && conflict.error === '40001', 'revision conflict');

  const published = infra.publishSagaDefinitionVersion(Owner, created.value.sagaId, 1);
  assert(
    published.ok && published.value.versionLabel === 'v1',
    `publish: ${published.ok ? published.value.versionLabel : published.error}`,
  );

  const versionRead = infra.getSagaDefinitionVersion(Owner, published.value.versionId);
  assert(versionRead.ok, `version read: ${versionRead.ok ? '' : versionRead.error}`);

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

  const nativeBySlug = infra.getNativeSagaDefinitionBySlug(Owner, 'dornhain.whisper');
  assert(nativeBySlug.ok, `native by slug: ${nativeBySlug.ok ? '' : nativeBySlug.error}`);

  const nativeSave = infra.saveSagaDefinitionDraft(Owner, native.sagaId, { title: 'Nope' }, 0);
  assert(!nativeSave.ok && nativeSave.error === '42501', 'native immutable');

  const copied = infra.copyNativeSagaDefinition(Owner, native.sagaId);
  assert(copied.ok, `copy native: ${copied.ok ? '' : copied.error}`);
  assert(typeof copied.value.sagaId === 'string', 'copy sagaId');

  const badCopy = infra.copyNativeSagaDefinition(Owner, created.value.sagaId);
  assert(!badCopy.ok && badCopy.error === '22023', 'only native copyable');

  const instantiated = infra.createProjectFromSagaVersion(
    Owner,
    native.sagaId,
    native.versionId,
    'Gruppe',
  );
  assert(instantiated.ok, `instantiate: ${instantiated.ok ? '' : instantiated.error}`);
  assert(
    /^SA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(instantiated.value.publicId),
    `publicId ${instantiated.value.publicId}`,
  );
  assert(typeof instantiated.value.id === 'string', 'project id');

  // --- Fall 2: duplicate + promote; foreign DENY ---
  const freshDup = infra.duplicateSagaPlaythrough(Owner, instantiated.value.id, 'fresh');
  assert(freshDup.ok, `fresh dup: ${freshDup.ok ? '' : freshDup.error}`);
  assert(!infra.duplicateSagaPlaythrough(Stranger, instantiated.value.id, 'fresh').ok, 'foreign dup DENY');

  const userSaga = saga.seedPublishedDefinitionForTests({
    slug: 'user.mig310',
    title: 'User Saga',
    synopsis: 'Owned',
    origin: 'user',
    ownerUserId: GM.actorId,
    payload: {
      title: 'User Saga',
      blurb: '',
      synopsis: 'Owned',
      knowledgeFacts: [],
      locations: [],
      pregens: [],
      packageId: null,
      initialAdventure: {
        clocks: [],
        consequences: [],
      },
    },
  });
  const gmProject = infra.createProjectFromSagaVersion(
    GM,
    userSaga.sagaId,
    userSaga.versionId,
    'Promo Gruppe',
  );
  assert(gmProject.ok, `gm project: ${gmProject.ok ? '' : gmProject.error}`);
  db.prepare(`UPDATE projects SET adventure_runtime = ? WHERE id = ?`).run(
    JSON.stringify({
      clocks: [],
      consequences: [
        { id: 'cons-shared', summary: 'Shared', visibility: 'shared' },
        { id: 'cons-gm', summary: 'GM only', visibility: 'gm_only' },
      ],
      openDeadlines: [],
      flags: [],
    }),
    gmProject.value.id,
  );
  const play = createPlay(GM, gmProject.value.id, 'Abend');
  assert(play.ok, `play: ${play.ok ? '' : play.error}`);
  const sessionId = play.value.sessionId;

  assert(
    !infra.promoteSessionOutcomeToSaga(Stranger, sessionId, 'cons-shared').ok,
    'stranger promote saga DENY',
  );
  const promo = infra.promoteSessionOutcomeToSaga(GM, sessionId, 'cons-shared');
  assert(
    promo.ok && promo.value.ok === true,
    `promote saga: ${promo.ok ? JSON.stringify(promo.value) : promo.error}`,
  );
  const worldPromo = infra.promoteSessionOutcomeToWorld(GM, sessionId, 'cons-gm');
  assert(
    worldPromo.ok && worldPromo.value.ok === true,
    `promote world: ${worldPromo.ok ? JSON.stringify(worldPromo.value) : worldPromo.error}`,
  );

  // --- Fall 3: all 11 RPC ops present ---
  for (const op of HOST_SAGA_OPS) {
    assert(typeof infra[op] === 'function', `infra has ${op}`);
  }

  // DENY: stranger / missing actor
  assert(
    !infra.getSagaDefinitionEditor(Stranger, created.value.sagaId).ok ||
      infra.getSagaDefinitionEditor(Stranger, created.value.sagaId).value.canEdit === false,
    'stranger editor not editable',
  );
  assert(
    !infra.saveSagaDefinitionDraft(Stranger, created.value.sagaId, { title: 'Hack' }, 1).ok,
    'stranger save DENY',
  );
  const missing = infra.createUserSagaDefinition(
    { kind: 'solo-local', actorId: '' },
    'Nope',
    '',
  );
  assert(!missing.ok && missing.error === '42501', 'missing actor DENY');

  // Dual-path adapter seam
  const bound = createHostSagaAdapter({
    copyNativeSagaDefinition: async (actorId, sourceSagaId) =>
      infra.copyNativeSagaDefinition(actor(actorId), sourceSagaId),
    createProjectFromSagaVersion: async (actorId, sagaId, versionId, name) =>
      infra.createProjectFromSagaVersion(actor(actorId), sagaId, versionId, name),
    createUserSagaDefinition: async (actorId, title, blurb) =>
      infra.createUserSagaDefinition(actor(actorId), title, blurb),
    duplicateSagaPlaythrough: async (actorId, projectId, mode) =>
      infra.duplicateSagaPlaythrough(actor(actorId), projectId, mode),
    getNativeSagaDefinitionBySlug: async (actorId, slug) =>
      infra.getNativeSagaDefinitionBySlug(actor(actorId), slug),
    getSagaDefinitionEditor: async (actorId, sagaId) =>
      infra.getSagaDefinitionEditor(actor(actorId), sagaId),
    getSagaDefinitionVersion: async (actorId, versionId) =>
      infra.getSagaDefinitionVersion(actor(actorId), versionId),
    promoteSessionOutcomeToSaga: async (actorId, sid, consequenceId) =>
      infra.promoteSessionOutcomeToSaga(actor(actorId), sid, consequenceId),
    promoteSessionOutcomeToWorld: async (actorId, sid, consequenceId) =>
      infra.promoteSessionOutcomeToWorld(actor(actorId), sid, consequenceId),
    publishSagaDefinitionVersion: async (actorId, sagaId, expectedRevision) =>
      infra.publishSagaDefinitionVersion(actor(actorId), sagaId, expectedRevision),
    saveSagaDefinitionDraft: async (actorId, sagaId, payload, expectedRevision) =>
      infra.saveSagaDefinitionDraft(actor(actorId), sagaId, payload, expectedRevision),
  });
  assert(bound.transport === 'host', 'adapter transport');
  assert(bound.rpcNames.length === 11, 'adapter rpcNames');
  const viaAdapter = await bound.getSagaDefinitionEditor(Owner.actorId, created.value.sagaId);
  assert(viaAdapter.ok, 'adapter getSagaDefinitionEditor');
  const viaPromo = await bound.promoteSessionOutcomeToSaga(
    GM.actorId,
    sessionId,
    'cons-shared',
  );
  assert(viaPromo.ok && viaPromo.value.idempotent === true, 'adapter promote idempotent');

  // create-host wires sagaInfra
  const hostWork = mkdtempSync(join(tmpdir(), 'mig310-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18770',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.sagaInfra?.moduleId === 'saga-infra', 'create-host exposes sagaInfra');
    // Distinguish real ports from createSagaInfraPortsStub (same moduleId, all ops store-unavailable).
    const wiringProbe = host.sagaInfra.getNativeSagaDefinitionBySlug(
      { kind: 'solo-local', actorId: 'probe-actor' },
      'nope',
    );
    assert(
      !wiringProbe.ok && wiringProbe.error !== 'store-unavailable',
      `sagaInfra wired to real ports, got ${wiringProbe.ok ? 'ok' : wiringProbe.error}`,
    );
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  // Client dual-path wiring + Supabase default remains
  const serviceFiles = [
    'saga-definition-service.ts',
    'session-outcome-promotion-service.ts',
  ];
  for (const name of serviceFiles) {
    const src = readFileSync(join(root, 'src/infrastructure/saga', name), 'utf8');
    assert(/Dual-path \(MIG-310\)/.test(src), `dual-path note on ${name}`);
    assert(/supabase\.rpc|from ['"].*supabase['"]/.test(src), `${name} uses supabase`);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!/VITE_SAGATREE_HOST/i.test(code), `${name}: flags do not redirect facade`);
  }
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/saga/host-saga-adapter.ts'),
    'utf8',
  );
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');
  assert(
    /callPromote/.test(
      readFileSync(join(root, 'src/infrastructure/saga/session-outcome-promotion-service.ts'), 'utf8'),
    ),
    'typed callPromote helper retained',
  );

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(
    !/mountSagaInfra|saga-infra-http|sagaInfraHttp/i.test(createApp),
    'no saga-infra HTTP mount yet',
  );

  db.close();
  console.log('PASS mig-310-saga-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
