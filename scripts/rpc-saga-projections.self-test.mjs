#!/usr/bin/env node
/**
 * rpc-saga-projections.self-test — overview / lore / promote RPCs (#876).
 * Location: scripts/rpc-saga-projections.self-test.mjs
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
const overviewCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_saga_overview.ts'),
).href;
const loreCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_saga_lore_timeline.ts'),
).href;
const promoteSagaCmd = pathToFileURL(
  join(root, 'server/src/application/commands/promote_session_outcome_to_saga.ts'),
).href;
const promoteWorldCmd = pathToFileURL(
  join(root, 'server/src/application/commands/promote_session_outcome_to_world.ts'),
).href;
const setBundleCmd = pathToFileURL(
  join(root, 'server/src/application/commands/set_saga_member_bundle.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { createSessionPorts } = await import(sessionUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { join_project_by_code } = await import(joinProjCmd);
const { create_play_session } = await import(playCmd);
const { get_saga_overview } = await import(overviewCmd);
const { get_saga_lore_timeline } = await import(loreCmd);
const { promote_session_outcome_to_saga } = await import(promoteSagaCmd);
const { promote_session_outcome_to_world } = await import(promoteWorldCmd);
const { set_saga_member_bundle } = await import(setBundleCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-saga-proj-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
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
    world: { canEditWorld: (ids, wid) => world.canEditWorld(ids, wid) },
  });
  const session = createSessionPorts({ db, project });

  const create = create_project_from_saga_version({ saga, project, world });
  const joinProj = join_project_by_code({ project, character });
  const createPlay = create_play_session(session);
  const getOverview = get_saga_overview(saga);
  const getLore = get_saga_lore_timeline(saga);
  const promoteSaga = promote_session_outcome_to_saga(saga);
  const promoteWorld = promote_session_outcome_to_world(saga);
  const setMemberBundle = set_saga_member_bundle({ permissions });

  const GM = { kind: 'solo-local', actorId: 'gm-owner' };
  const Player = { kind: 'solo-local', actorId: 'player-a' };
  const Stranger = { kind: 'solo-local', actorId: 'stranger-x' };

  // User-owned published saga (promote requires non-native + author)
  const userSaga = saga.seedPublishedDefinitionForTests({
    slug: 'user.projections',
    title: 'User Saga',
    synopsis: 'Owned',
    origin: 'user',
    ownerUserId: GM.actorId,
    payload: {
      title: 'User Saga',
      blurb: '',
      synopsis: 'Owned',
      knowledgeFacts: [
        { id: 'kf-public', summary: 'Public fact', visibility: 'public' },
        { id: 'kf-hidden', summary: 'Hidden fact', visibility: 'gm_only' },
      ],
      locations: [],
      pregens: [],
      packageId: null,
      initialAdventure: {
        clocks: [{ id: 'c1', summary: 'Clock', visibility: 'shared' }],
        consequences: [],
      },
    },
  });

  const created = create(GM, userSaga.sagaId, userSaga.versionId, 'Gruppe');
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  const projectId = created.value.id;
  const publicId = created.value.publicId;
  assert(publicId, 'publicId present');
  project.setProjectCodeForTests(projectId, 'PROJ8761');
  assert(joinProj(Player, 'PROJ8761', null).ok, 'join project');
  const playerMember = project
    .listActiveMembers(projectId)
    .find((m) => m.userId === Player.actorId);
  assert(playerMember?.memberId, 'player member id');
  const bundleSet = setMemberBundle(
    GM,
    projectId,
    playerMember.memberId,
    'bundle.saga.player',
  );
  assert(bundleSet.ok, `player bundle: ${bundleSet.ok ? '' : bundleSet.error}`);

  // Seed adventure consequences on project
  db.prepare(`UPDATE projects SET adventure_runtime = ? WHERE id = ?`).run(
    JSON.stringify({
      clocks: [{ id: 'c1', summary: 'Clock', visibility: 'shared' }],
      consequences: [
        {
          id: 'cons-shared',
          summary: 'Shared consequence',
          visibility: 'shared',
        },
        {
          id: 'cons-gm',
          summary: 'GM only consequence',
          visibility: 'gm_only',
        },
      ],
      openDeadlines: [],
      flags: [],
    }),
    projectId,
  );

  const play = createPlay(GM, projectId, 'Abend');
  assert(play.ok, `play: ${play.ok ? '' : play.error}`);
  const sessionId = play.value.sessionId;

  // --- Overview: membership + role projection ---
  const ovGm = getOverview(GM, publicId);
  assert(ovGm.ok, `overview gm: ${ovGm.ok ? '' : ovGm.error}`);
  assert(ovGm.value.isGm === true, 'gm isGm');
  assert(ovGm.value.selfRole === 'gamemaster', 'gm role');
  assert(
    Array.isArray(ovGm.value.worldStateSummary.consequences) &&
      ovGm.value.worldStateSummary.consequences.length === 2,
    'gm sees both consequences',
  );

  const ovPlayer = getOverview(Player, publicId);
  assert(ovPlayer.ok, `overview player: ${ovPlayer.ok ? '' : ovPlayer.error}`);
  assert(ovPlayer.value.isGm === false, 'player not gm');
  assert(
    ovPlayer.value.worldStateSummary.consequences.every((c) => c.visibility !== 'gm_only'),
    'player redacts gm_only consequences',
  );
  assert(!getOverview(Stranger, publicId).ok, 'stranger overview denied');

  // --- Lore timeline: membership + hidden ---
  const loreGm = getLore(GM, publicId);
  assert(loreGm.ok, `lore gm: ${loreGm.ok ? '' : loreGm.error}`);
  assert(
    loreGm.value.entries.some((e) => String(e.id).includes('kf-hidden')),
    'gm sees hidden lore',
  );

  const lorePlayer = getLore(Player, publicId);
  assert(lorePlayer.ok, `lore player: ${lorePlayer.ok ? '' : lorePlayer.error}`);
  assert(
    !lorePlayer.value.entries.some((e) => String(e.id).includes('kf-hidden')),
    'player hides gm_only lore',
  );
  assert(
    lorePlayer.value.entries.some((e) => String(e.id).includes('kf-public')),
    'player sees public lore',
  );
  assert(!getLore(Stranger, publicId).ok, 'stranger lore denied');

  // --- Promote signatures (literal union / arity) ---
  assert(typeof saga.promoteSessionOutcomeToSaga === 'function', 'promote saga name');
  assert(typeof saga.promoteSessionOutcomeToWorld === 'function', 'promote world name');
  assert(saga.promoteSessionOutcomeToSaga.length === 3, 'promote saga arity');
  assert(saga.promoteSessionOutcomeToWorld.length === 3, 'promote world arity');

  // --- Negative promote paths ---
  assert(!promoteSaga(Player, sessionId, 'cons-shared').ok, 'player cannot promote saga');
  assert(!promoteWorld(Player, sessionId, 'cons-shared').ok, 'player cannot promote world');
  assert(!promoteSaga(GM, sessionId, 'missing-cons').ok, 'missing consequence');

  const revBefore = (
    db.prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`).get(sessionId) || {
      revision: 0,
    }
  ).revision;
  const draftRevBefore = (
    db.prepare(`SELECT draft_revision AS r FROM saga_definitions WHERE id = ?`).get(userSaga.sagaId)
  ).r;

  const promo = promoteSaga(GM, sessionId, 'cons-shared');
  assert(promo.ok && promo.value.ok === true, `promote saga: ${promo.ok ? JSON.stringify(promo.value) : promo.error}`);
  assert(promo.value.idempotent === false, 'first promote not idempotent');
  assert(promo.value.targetKind === 'saga_fact', 'targetKind saga_fact');
  assert(String(promo.value.targetRef).startsWith('promoted:'), 'targetRef prefix');

  const draftRevAfter = (
    db.prepare(`SELECT draft_revision AS r FROM saga_definitions WHERE id = ?`).get(userSaga.sagaId)
  ).r;
  assert(draftRevAfter === draftRevBefore + 1, 'draft_revision bumped once');

  const revAfter = (
    db.prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`).get(sessionId)
  ).revision;
  assert(revAfter === revBefore, 'session revision unchanged');

  const events = db
    .prepare(`SELECT COUNT(*) AS c FROM session_events WHERE session_id = ?`)
    .get(sessionId).c;
  assert(events >= 1, 'promote event appended');

  const again = promoteSaga(GM, sessionId, 'cons-shared');
  assert(again.ok && again.value.idempotent === true, 'idempotent promote');
  const draftRevAgain = (
    db.prepare(`SELECT draft_revision AS r FROM saga_definitions WHERE id = ?`).get(userSaga.sagaId)
  ).r;
  assert(draftRevAgain === draftRevAfter, 'idempotent no draft bump');

  // --- Promote to world (GM owns world via provision) ---
  const worldPromo = promoteWorld(GM, sessionId, 'cons-gm');
  assert(
    worldPromo.ok && worldPromo.value.ok === true,
    `promote world: ${worldPromo.ok ? JSON.stringify(worldPromo.value) : worldPromo.error}`,
  );
  assert(worldPromo.value.targetKind === 'world_fact', 'world targetKind');
  const worldAgain = promoteWorld(GM, sessionId, 'cons-gm');
  assert(worldAgain.ok && worldAgain.value.idempotent === true, 'world idempotent');

  const worldRow = db
    .prepare(
      `SELECT payload FROM worlds WHERE id = (SELECT world_id FROM projects WHERE id = ?)`,
    )
    .get(projectId);
  const worldPayload = JSON.parse(worldRow.payload);
  assert(
    Array.isArray(worldPayload?.modules?.promotedLore?.facts) &&
      worldPayload.modules.promotedLore.facts.some((f) => f.id === 'promoted:cons-gm'),
    'world lore fact stored',
  );

  // Legacy regression: append_session_event is not a public host RPC — promote path
  // uses module-private event writer with authenticated actorId (no client-supplied actor).
  assert(
    typeof session.appendSessionEvent !== 'function' &&
      typeof saga.appendSessionEvent !== 'function',
    'no public append_session_event surface (RPC-SEC-ANON-EVENT-HELPER successor)',
  );

  console.log('rpc-saga-projections.self-test: PASS');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
