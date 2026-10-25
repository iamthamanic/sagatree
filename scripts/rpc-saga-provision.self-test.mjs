#!/usr/bin/env node
/**
 * rpc-saga-provision.self-test — create/duplicate/ensure native starter (#873).
 * Location: scripts/rpc-saga-provision.self-test.mjs
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
const dupCmd = pathToFileURL(
  join(root, 'server/src/application/commands/duplicate_saga_playthrough.ts'),
).href;
const ensureCmd = pathToFileURL(
  join(root, 'server/src/application/commands/ensure_native_starter_project.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createSagaPorts } = await import(sagaUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_project_from_saga_version } = await import(createCmd);
const { duplicate_saga_playthrough } = await import(dupCmd);
const { ensure_native_starter_project } = await import(ensureCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-saga-prov-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 10, `schema>=10 got ${boot.schemaVersion}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  });
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
  });
  const saga = createSagaPorts({ db, authorize: permissions.authorize, project });

  const create = create_project_from_saga_version({ saga, project, world });
  const dup = duplicate_saga_playthrough({ saga, project, world });
  const ensure = ensure_native_starter_project({ saga, project, world });

  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };
  const Linked = {
    kind: 'remote-account',
    actorId: 'remote-r',
    linkedSoloActorIds: ['owner-o'],
  };

  // --- Fall 1: bind published version + GM membership; canonical SA-XXXXX ---
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
  const created = create(O, native.sagaId, native.versionId, 'Meine Gruppe');
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  assert(created.value.sagaId === native.sagaId, 'saga bound');
  assert(created.value.sagaVersionId === native.versionId, 'version bound');
  assert(created.value.gmUserId === O.actorId, 'gm is actor');
  assert(created.value.adventureRuntime.scene === 'gate', 'initialAdventure copied');
  assert(/^SA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(created.value.publicId), `publicId ${created.value.publicId}`);
  assert(project.actorIsGmOnSaga(O.actorId, native.sagaId), 'gm membership');

  // --- Fall 2: fresh vs with_progress ---
  const world2 = world.createOwnedWorld(O, 'Progress Src');
  assert(world2.ok, 'world2');
  const progressed = project.createFromSagaVersion(O, {
    worldId: world2.value.id,
    sagaId: native.sagaId,
    sagaVersionId: native.versionId,
    title: 'Progress Src',
    description: null,
    adventureRuntime: { chapter: 3 },
  });
  assert(progressed.ok, 'progress source');
  const freshDup = dup(O, progressed.value.id, 'fresh');
  assert(freshDup.ok, `fresh dup: ${freshDup.ok ? '' : freshDup.error}`);
  const freshProj = project.getProject(freshDup.value.id);
  assert(freshProj.ok && freshProj.value.adventureRuntime.scene === 'gate', 'fresh uses initialAdventure');
  const progressDup = dup(O, progressed.value.id, 'with_progress');
  assert(progressDup.ok, 'with_progress dup');
  const progProj = project.getProject(progressDup.value.id);
  assert(progProj.ok && progProj.value.adventureRuntime.chapter === 3, 'progress copied');
  const foreignDup = dup(X, progressed.value.id, 'fresh');
  assert(!foreignDup.ok && foreignDup.error === '42501', `foreign dup: ${foreignDup.error}`);

  // --- Fall 3: ensure native starter idempotent + initialAdventure ---
  const e1 = ensure(O, 'dornhain.whisper');
  assert(e1.ok && e1.value.created === false, 'ensure returns existing');
  assert(e1.value.id === created.value.id, 'same starter');
  const eX = ensure(X, 'dornhain.whisper');
  assert(eX.ok && eX.value.created === true, 'stranger starter');
  const eXProj = project.getProject(eX.value.id);
  assert(eXProj.ok && eXProj.value.adventureRuntime.scene === 'gate', 'ensure seeds initialAdventure');

  // --- Fall 4: denies + user-published + linked solo owns private_backfill ---
  const mismatch = create(O, native.sagaId, '00000000-0000-0000-0000-000000000099', null);
  assert(!mismatch.ok && mismatch.error === 'P0002', `mismatch: ${mismatch.error}`);

  const backfill = saga.seedPublishedDefinitionForTests({
    title: 'Private BF',
    origin: 'private_backfill',
    ownerUserId: O.actorId,
  });
  const bfOwner = create(O, backfill.sagaId, backfill.versionId, null);
  assert(bfOwner.ok, 'owner may spawn private_backfill');
  const bfStranger = create(X, backfill.sagaId, backfill.versionId, null);
  assert(!bfStranger.ok && bfStranger.error === '42501', `bf stranger: ${bfStranger.error}`);
  const bfLinked = create(Linked, backfill.sagaId, backfill.versionId, 'Linked Gruppe');
  assert(bfLinked.ok, `linked solo owner provision: ${bfLinked.ok ? '' : bfLinked.error}`);

  const userPub = saga.seedPublishedDefinitionForTests({
    title: 'User Pub',
    origin: 'user',
    ownerUserId: O.actorId,
  });
  const strangerInstantiate = create(X, userPub.sagaId, userPub.versionId, 'X Gruppe');
  assert(strangerInstantiate.ok, 'USER-PUBLISHED keep-open');

  const badMode = dup(O, created.value.id, 'nope');
  assert(!badMode.ok && badMode.error === '22023', 'bad mode');

  db.close();
  console.log('PASS rpc-saga-provision.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
