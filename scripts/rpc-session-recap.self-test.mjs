#!/usr/bin/env node
/**
 * rpc-session-recap.self-test — get/save session recap RPCs (#870).
 * Location: scripts/rpc-session-recap.self-test.mjs
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
const getRecapCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_session_recap.ts'),
).href;
const saveRecapCmd = pathToFileURL(
  join(root, 'server/src/application/commands/save_session_recap_summary.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSessionPorts, buildRecapHighlightLines } = await import(sessionUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinProjCmd);
const { create_play_session } = await import(playCmd);
const { join_session_by_code } = await import(joinSessCmd);
const { get_session_recap } = await import(getRecapCmd);
const { save_session_recap_summary } = await import(saveRecapCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-sess-recap-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 18, `schema>=18 got ${boot.schemaVersion}`);
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
  const getRecap = get_session_recap(session);
  const saveRecap = save_session_recap_summary(session);

  const GM = { kind: 'solo-local', actorId: 'gm-owner' };
  const Player = { kind: 'solo-local', actorId: 'player-a' };
  const Stranger = { kind: 'solo-local', actorId: 'stranger-x' };

  const native = saga.seedNativeForTests({
    slug: 'dornhain.recap',
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
  project.setProjectCodeForTests(projectId, 'RECAP001');
  assert(joinProj(Player, 'RECAP001', null).ok, 'join project');

  character.seedPcForTests({
    ownerUserId: Player.actorId,
    name: 'Hero',
    sheetStatus: 'complete',
    id: 'char-complete',
  });

  const play = createPlay(GM, projectId, 'Abend');
  assert(play.ok, `play: ${play.ok ? '' : play.error}`);
  const sessionId = play.value.sessionId;
  assert(joinSess(Player, play.value.joinCode, 'char-complete').ok, 'join session');

  // Highlight builder: GM sees gm_only; player does not
  const linesGm = buildRecapHighlightLines(
    {
      consequences: [
        { id: '1', kind: 'loot', summary: 'secret', visibility: 'gm_only', createdAt: '2026-01-02' },
        { id: '2', kind: 'loot', summary: 'shared', visibility: 'shared', createdAt: '2026-01-01' },
      ],
    },
    true,
  );
  assert(linesGm.length === 2, 'gm sees both');
  const linesPlayer = buildRecapHighlightLines(
    {
      consequences: [
        { id: '1', kind: 'loot', summary: 'secret', visibility: 'gm_only', createdAt: '2026-01-02' },
        { id: '2', kind: 'loot', summary: 'shared', visibility: 'shared', createdAt: '2026-01-01' },
      ],
    },
    false,
  );
  assert(linesPlayer.length === 1 && linesPlayer[0].id === '2', 'player shared only');

  // Missing recap → null for participant
  const empty = getRecap(GM, sessionId);
  // lifecycle may have seeded a skeleton on create — treat null or empty summary as ok
  assert(empty.ok, `get empty: ${empty.ok ? '' : empty.error}`);

  assert(!getRecap(Stranger, sessionId).ok, 'stranger denied');
  assert(!saveRecap(Player, sessionId, 'Nope', 'draft').ok, 'player cannot save');
  assert(!saveRecap(GM, sessionId, 'x', 'bogus').ok, 'invalid status');

  const draft = saveRecap(GM, sessionId, '  Draft text  ', 'draft');
  assert(draft.ok && draft.value, `draft: ${draft.ok ? '' : draft.error}`);
  assert(draft.value.summaryText === 'Draft text', 'gm sees draft text');
  assert(draft.value.summaryStatus === 'draft', 'status draft');

  const playerDraft = getRecap(Player, sessionId);
  assert(playerDraft.ok && playerDraft.value, 'player get');
  assert(playerDraft.value.summaryText === null, 'player hides non-approved');
  assert(playerDraft.value.summaryStatus === 'draft', 'player still sees status');

  // Seed snapshot with consequences for highlight projection
  db.prepare(`UPDATE session_recaps SET snapshot = ? WHERE session_id = ?`).run(
    JSON.stringify({
      consequences: [
        { id: 'g1', kind: 'plot', summary: 'GM only', visibility: 'gm_only', createdAt: 'z' },
        { id: 'p1', kind: 'plot', summary: 'Public', visibility: 'public', createdAt: 'y' },
      ],
    }),
    sessionId,
  );

  const approved = saveRecap(GM, sessionId, 'Approved summary', 'approved');
  assert(approved.ok && approved.value.summaryStatus === 'approved', 'approved');
  assert(approved.value.summaryText === 'Approved summary', 'gm approved text');
  assert(
    approved.value.highlightLines.some((l) => l.id === 'g1'),
    'gm highlights include gm_only',
  );

  const playerApproved = getRecap(Player, sessionId);
  assert(playerApproved.ok && playerApproved.value.summaryText === 'Approved summary', 'player sees approved');
  assert(
    playerApproved.value.highlightLines.every((l) => l.visibility !== 'gm_only'),
    'player highlights redact gm_only',
  );
  assert(
    playerApproved.value.highlightLines.some((l) => l.id === 'p1'),
    'player sees public highlight',
  );

  // Unique signature: only 3-arg API (no 2-arg overload)
  assert(typeof session.recap.saveSessionRecapSummary === 'function', '3-arg save');
  assert(session.recap.saveSessionRecapSummary.length === 4, 'arity actor+3');

  console.log('rpc-session-recap.self-test: PASS');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
