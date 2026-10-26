#!/usr/bin/env node
/**
 * rpc-session-access.self-test — join/leave/invite RPCs (#869).
 * Location: scripts/rpc-session-access.self-test.mjs
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
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_from_saga_version.ts'),
).href;
const joinProjCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;
const playCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_play_session.ts'),
).href;
const joinSessCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_session_by_code.ts'),
).href;
const leaveCmd = pathToFileURL(
  join(root, 'server/src/application/commands/leave_play_session.ts'),
).href;
const inviteCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_session_invite.ts'),
).href;
const resolveCmd = pathToFileURL(
  join(root, 'server/src/application/commands/resolve_session_invite.ts'),
).href;
const revokeCmd = pathToFileURL(
  join(root, 'server/src/application/commands/revoke_session_invite.ts'),
).href;
const presenceCmd = pathToFileURL(
  join(root, 'server/src/application/commands/set_session_player_presence.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSessionPorts, appendSessionEventIsExported } = await import(sessionUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinProjCmd);
const { create_play_session } = await import(playCmd);
const { join_session_by_code } = await import(joinSessCmd);
const { leave_play_session } = await import(leaveCmd);
const { create_session_invite } = await import(inviteCmd);
const { resolve_session_invite } = await import(resolveCmd);
const { revoke_session_invite } = await import(revokeCmd);
const { set_session_player_presence } = await import(presenceCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-sess-access-'));
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

  const create = create_project_from_saga_version({ saga, project, world });
  const joinProj = join_project_by_code({ project, character });
  const createPlay = create_play_session(session);
  const joinSess = join_session_by_code(session);
  const leave = leave_play_session(session);
  const createInvite = create_session_invite(session);
  const resolveInvite = resolve_session_invite(session);
  const revokeInvite = revoke_session_invite(session);
  const setPresence = set_session_player_presence(session);

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
  // Ensure saga public id for resolve
  const pub = db.prepare(`SELECT public_id AS p FROM projects WHERE id = ?`).get(projectId);
  if (!pub?.p) {
    db.prepare(`UPDATE projects SET public_id = ? WHERE id = ?`).run('SA-TEST1', projectId);
  }
  project.setProjectCodeForTests(projectId, 'ACCESS01');
  assert(joinProj(Player, 'ACCESS01', null).ok, 'join project');

  assert(boot.schemaVersion >= 17, `schema>=17 got ${boot.schemaVersion}`);
  const now = new Date().toISOString();
  const hero = character.seedPcForTests({
    ownerUserId: Player.actorId,
    name: 'Hero',
    sheetStatus: 'complete',
    id: 'char-complete',
  });
  character.seedPcForTests({
    ownerUserId: Player.actorId,
    name: 'Draft',
    sheetStatus: 'incomplete',
    id: 'char-draft',
  });
  character.seedPcForTests({
    ownerUserId: Stranger.actorId,
    name: 'Stolen',
    sheetStatus: 'complete',
    id: 'char-other',
  });
  const heroPub = db
    .prepare(`SELECT public_id AS p FROM characters WHERE id = ?`)
    .get('char-complete');
  assert(heroPub?.p && String(heroPub.p).startsWith('CH-'), `auto public_id got ${heroPub?.p}`);
  void hero;

  const play = createPlay(GM, projectId, 'Abend');
  assert(play.ok, `play: ${play.ok ? '' : play.error}`);
  const sessionId = play.value.sessionId;
  const joinCode = play.value.joinCode;
  assert(joinCode && joinCode.length === 6, 'join code');

  // --- Fall 1: join normalizes code, owns complete PC, membership+roster+revision+event ---
  assert(!joinSess(Player, '  ' + joinCode.toLowerCase() + '  ', 'char-draft').ok, 'incomplete denied');
  assert(!joinSess(Player, joinCode, 'char-other').ok, 'foreign character denied');
  const joined = joinSess(Player, '  ' + joinCode.toLowerCase() + '  ', 'char-complete');
  assert(joined.ok, `join: ${joined.ok ? '' : joined.error}`);
  assert(joined.value.runtimeRevision === 1, `rev=${joined.value.runtimeRevision}`);
  const rtRev = db
    .prepare(`SELECT revision AS r FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  assert(rtRev?.r === 1, `session_runtime.revision synced got ${rtRev?.r}`);
  const stateRow = db
    .prepare(`SELECT state_json AS s FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  const state = JSON.parse(stateRow.s);
  assert(Array.isArray(state.roster), 'roster is array');
  assert(state.roster.some((e) => e.userId === Player.actorId), 'roster includes player');
  const roster = db
    .prepare(`SELECT character_id AS c FROM session_players WHERE session_id = ? AND user_id = ?`)
    .get(sessionId, Player.actorId);
  assert(roster?.c === 'char-complete', 'roster character');
  const events = db
    .prepare(`SELECT COUNT(*) AS n FROM session_events WHERE session_id = ?`)
    .get(sessionId);
  assert(events.n >= 1, 'join event');

  // --- Fall 2: foreign leave no-op (revision/events unchanged) ---
  const revBefore = joined.value.runtimeRevision;
  const evBefore = events.n;
  const foreignLeave = leave(Stranger, sessionId);
  assert(foreignLeave.ok && foreignLeave.value.left === false, 'foreign leave no-op');
  const afterForeign = db
    .prepare(`SELECT runtime_revision AS r FROM play_sessions WHERE session_id = ?`)
    .get(sessionId);
  assert(afterForeign.r === revBefore, 'foreign leave no revision bump');
  const evAfterForeign = db
    .prepare(`SELECT COUNT(*) AS n FROM session_events WHERE session_id = ?`)
    .get(sessionId);
  assert(evAfterForeign.n === evBefore, 'foreign leave no event');

  const realLeave = leave(Player, sessionId);
  assert(realLeave.ok && realLeave.value.left === true, 'participant leave');
  assert(realLeave.value.runtimeRevision === revBefore + 1, 'leave bumps revision');

  // Re-join for invite tests
  assert(joinSess(Player, joinCode, 'char-complete').ok, 'rejoin');

  // Presence must persist to session_players (roster rebuild source).
  const revForPresence = db
    .prepare(`SELECT revision AS r FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  const offline = setPresence(Player, {
    sessionId,
    expectedRevision: revForPresence.r,
    idempotencyKey: `pres-off-${revForPresence.r}`,
    presence: { userId: Player.actorId, characterId: 'char-complete', isOnline: false },
  });
  assert(offline.ok && offline.value.committed, `offline presence: ${offline.ok ? '' : offline.error}`);
  const onlineRow = db
    .prepare(`SELECT is_online AS o FROM session_players WHERE session_id = ? AND user_id = ?`)
    .get(sessionId, Player.actorId);
  assert(onlineRow?.o === 0, `session_players.is_online synced got ${onlineRow?.o}`);

  // --- Fall 3: invite create/revoke GM-only; rotate prior tokens ---
  assert(!createInvite(Player, sessionId).ok, 'player cannot create invite');
  const inv1 = createInvite(GM, sessionId);
  assert(inv1.ok, `invite1: ${inv1.ok ? '' : inv1.error}`);
  const inv2 = createInvite(GM, sessionId);
  assert(inv2.ok, 'invite2 rotate');
  const prior = db
    .prepare(`SELECT revoked_at AS r FROM session_invites WHERE token = ?`)
    .get(inv1.value.token);
  assert(prior?.r, 'prior invite revoked on rotate');
  assert(!revokeInvite(Player, inv2.value.token).ok, 'player cannot revoke');
  assert(revokeInvite(GM, inv2.value.token).ok, 'gm revoke');

  // --- Fall 4: resolve errors; resolve does not join ---
  const missing = resolveInvite(Player, '');
  assert(missing.ok === false && missing.error_code === 'missing_token', 'missing_token');
  const notFound = resolveInvite(Player, 'no-such-token');
  assert(notFound.ok === false && notFound.error_code === 'not_found', 'not_found');
  const fresh = createInvite(GM, sessionId);
  assert(fresh.ok, 'fresh invite');
  const revokedRes = resolveInvite(Player, inv2.value.token);
  assert(revokedRes.ok === false && revokedRes.error_code === 'revoked', 'revoked');
  const okResolve = resolveInvite(Stranger, fresh.value.token);
  assert(okResolve.ok === true, `resolve: ${JSON.stringify(okResolve)}`);
  assert(okResolve.saga_public_id, 'saga_public_id');
  assert(okResolve.already_member === false, 'stranger not member');
  const strangerRoster = db
    .prepare(`SELECT 1 AS o FROM session_players WHERE session_id = ? AND user_id = ?`)
    .get(sessionId, Stranger.actorId);
  assert(!strangerRoster, 'resolve does not join');

  // Member with bound character gets character_public_id
  const memberResolve = resolveInvite(Player, fresh.value.token);
  assert(memberResolve.ok === true, 'member resolve');
  assert(memberResolve.already_member === true, 'already member');
  assert(
    memberResolve.character_public_id === String(heroPub.p).toUpperCase(),
    `char pub=${memberResolve.character_public_id}`,
  );

  // Co-GM via project_members.role=gm (not gm_user_id) may create invites
  const CoGm = { kind: 'solo-local', actorId: 'co-gm-user' };
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at, id, character_id)
     VALUES (?, ?, 'gm', 1, ?, ?, NULL)`,
  ).run(projectId, CoGm.actorId, now, 'mem-cogm');
  const coInvite = createInvite(CoGm, sessionId);
  assert(coInvite.ok, `co-gm invite: ${coInvite.ok ? '' : coInvite.error}`);

  // Legacy: append_session_event not exported
  assert(appendSessionEventIsExported() === false, 'event helper not exported');

  console.log('rpc-session-access.self-test: PASS');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
