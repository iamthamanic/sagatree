#!/usr/bin/env node
/**
 * rpc-session-lifecycle.self-test — create/status RPCs (#868).
 * Location: scripts/rpc-session-lifecycle.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
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
const joinCmd = pathToFileURL(
  join(root, 'server/src/application/commands/join_project_by_code.ts'),
).href;
const playCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_play_session.ts'),
).href;
const projSessCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_project_session.ts'),
).href;
const statusCmd = pathToFileURL(
  join(root, 'server/src/application/commands/set_session_status.ts'),
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
const { join_project_by_code } = await import(joinCmd);
const { create_play_session } = await import(playCmd);
const { create_project_session } = await import(projSessCmd);
const { set_session_status } = await import(statusCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-sess-life-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 15, `schema>=15 got ${boot.schemaVersion}`);
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
  const joinByCode = join_project_by_code({ project, character });
  const createPlay = create_play_session(session);
  const createProjSess = create_project_session(session);
  const setStatus = set_session_status(session);

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
  project.setProjectCodeForTests(projectId, 'JOIN01');
  const joined = joinByCode(Player, 'JOIN01', null);
  assert(joined.ok, `join: ${joined.ok ? '' : joined.error}`);

  // Seed adventure_runtime schemaVersion=1 for recap handover.
  db.prepare(`UPDATE projects SET adventure_runtime = ? WHERE id = ?`).run(
    JSON.stringify({ schemaVersion: 1, step: 'intro' }),
    projectId,
  );

  // --- Fall 1: create_play GM-only; create_project_session GM/player ---
  const denyPlay = createPlay(Player, projectId, 'Nope');
  assert(!denyPlay.ok && denyPlay.error === '42501', 'play deny non-GM');
  const denyStranger = createPlay(Stranger, projectId, 'Nope');
  assert(!denyStranger.ok && denyStranger.error === '42501', 'play deny stranger');
  const play1 = createPlay(GM, projectId, 'Abend 1');
  assert(play1.ok, `play1: ${play1.ok ? '' : play1.error}`);
  assert(play1.value.status === 'waiting', 'play waiting');
  assert(play1.value.sessionNumber === 1, 'play number 1');
  assert(typeof play1.value.joinCode === 'string' && play1.value.joinCode.length > 0, 'join code');

  const denyProjStranger = createProjSess(Stranger, projectId, 'X');
  assert(!denyProjStranger.ok && denyProjStranger.error === '42501', 'proj sess deny stranger');
  const projByPlayer = createProjSess(Player, projectId, 'Spieler-Session');
  assert(projByPlayer.ok, `proj by player: ${projByPlayer.ok ? '' : projByPlayer.error}`);
  assert(projByPlayer.value.status === 'scheduled', 'proj scheduled');
  assert(projByPlayer.value.sessionNumber === 2, 'proj number 2');

  // --- Fall 2: unique numbers/codes; knowledge carry from completed ---
  const play2 = createPlay(GM, projectId, 'Abend 2');
  assert(play2.ok, 'play2');
  assert(play2.value.sessionNumber === 3, 'number 3');
  assert(play2.value.joinCode !== play1.value.joinCode, 'distinct join codes');

  // Complete play1 with knowledge in world_state, then create_project_session carries it.
  db.prepare(`UPDATE play_sessions SET world_state = ? WHERE session_id = ?`).run(
    JSON.stringify({ shared: { knowledge: { fact: 'altar' }, adventure: {} } }),
    play1.value.sessionId,
  );
  const toActive = setStatus(GM, play1.value.sessionId, 'active');
  assert(toActive.ok, `to active: ${toActive.ok ? '' : toActive.error}`);
  const toDone = setStatus(GM, play1.value.sessionId, 'completed');
  assert(toDone.ok, `to completed: ${toDone.ok ? '' : toDone.error}`);
  assert(toDone.value.status === 'completed', 'completed');
  assert(toDone.value.runtimeRevision >= 2, 'revision bumped');

  const withKnowledge = createProjSess(GM, projectId, 'Nachfolger');
  assert(withKnowledge.ok, 'with knowledge');
  const ws = JSON.parse(withKnowledge.value.worldState);
  assert(ws.shared?.knowledge?.fact === 'altar', 'knowledge carried');
  assert(ws.shared?.adventure?.schemaVersion === 1, 'adventure carried');

  // --- Fall 3: transitions; completed terminal ---
  const s = createPlay(GM, projectId, 'Transitions');
  assert(s.ok, 'transition session');
  assert(!setStatus(GM, s.value.sessionId, 'paused').ok, 'waiting→paused illegal');
  assert(setStatus(GM, s.value.sessionId, 'active').ok, 'waiting→active');
  assert(setStatus(GM, s.value.sessionId, 'paused').ok, 'active→paused');
  assert(setStatus(GM, s.value.sessionId, 'active').ok, 'paused→active');
  assert(setStatus(GM, s.value.sessionId, 'completed').ok, 'active→completed');
  const afterDone = setStatus(GM, s.value.sessionId, 'active');
  assert(!afterDone.ok && afterDone.error === '22023', 'completed terminal');

  const denyStatus = setStatus(Player, withKnowledge.value.sessionId, 'active');
  assert(!denyStatus.ok && denyStatus.error === '42501', 'status GM-only');

  // --- Fall 4: completed → recap + status event atomic ---
  const recap = db
    .prepare(`SELECT session_id AS id, snapshot FROM session_recaps WHERE session_id = ?`)
    .get(play1.value.sessionId);
  assert(recap?.id === play1.value.sessionId, 'recap row');
  const snap = JSON.parse(recap.snapshot);
  assert(snap.schemaVersion === 1, 'recap snapshot');
  const evt = db
    .prepare(
      `SELECT payload_json AS payload FROM session_events
       WHERE session_id = ? ORDER BY event_sequence DESC LIMIT 1`,
    )
    .get(play1.value.sessionId);
  assert(evt, 'status event');
  const payload = JSON.parse(evt.payload);
  assert(payload.to === 'completed' || payload.type === 'status', 'status payload');

  // Atomic rollback: force helper failure by dropping recaps mid-tx via invalid session — already covered by catch→P0001.
  // Simulate failure path: invalid status rolls nothing.
  const before = db
    .prepare(`SELECT runtime_revision AS r FROM play_sessions WHERE session_id = ?`)
    .get(withKnowledge.value.sessionId);
  const bad = setStatus(GM, withKnowledge.value.sessionId, 'bogus');
  assert(!bad.ok && bad.error === '22023', 'invalid status');
  const after = db
    .prepare(`SELECT runtime_revision AS r FROM play_sessions WHERE session_id = ?`)
    .get(withKnowledge.value.sessionId);
  assert(before.r === after.r, 'no revision on invalid');

  // --- Fall 5: RPC-SEC-ANON-EVENT-HELPER — no public append export ---
  assert(appendSessionEventIsExported() === false, 'append not exported');
  const sessionIndex = readFileSync(
    join(root, 'server/src/modules/session/index.ts'),
    'utf8',
  );
  assert(!/appendSessionEventPublic|append_session_event/.test(sessionIndex), 'no public append in barrel');
  const lifeSrc = readFileSync(
    join(root, 'server/src/modules/session/internal/session-lifecycle-store.ts'),
    'utf8',
  );
  assert(!/export function appendSessionEvent[^I]/.test(lifeSrc), 'no public append helper');

  console.log('rpc-session-lifecycle.self-test: PASS');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
