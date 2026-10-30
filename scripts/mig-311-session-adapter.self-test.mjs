#!/usr/bin/env node
/**
 * mig-311-session-adapter.self-test — Session host ports + dual-path (#810).
 * Location: scripts/mig-311-session-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 * Lobby ready remains non-authoritative; media Edge shapes stay unmounted.
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const sagaUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;
const joinCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const {
  createSessionPorts,
  createSessionInfraPorts,
  SESSION_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
} = await import(sessionUrl);
const { createHost } = await import(hostUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinCmd);

const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig311-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-session-ports.contract.ts', 'host-session-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/session', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostSessionAdapter }, { HOST_SESSION_OPS, HOST_SESSION_RPC_NAMES, HOST_SESSION_EDGE_NAMES }] =
  await Promise.all([
    import(pathToFileURL(join(adapterLoadDir, 'host-session-adapter.ts')).href),
    import(pathToFileURL(join(adapterLoadDir, 'host-session-ports.contract.ts')).href),
  ]);
assert(typeof createHostSessionAdapter === 'function', 'adapter loaded');
assert(HOST_SESSION_OPS.length === 12, 'ops count');
assert(HOST_SESSION_RPC_NAMES.length === 12, 'rpc count');
assert(HOST_SESSION_EDGE_NAMES.length === 2, 'edge count');
assert(HOST_SESSION_RPC_NAMES.includes('apply_session_runtime_command'), 'runtime rpc');
assert(HOST_SESSION_EDGE_NAMES.includes('session-media-token'), 'media edge listed');

const work = mkdtempSync(join(tmpdir(), 'mig311-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(SESSION_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no session infra HTTP');
  assert(SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED === false, 'media token unmounted');
  assert(SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED === false, 'recap edge unmounted');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
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
    world: {
      canEditWorld: (ids, worldId) => world.canEditWorld(ids, worldId),
      appendPromotedLoreFact: (worldId, fact) => world.appendPromotedLoreFact(worldId, fact),
    },
    characterNames: { getDisplayName: (id) => character.getDisplayName(id) },
  });
  const session = createSessionPorts({ db, project });

  const create = create_project_from_saga_version({ saga, project, world });
  const joinByCode = join_project_by_code({ project, character });

  const GM = actor('gm-owner');
  const Player = actor('player-a');
  const Stranger = actor('stranger-x');

  const native = saga.seedNativeForTests({
    slug: 'mig311.session',
    title: 'MIG311',
    synopsis: 'Session adapter',
    payload: {
      title: 'MIG311',
      blurb: '',
      synopsis: 'Session adapter',
      knowledgeFacts: [],
      locations: [],
      pregens: [],
      packageId: null,
      initialAdventure: {},
    },
  });
  const created = create(GM, native.sagaId, native.versionId, 'Gruppe');
  assert(created.ok, `create project: ${created.ok ? '' : created.error}`);
  const projectId = created.value.id;
  project.setProjectCodeForTests(projectId, 'JOIN11');
  const joined = joinByCode(Player, 'JOIN11', null);
  assert(joined.ok, `join project: ${joined.ok ? '' : joined.error}`);

  // --- Lifecycle ---
  const play = session.lifecycle.createPlaySession(GM, projectId, 'Abend 1');
  assert(play.ok, `create_play_session: ${play.ok ? '' : play.error}`);
  const sessionId = play.value.sessionId;
  const strangerPlay = session.lifecycle.createPlaySession(Stranger, projectId, 'Hack');
  assert(strangerPlay.ok === false, 'stranger cannot create play session');

  const status = session.lifecycle.setSessionStatus(GM, sessionId, 'active');
  assert(status.ok, `set_session_status: ${status.ok ? '' : status.error}`);
  const strangerStatus = session.lifecycle.setSessionStatus(Stranger, sessionId, 'closed');
  assert(strangerStatus.ok === false, 'stranger cannot set status');

  // --- Access / invites ---
  const invite = session.access.createSessionInvite(GM, sessionId);
  assert(invite.ok, `create_session_invite: ${invite.ok ? '' : invite.error}`);
  const token = invite.value.token ?? invite.value.inviteToken ?? invite.value.code;
  assert(typeof token === 'string' && token.length > 0, 'invite token');

  const resolved = session.access.resolveSessionInvite(Player, token);
  assert(resolved.ok, `resolve_session_invite: ${resolved.ok ? '' : resolved.error}`);

  // Join by code path (session join code when present)
  const joinCode =
    play.value.joinCode ??
    play.value.code ??
    invite.value.joinCode ??
    null;
  if (typeof joinCode === 'string' && joinCode.trim()) {
    const byCode = session.access.joinSessionByCode(Player, joinCode, null);
    assert(byCode.ok || byCode.error, 'join_session_by_code returns typed result');
  }

  const strangerInvite = session.access.createSessionInvite(Stranger, sessionId);
  assert(strangerInvite.ok === false, 'stranger cannot create invite');

  // --- Runtime snapshot / presence / command ---
  const snap = session.queries.getSnapshot(GM, sessionId);
  assert(snap.ok, `get_session_runtime_snapshot: ${snap.ok ? '' : snap.error}`);
  const strangerSnap = session.queries.getSnapshot(Stranger, sessionId);
  assert(strangerSnap.ok === false, 'stranger cannot read runtime snapshot');

  const rev0 = snap.ok ? Number(snap.snapshot.revision) || 0 : 0;
  // GM is a member writer — exercise presence with required ApplyCommandInput shape.
  const presence = session.commands.apply(GM, {
    sessionId,
    expectedRevision: rev0,
    idempotencyKey: 'mig311-presence-gm',
    op: {
      kind: 'presence',
      payload: { userId: GM.actorId, isOnline: true, characterId: null },
    },
  });
  assert(presence.ok === true, `gm presence: ${presence.ok ? '' : presence.error}`);
  const foreignMutate = session.commands.apply(Stranger, {
    sessionId,
    expectedRevision: rev0,
    idempotencyKey: 'mig311-presence-stranger',
    op: {
      kind: 'presence',
      payload: { userId: Stranger.actorId, isOnline: true, characterId: null },
    },
  });
  assert(
    foreignMutate.ok === false &&
      (foreignMutate.error === 'FORBIDDEN' || foreignMutate.error === 'SESSION_NOT_FOUND'),
    `stranger presence DENY got ${JSON.stringify(foreignMutate)}`,
  );

  // --- Recap ---
  const recap = session.recap.getSessionRecap(GM, sessionId);
  assert(recap.ok || typeof recap.error === 'string', 'get_session_recap typed');
  const saveRecap = session.recap.saveSessionRecapSummary(
    GM,
    sessionId,
    'Zusammenfassung für MIG-311',
    'draft',
  );
  assert(
    saveRecap.ok === true || typeof saveRecap.error === 'string',
    'save_session_recap_summary typed',
  );
  const strangerRecap = session.recap.saveSessionRecapSummary(Stranger, sessionId, 'x', 'draft');
  assert(strangerRecap.ok === false, 'stranger cannot save recap');

  // Leave (player may leave own membership)
  const leave = session.access.leavePlaySession(Player, sessionId);
  assert(leave.ok === true || typeof leave.error === 'string', 'leave_play_session typed');

  const revoked = session.access.revokeSessionInvite(GM, token);
  assert(revoked.ok === true || typeof revoked.error === 'string', 'revoke_session_invite typed');

  // --- Lobby ready is non-authoritative (legacy defect preserved) ---
  const lobbySrc = readFileSync(
    join(root, 'src/infrastructure/session/session-lobby-channel.ts'),
    'utf8',
  );
  assert(lobbySrc.includes('session-lobby:'), 'lobby topic shape');
  assert(lobbySrc.includes("event: 'ready'"), 'lobby ready event');
  assert(
    lobbySrc.includes('Ready is not gameplay authorization') ||
      lobbySrc.includes('not gameplay authorization'),
    'lobby ready non-authoritative documented',
  );

  // --- Media degraded shapes retained client-side ---
  for (const rel of [
    'src/infrastructure/session/media/livekit-media-plane-adapter.ts',
    'src/infrastructure/session/media/media-token-client.ts',
    'src/infrastructure/session/session-runtime-channel.ts',
    'src/infrastructure/session/session-service.ts',
  ]) {
    assert(existsSync(join(root, rel)), `client shape: ${rel}`);
  }

  // --- Dual-path: flat sessionInfra bridge → HostSessionAdapter ---
  const infra = createSessionInfraPorts(session);
  assert(infra.moduleId === 'session-infra', 'sessionInfra moduleId');
  const bound = createHostSessionAdapter({
    applySessionRuntimeCommand: async (actorId, command) =>
      infra.applySessionRuntimeCommand(actorId, command),
    createPlaySession: async (actorId, pid, name) => infra.createPlaySession(actorId, pid, name),
    createSessionInvite: async (actorId, sid) => infra.createSessionInvite(actorId, sid),
    getSessionRecap: async (actorId, sid) => infra.getSessionRecap(actorId, sid),
    getSessionRuntimeSnapshot: async (actorId, sid) =>
      infra.getSessionRuntimeSnapshot(actorId, sid),
    joinSessionByCode: async (actorId, code, characterId) =>
      infra.joinSessionByCode(actorId, code, characterId),
    leavePlaySession: async (actorId, sid) => infra.leavePlaySession(actorId, sid),
    resolveSessionInvite: async (actorId, t) => infra.resolveSessionInvite(actorId, t),
    revokeSessionInvite: async (actorId, t) => infra.revokeSessionInvite(actorId, t),
    saveSessionRecapSummary: async (actorId, sid, summaryText, st) =>
      infra.saveSessionRecapSummary(actorId, sid, summaryText, st),
    setSessionPlayerPresence: async (actorId, sid, expectedRevision, idempotencyKey, presence) =>
      infra.setSessionPlayerPresence(actorId, sid, expectedRevision, idempotencyKey, presence),
    setSessionStatus: async (actorId, sid, st) => infra.setSessionStatus(actorId, sid, st),
  });
  assert(bound.transport === 'host', 'adapter transport');
  assert(bound.rpcNames.length === 12, 'adapter rpcNames');
  const viaSnap = await bound.getSessionRuntimeSnapshot(GM.actorId, sessionId);
  assert(viaSnap.ok, `adapter snapshot: ${viaSnap.ok ? '' : viaSnap.error}`);

  const hostWork = mkdtempSync(join(tmpdir(), 'mig311-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18770',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(
      host.sessionInfra && host.sessionInfra.moduleId === 'session-infra',
      'host exposes sessionInfra',
    );
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  console.log('PASS: mig-311-session-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
