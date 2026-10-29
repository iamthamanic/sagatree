#!/usr/bin/env node
/**
 * mig-307-npc-adapter.self-test — NpcCreature host ports + dual-path seam (#806).
 * Location: scripts/mig-307-npc-adapter.self-test.mjs
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
const npcUrl = pathToFileURL(join(root, 'server/src/modules/npc-creature/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;
const joinCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;
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
const {
  createNpcCreaturePorts,
  NPC_CREATURE_PORTS_PUBLIC_ACTIVATION_AUTHORIZED,
  NPCS_PUBLIC_ACTIVATION_AUTHORIZED,
  BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED,
} = await import(npcUrl);
const { createHost } = await import(hostUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinCmd);
const { create_play_session } = await import(playCmd);

/** Load real Vite extensionless adapter into Node via rewritten temp copies. */
const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig307-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of [
  'host-npc-creature-ports.contract.ts',
  'host-npc-creature-adapter.ts',
]) {
  const src = readFileSync(join(root, 'src/infrastructure/npc-creature', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostNpcCreatureAdapter }, { HOST_NPC_CREATURE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-npc-creature-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-npc-creature-ports.contract.ts')).href),
]);
assert(typeof createHostNpcCreatureAdapter === 'function', 'createHostNpcCreatureAdapter loaded');
assert(
  Array.isArray(HOST_NPC_CREATURE_OPS) && HOST_NPC_CREATURE_OPS.length === 12,
  'HOST_NPC_CREATURE_OPS count',
);

const work = mkdtempSync(join(tmpdir(), 'mig307-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

const minimalDraft = {
  name: 'Waldwolf',
  description: 'Ein schlanker Waldwolf.',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'full',
  level: 2,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['wald'],
};

try {
  assert(NPC_CREATURE_PORTS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no NPC ports HTTP mount');
  assert(NPCS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no npcs quarantine HTTP');
  assert(BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no bestiary HTTP');
  assert(TABLE_OWNERSHIP.npc_creature_definitions === 'npc-creature', 'definitions ownership');
  assert(TABLE_OWNERSHIP.npc_creature_instances === 'npc-creature', 'instances ownership');
  assert(
    TABLE_OWNERSHIP.npc_creature_controller_assignments === 'npc-creature',
    'controller ownership',
  );

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 24, `schema>=24 got ${boot.schemaVersion}`);

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
  assert(npc.moduleId === 'npc-creature', 'module id');

  const owner = actor('owner-o');
  const stranger = actor('stranger-x');
  const player = actor('player-a');

  // --- Fall 1: definition create / read / update / archive / restore / duplicate ---
  const created = npc.createDefinition(owner, { scope: 'personal', draft: minimalDraft });
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  assert(/^NPCC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(created.value.publicId), 'NPCC id');
  assert(created.value.scope === 'personal', 'personal scope');
  assert(created.value.ownerUserId === owner.actorId, 'owner from actor');
  assert(created.value.status === 'active', 'active');
  assert(created.value.payload.name === 'Waldwolf', 'name');
  const publicId = created.value.publicId;
  const definitionId = created.value.id;

  const updated = npc.updateDefinition(owner, definitionId, {
    ...minimalDraft,
    name: 'Waldwolf Alpha',
    level: 3,
  });
  assert(updated.ok, `update: ${updated.ok ? '' : updated.error}`);
  assert(updated.value.publicId === publicId, 'public id immutable on update');
  assert(updated.value.payload.name === 'Waldwolf Alpha', 'updated name');
  assert(updated.value.payload.level === 3, 'updated level');

  const got = npc.getDefinition(owner, definitionId);
  assert(got.ok && got.value?.publicId === publicId, 'get after update');

  const listed = npc.listDefinitions(owner);
  assert(listed.ok && listed.value.some((r) => r.id === definitionId), 'list includes');

  const archived = npc.archiveDefinition(owner, definitionId);
  assert(archived.ok && archived.value.status === 'archived', 'archived');
  const listedActive = npc.listDefinitions(owner);
  assert(
    listedActive.ok && listedActive.value.every((r) => r.id !== definitionId),
    'archived hidden by default',
  );
  const listedAll = npc.listDefinitions(owner, { includeArchived: true });
  assert(
    listedAll.ok && listedAll.value.some((r) => r.id === definitionId),
    'includeArchived shows archived',
  );

  const restored = npc.restoreDefinition(owner, definitionId);
  assert(restored.ok && restored.value.status === 'active', 'restored');

  const dup = npc.duplicateDefinition(owner, definitionId);
  assert(dup.ok, `duplicate: ${dup.ok ? '' : dup.error}`);
  assert(dup.value.id !== definitionId, 'new id on duplicate');
  assert(dup.value.publicId !== publicId, 'new public id on duplicate');
  assert(/\(Kopie\)/.test(String(dup.value.payload.name)), 'copy name');

  // Foreign DENY
  const foreignList = npc.listDefinitions(stranger);
  assert(foreignList.ok && foreignList.value.length === 0, 'foreign list empty');
  const foreignGet = npc.getDefinition(stranger, definitionId);
  assert(foreignGet.ok === false && foreignGet.error === 'not-authorized', 'foreign get DENY');
  const foreignUpdate = npc.updateDefinition(stranger, definitionId, minimalDraft);
  assert(foreignUpdate.ok === false && foreignUpdate.error === 'not-authorized', 'foreign update DENY');
  const foreignArchive = npc.archiveDefinition(stranger, definitionId);
  assert(
    foreignArchive.ok === false && foreignArchive.error === 'not-authorized',
    'foreign archive DENY',
  );
  const foreignDup = npc.duplicateDefinition(stranger, definitionId);
  assert(foreignDup.ok === false && foreignDup.error === 'not-authorized', 'foreign dup DENY');

  const missingActor = npc.createDefinition(null, { scope: 'personal', draft: minimalDraft });
  assert(missingActor.ok === false && missingActor.error === 'missing-actor', 'missing actor DENY');

  const identitySmuggle = npc.createDefinition(owner, {
    scope: 'personal',
    draft: { ...minimalDraft, id: 'personal:evil', scope: 'world' },
  });
  assert(identitySmuggle.ok === false && identitySmuggle.error === 'identity-in-draft', 'identity reject');

  const noName = npc.createDefinition(owner, {
    scope: 'personal',
    draft: { ...minimalDraft, name: '' },
  });
  assert(noName.ok === false && noName.error === 'missing-name', 'missing name reject');

  // --- Fall 2: spawn / update / remove + assign / clear temp ---
  const create = create_project_from_saga_version({ saga, project, world });
  const joinByCode = join_project_by_code({ project, character });
  const createPlay = create_play_session(session);

  const GM = { kind: 'solo-local', actorId: owner.actorId };
  const Player = { kind: 'solo-local', actorId: player.actorId };
  const Stranger = { kind: 'solo-local', actorId: stranger.actorId };

  const native = saga.seedNativeForTests({
    slug: 'mig307.whisper',
    title: 'MIG307',
    synopsis: 'Adapter',
    payload: {
      title: 'MIG307',
      blurb: '',
      synopsis: 'Adapter',
      knowledgeFacts: [],
      locations: [],
      pregens: [],
      packageId: null,
      initialAdventure: {},
    },
  });
  const createdProject = create(GM, native.sagaId, native.versionId, 'Gruppe');
  assert(createdProject.ok, `project: ${createdProject.ok ? '' : createdProject.error}`);
  const projectId = createdProject.value.id;
  project.setProjectCodeForTests(projectId, 'MIG307J1');
  assert(joinByCode(Player, 'MIG307J1', null).ok, 'join');

  const play = createPlay(GM, projectId, 'S1');
  assert(play.ok, 'play session');
  const sessionId = play.value.sessionId;

  const spawned = npc.spawnInstance(GM, {
    projectId,
    definitionId,
    instanceKind: 'generic',
    snapshot: { name: 'Waldwolf Alpha', maxHealth: 12 },
    runtime: { currentHp: 12, temporaryControllerUserId: player.actorId },
    displayName: 'Waldwolf Alpha',
    sequenceNumber: 1,
    sessionId,
  });
  assert(spawned.ok, `spawn: ${spawned.ok ? '' : spawned.error}`);
  const instanceId = spawned.value.id;
  assert(spawned.value.snapshot.maxHealth === 12, 'snapshot preserved');

  assert(!npc.updateRuntime(Player, instanceId, { currentHp: 5 }).ok, 'player cannot update runtime');
  const runtimeUpdated = npc.updateRuntime(GM, instanceId, {
    currentHp: 5,
    temporaryControllerUserId: player.actorId,
  });
  assert(runtimeUpdated.ok, `runtime: ${runtimeUpdated.ok ? '' : runtimeUpdated.error}`);
  assert(runtimeUpdated.value.runtime.currentHp === 5, 'runtime updated');
  assert(
    JSON.stringify(runtimeUpdated.value.snapshot) === JSON.stringify(spawned.value.snapshot),
    'snapshot unchanged',
  );

  const assigned = npc.assignController(GM, projectId, definitionId, player.actorId);
  assert(assigned.ok, `assign: ${assigned.ok ? '' : assigned.error}`);
  assert(assigned.value.controllerUserId === player.actorId, 'controller set');

  const revoked = npc.assignController(GM, projectId, definitionId, null);
  assert(revoked.ok && revoked.value.controllerUserId === null, 'controller revoked');

  assert(!npc.assignController(Player, projectId, definitionId, player.actorId).ok, 'player assign DENY');
  assert(!npc.assignController(Stranger, projectId, definitionId, null).ok, 'stranger assign DENY');

  const cleared = npc.clearTempControllersForSession(GM, sessionId);
  assert(cleared.ok && cleared.value.cleared >= 1, 'cleared temp controllers');
  const row = db
    .prepare(`SELECT runtime FROM npc_creature_instances WHERE id = ?`)
    .get(instanceId);
  const runtime = JSON.parse(row.runtime);
  assert(runtime.temporaryControllerUserId === null, 'temp controller cleared to null');
  assert(runtime.currentHp === 5, 'clear preserves other runtime fields');

  assert(!npc.removeInstance(Player, instanceId).ok, 'player remove DENY');
  assert(npc.removeInstance(GM, instanceId).ok, 'gm remove');
  const gone = db.prepare(`SELECT 1 AS o FROM npc_creature_instances WHERE id = ?`).get(instanceId);
  assert(!gone, 'instance removed');

  // Dual-path adapter seam
  const bound = createHostNpcCreatureAdapter({
    listDefinitions: async (actorId, options) => npc.listDefinitions(actor(actorId), options),
    getDefinition: async (actorId, id) => npc.getDefinition(actor(actorId), id),
    createDefinition: async (actorId, input) => npc.createDefinition(actor(actorId), input),
    updateDefinition: async (actorId, id, draft) =>
      npc.updateDefinition(actor(actorId), id, draft),
    archiveDefinition: async (actorId, id) => npc.archiveDefinition(actor(actorId), id),
    restoreDefinition: async (actorId, id) => npc.restoreDefinition(actor(actorId), id),
    duplicateDefinition: async (actorId, id) => npc.duplicateDefinition(actor(actorId), id),
    assignController: async (actorId, pid, did, cid) =>
      npc.assignController(actor(actorId), pid, did, cid),
    spawnInstance: async (actorId, input) => npc.spawnInstance(actor(actorId), input),
    updateRuntime: async (actorId, id, runtime) =>
      npc.updateRuntime(actor(actorId), id, runtime),
    removeInstance: async (actorId, id) => npc.removeInstance(actor(actorId), id),
    clearTempControllersForSession: async (actorId, sid) =>
      npc.clearTempControllersForSession(actor(actorId), sid),
  });
  assert(bound.transport === 'host', 'adapter transport');
  const viaAdapter = await bound.createDefinition(owner.actorId, {
    scope: 'personal',
    draft: { ...minimalDraft, name: 'Adapter Fuchs' },
  });
  assert(viaAdapter.ok && viaAdapter.value.publicId.startsWith('NPCC-'), 'adapter create');

  // create-host wires npcCreature ports
  const hostWork = mkdtempSync(join(tmpdir(), 'mig307-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18768',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.npcCreature?.moduleId === 'npc-creature', 'create-host exposes npcCreature ports');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  // Client dual-path wiring + Supabase default remains
  const serviceSrc = readFileSync(
    join(root, 'src/infrastructure/npc-creature/npc-creature-service.ts'),
    'utf8',
  );
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/npc-creature/host-npc-creature-adapter.ts'),
    'utf8',
  );
  assert(/supabaseNpcCreatureRepository/.test(serviceSrc), 'service default remains Supabase');
  assert(/Dual-path \(MIG-307\)/.test(serviceSrc), 'dual-path note on service');
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');
  // Strip comments so the dual-path prose cannot mask a real env redirect.
  const serviceCode = serviceSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/VITE_SAGATREE_HOST/i.test(serviceCode), 'flags do not redirect facade');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(
    !/mountNpc|npc-creature-definitions|npcCreatureHttp/i.test(createApp),
    'no NpcCreature HTTP mount yet',
  );

  console.log('PASS mig-307-npc-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
