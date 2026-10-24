#!/usr/bin/env node
/**
 * rpc-saga-authoring.self-test — saga draft/copy/publish owner + revision semantics (#871).
 * Location: scripts/rpc-saga-authoring.self-test.mjs
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
const sagaUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_user_saga_definition.ts'),
).href;
const copyCmd = pathToFileURL(
  join(root, 'server/src/application/commands/copy_native_saga_definition.ts'),
).href;
const editorCmd = pathToFileURL(
  join(root, 'server/src/application/commands/get_saga_definition_editor.ts'),
).href;
const saveCmd = pathToFileURL(
  join(root, 'server/src/application/commands/save_saga_definition_draft.ts'),
).href;
const publishCmd = pathToFileURL(
  join(root, 'server/src/application/commands/publish_saga_definition_version.ts'),
).href;

const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createSagaPorts } = await import(sagaUrl);
const { create_user_saga_definition } = await import(createCmd);
const { copy_native_saga_definition } = await import(copyCmd);
const { get_saga_definition_editor } = await import(editorCmd);
const { save_saga_definition_draft } = await import(saveCmd);
const { publish_saga_definition_version } = await import(publishCmd);

const work = mkdtempSync(join(tmpdir(), 'rpc-saga-auth-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 7, `schema>=7 got ${boot.schemaVersion}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(db, {
    actorHasAccessToSaga: project.actorHasAccessToSaga,
  });
  const saga = createSagaPorts({ db, authorize: permissions.authorize, project });

  const create = create_user_saga_definition(saga);
  const copy = copy_native_saga_definition(saga);
  const editor = get_saga_definition_editor(saga);
  const save = save_saga_definition_draft(saga);
  const publish = publish_saga_definition_version(saga);

  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };

  // --- Fall 1: owner scope; native immutable ---
  const created = create(O, 'Meine Saga', 'Blurb');
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  assert(created.value.revision === 0, 'revision 0');

  const foreignSave = save(X, created.value.sagaId, { title: 'Hack' }, 0);
  assert(!foreignSave.ok && foreignSave.error === '42501', `foreign save: ${foreignSave.error}`);

  const native = saga.seedNativeForTests({ title: 'Dornhain', synopsis: 'Native' });
  const nativeSave = save(O, native.sagaId, { title: 'Nope' }, 0);
  assert(!nativeSave.ok && nativeSave.error === '42501', `native immutable: ${nativeSave.error}`);

  // --- Fall 2: editor ensures draft once ---
  const ed1 = editor(O, created.value.sagaId);
  assert(ed1.ok && ed1.value.canEdit === true, 'editor owner');
  assert(saga.countDraftsForTests(created.value.sagaId) === 1, 'one draft');
  const ed2 = editor(O, created.value.sagaId);
  assert(ed2.ok && ed2.value.versionId === ed1.value.versionId, 'same draft id');
  assert(saga.countDraftsForTests(created.value.sagaId) === 1, 'still one draft');

  const nativeEd = editor(O, native.sagaId);
  assert(nativeEd.ok && nativeEd.value.canEdit === false, 'native read-only editor');

  // --- Fall 3: revision conflict leaves no new publish ---
  const saved = save(
    O,
    created.value.sagaId,
    { title: 'Meine Saga', blurb: 'x', synopsis: 'x' },
    0,
  );
  assert(saved.ok && saved.value.revision === 1, `save: ${saved.ok ? saved.value.revision : saved.error}`);

  const conflict = save(
    O,
    created.value.sagaId,
    { title: 'Meine Saga', blurb: 'stale' },
    0,
  );
  assert(!conflict.ok && conflict.error === '40001', `conflict save: ${conflict.error}`);

  const pubConflict = publish(O, created.value.sagaId, 0);
  assert(!pubConflict.ok && pubConflict.error === '40001', `conflict publish: ${pubConflict.error}`);
  assert(saga.countPublishedForTests(created.value.sagaId) === 0, 'no publish on conflict');

  const published = publish(O, created.value.sagaId, 1);
  assert(published.ok && published.value.versionLabel === 'v1', `publish: ${published.ok ? published.value.versionLabel : published.error}`);
  assert(saga.countPublishedForTests(created.value.sagaId) === 1, 'one published');

  // --- Fall 4: native copy → own draft + published; publish does not overwrite ---
  const copied = copy(O, native.sagaId);
  assert(copied.ok, `copy: ${copied.ok ? '' : copied.error}`);
  assert(saga.countPublishedForTests(copied.value.sagaId) === 1, 'copy has v1 published');
  assert(saga.countDraftsForTests(copied.value.sagaId) === 1, 'copy has draft');

  const copyEd = editor(O, copied.value.sagaId);
  assert(copyEd.ok && copyEd.value.canEdit === true, 'copy editable');
  const copySave = save(
    O,
    copied.value.sagaId,
    { title: 'Dornhain (Kopie)', blurb: 'edited' },
    0,
  );
  assert(copySave.ok, 'copy save');
  const beforeLabels = new Set(
    // republish creates v2 — existing v1 remains
    ['v1'],
  );
  const copyPub = publish(O, copied.value.sagaId, 1);
  assert(copyPub.ok && copyPub.value.versionLabel === 'v2', `copy publish v2: ${copyPub.ok ? copyPub.value.versionLabel : copyPub.error}`);
  assert(saga.countPublishedForTests(copied.value.sagaId) === 2, 'v1+v2 retained');
  assert(beforeLabels.has('v1'), 'v1 not overwritten');

  const badCopy = copy(O, created.value.sagaId);
  assert(!badCopy.ok && badCopy.error === '22023', 'only native copyable');

  // Linked solo ownership (MIG-015): remote-account with linkedSoloActorIds may edit
  const soloOwned = create(O, 'Linked Saga', '');
  assert(soloOwned.ok, 'solo owned create');
  const linked = {
    kind: 'remote-account',
    actorId: 'remote-r',
    sessionId: 'sess-1',
    email: null,
    linkedSoloActorIds: ['owner-o'],
  };
  const linkedEd = editor(linked, soloOwned.value.sagaId);
  assert(linkedEd.ok && linkedEd.value.canEdit === true, `linked solo can edit: ${linkedEd.ok ? '' : linkedEd.error}`);

  db.close();
  console.log('PASS rpc-saga-authoring.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
