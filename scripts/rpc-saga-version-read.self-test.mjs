#!/usr/bin/env node
/**
 * rpc-saga-version-read.self-test — native slug + version ACL + GM projection (#872).
 * Location: scripts/rpc-saga-version-read.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const sagaUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const versionCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_saga_definition_version.ts'),
).href;
const nativeCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_native_saga_definition_by_slug.ts'),
).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_user_saga_definition.ts'),
).href;
const publishCmd = pathToFileURL(
  join(root, 'server/src/application/commands/publish_saga_definition_version.ts'),
).href;
const saveCmd = pathToFileURL(
  join(root, 'server/src/application/commands/save_saga_definition_draft.ts'),
).href;
const decoderUrl = pathToFileURL(
  join(root, 'src/domains/saga/contracts/saga-definition.ts'),
).href;
const fixturesUrl = pathToFileURL(
  join(root, 'server/src/application/saga-version-read/__tests__/fixtures.ts'),
).href;

const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createSagaPorts } = await import(sagaUrl);
const { get_saga_definition_version } = await import(versionCmd);
const { get_native_saga_definition_by_slug } = await import(nativeCmd);
const { create_user_saga_definition } = await import(createCmd);
const { publish_saga_definition_version } = await import(publishCmd);
const { save_saga_definition_draft } = await import(saveCmd);
const { parseSagaDefinitionVersion } = await import(decoderUrl);
const { VERSION_READ_PAYLOAD_WITH_GM_FACTS } = await import(fixturesUrl);

const work = mkdtempSync(join(tmpdir(), 'rpc-saga-ver-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 8, `schema>=8 got ${boot.schemaVersion}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  });
  const saga = createSagaPorts({ db, authorize: permissions.authorize, project });

  const getVersion = get_saga_definition_version(saga);
  const getNative = get_native_saga_definition_by_slug(saga);
  const create = create_user_saga_definition(saga);
  const save = save_saga_definition_draft(saga);
  const publish = publish_saga_definition_version(saga);

  const AUTH = { kind: 'solo-local', actorId: 'reader-a' };
  const OWNER = { kind: 'solo-local', actorId: 'owner-o' };
  const STRANGER = { kind: 'solo-local', actorId: 'stranger-x' };
  const PLAYER = { kind: 'solo-local', actorId: 'player-p' };
  const GM = { kind: 'solo-local', actorId: 'gm-g' };

  // --- Fall 1: native slug → newest published; unknown → P0002 ---
  const native = saga.seedNativeForTests({
    slug: 'dornhain',
    title: 'Dornhain',
    synopsis: 'Native',
    payload: { ...VERSION_READ_PAYLOAD_WITH_GM_FACTS },
  });
  const older = '2020-01-01T00:00:00.000Z';
  const newer = '2024-06-01T00:00:00.000Z';
  // Re-seed v1 published_at older by inserting v2 newer
  const v2Id = saga.seedPublishedVersionForTests({
    sagaId: native.sagaId,
    versionLabel: 'v2',
    publishedAt: newer,
    payload: {
      ...VERSION_READ_PAYLOAD_WITH_GM_FACTS,
      title: 'Dornhain v2',
    },
  });
  // Backdate v1
  db.prepare(`UPDATE saga_definition_versions SET published_at = ? WHERE id = ?`).run(
    older,
    native.versionId,
  );

  const bySlug = getNative(AUTH, '  dornhain  ');
  assert(bySlug.ok, `native slug: ${bySlug.ok ? '' : bySlug.error}`);
  assert(bySlug.value.versionId === v2Id, `newest version got ${bySlug.value.versionId}`);
  assert(bySlug.value.versionLabel === 'v2', 'label v2');

  const missing = getNative(AUTH, 'unknown-slug');
  assert(!missing.ok && missing.error === 'P0002', `unknown slug: ${missing.error}`);

  const unauth = getNative({ kind: 'solo-local', actorId: '' }, 'dornhain');
  assert(!unauth.ok && unauth.error === '42501', 'unauthenticated deny');

  // --- Fall 2: access — native published / owner / project member ---
  const nativePlayer = getVersion(AUTH, v2Id);
  assert(nativePlayer.ok, 'native published readable');
  assert(nativePlayer.value.isGmProjection === false, 'native without project GM → player');

  const created = create(OWNER, 'Private Saga', 'blurb');
  assert(created.ok, 'create user saga');
  const saved = save(
    OWNER,
    created.value.sagaId,
    { ...VERSION_READ_PAYLOAD_WITH_GM_FACTS, title: 'Private Saga' },
    0,
  );
  assert(saved.ok, 'save draft');
  const pub = publish(OWNER, created.value.sagaId, 1);
  assert(pub.ok, 'publish user saga');

  const ownerRead = getVersion(OWNER, pub.value.versionId);
  assert(ownerRead.ok && ownerRead.value.isGmProjection === true, 'owner → GM projection');

  const strangerRead = getVersion(STRANGER, pub.value.versionId);
  assert(!strangerRead.ok && strangerRead.error === '42501', `stranger: ${strangerRead.error}`);

  // Bind project to user saga; player member may read
  const worldId = randomUUID();
  const projectId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, GM.actorId, 'W', now);
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, GM.actorId, 'P', now, created.value.sagaId);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES (?, ?, 'player', 1, ?)`,
  ).run(projectId, PLAYER.actorId, now);

  const playerRead = getVersion(PLAYER, pub.value.versionId);
  assert(playerRead.ok, `player member: ${playerRead.ok ? '' : playerRead.error}`);
  assert(playerRead.value.isGmProjection === false, 'player not GM');

  const gmRead = getVersion(GM, pub.value.versionId);
  assert(gmRead.ok && gmRead.value.isGmProjection === true, 'project GM → GM projection');

  // Native with GM project → isGmProjection true
  const nativeProjectId = randomUUID();
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(nativeProjectId, worldId, GM.actorId, 'NativeP', now, native.sagaId);
  const nativeGm = getVersion(GM, v2Id);
  assert(nativeGm.ok && nativeGm.value.isGmProjection === true, 'native project GM');

  // --- Fall 3: GM projection strips gm_only facts for players ---
  const factsPlayer = playerRead.value.payload.knowledgeFacts;
  assert(Array.isArray(factsPlayer), 'facts array');
  assert(
    factsPlayer.every((f) => f.visibility !== 'gm_only'),
    'player payload has no gm_only',
  );
  assert(
    factsPlayer.some((f) => f.id === 'public-1') && factsPlayer.some((f) => f.id === 'shared-1'),
    'player keeps public/shared',
  );
  const factsGm = gmRead.value.payload.knowledgeFacts;
  assert(factsGm.some((f) => f.id === 'gm-1'), 'GM keeps gm_only');

  // P2: noncanonical visibility stays fail-closed for players
  const weirdPayload = {
    ...VERSION_READ_PAYLOAD_WITH_GM_FACTS,
    title: 'Weird',
    knowledgeFacts: [
      { id: 'upper', visibility: 'PUBLIC', summary: 'Bad case' },
      { id: 'trim', visibility: ' public ', summary: 'Bad trim' },
      { id: 'ok', visibility: 'public', summary: 'Ok' },
    ],
  };
  const weirdNative = saga.seedNativeForTests({
    slug: 'weird-vis',
    title: 'Weird',
    payload: weirdPayload,
  });
  const weirdRead = getVersion(PLAYER, weirdNative.versionId);
  assert(weirdRead.ok, 'weird native readable');
  const weirdFacts = weirdRead.value.payload.knowledgeFacts;
  assert(
    weirdFacts.every((f) => f.id === 'ok') && weirdFacts.length === 1,
    'noncanonical visibility hidden',
  );

  // --- Fall 4: infrastructure decoder ---
  const decoded = parseSagaDefinitionVersion(ownerRead.value);
  assert(decoded.sagaId === ownerRead.value.sagaId, 'decoder sagaId');
  assert(decoded.versionId === ownerRead.value.versionId, 'decoder versionId');
  let threw = false;
  try {
    parseSagaDefinitionVersion(null);
  } catch {
    threw = true;
  }
  assert(threw, 'decoder rejects null');
  threw = false;
  try {
    parseSagaDefinitionVersion({ sagaId: 'x' });
  } catch {
    threw = true;
  }
  assert(threw, 'decoder rejects incomplete');

  console.log('PASS rpc-saga-version-read.self-test');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
