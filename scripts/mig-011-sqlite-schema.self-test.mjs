#!/usr/bin/env node
/**
 * mig-011-sqlite-schema.self-test — catalog migrate once, rollback on failure,
 * integrity FK/orphan gate, module ownership.
 * Location: scripts/mig-011-sqlite-schema.self-test.mjs
 */
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  readdirSync,
  existsSync,
} from 'node:fs';
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
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const boundaryUrl = pathToFileURL(join(root, 'scripts/architecture-boundary-check.mjs')).href;

const {
  bootstrapHostPersistence,
  openHostDatabase,
  runMigrations,
  readSchemaVersion,
  readMigrationFailure,
  runIntegrityCheck,
  foreignKeysEnabled,
  TABLE_OWNERSHIP,
  owningModuleForTable,
} = await import(persistenceUrl);

const catalogMigrations = join(root, 'server/migrations');
const work = mkdtempSync(join(tmpdir(), 'mig011-'));

try {
  // --- AC1: migrate twice → schema_version stable; foreign_keys ON ---
  const data1 = join(work, 'data1');
  mkdirSync(data1);
  const boot1 = bootstrapHostPersistence({ dataDir: data1, migrationsDir: catalogMigrations });
  assert(boot1.ok, `bootstrap1: ${boot1.ok ? '' : boot1.error}`);
  assert(boot1.schemaVersion === 1, `schemaVersion after first run expected 1 got ${boot1.schemaVersion}`);
  assert(foreignKeysEnabled(boot1.db), 'foreign_keys must be ON after bootstrap');
  const v1 = readSchemaVersion(boot1.db);
  boot1.db.close();

  const boot2 = bootstrapHostPersistence({ dataDir: data1, migrationsDir: catalogMigrations });
  assert(boot2.ok, `bootstrap2: ${boot2.ok ? '' : boot2.error}`);
  assert(boot2.schemaVersion === v1, 'second run must leave schema_version unchanged');
  assert(readSchemaVersion(boot2.db) === v1, 'readSchemaVersion stable');
  const journalCount = boot2.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(journalCount === 1, `journal rows expected 1 got ${journalCount}`);
  boot2.db.close();

  // --- AC2: broken migration rolls back; next start reports same failed step ---
  const dataFail = join(work, 'data-fail');
  const migFail = join(work, 'migrations-fail');
  mkdirSync(dataFail);
  mkdirSync(migFail);
  for (const name of readdirSync(catalogMigrations)) {
    copyFileSync(join(catalogMigrations, name), join(migFail, name));
  }
  writeFileSync(
    join(migFail, '0002_broken.sql'),
    `-- intentional failure\nCREATE TABLE broken_step (id TEXT NOT NULL PRIMARY KEY) STRICT;\nINSERT INTO broken_step (id) VALUES (NULL);\n`,
    'utf8',
  );

  const openFail = openHostDatabase(join(dataFail, 'host.sqlite'));
  assert(openFail.ok, 'open fail db');
  const firstFail = runMigrations({ db: openFail.db, dataDir: dataFail, migrationsDir: migFail });
  assert(!firstFail.ok, 'broken migration must fail');
  assert(firstFail.failedStep?.id === '0002_broken', `failed step id got ${firstFail.failedStep?.id}`);
  assert(readSchemaVersion(openFail.db) === 1, 'schema_version must remain 1 after rolled-back 0002');
  const brokenExists = openFail.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='broken_step'`)
    .get();
  assert(!brokenExists, 'broken_step table must not remain after rollback');
  openFail.db.close();

  const failureSidecar = readMigrationFailure(dataFail);
  assert(failureSidecar?.id === '0002_broken', 'sidecar must record 0002_broken');

  const openFail2 = openHostDatabase(join(dataFail, 'host.sqlite'));
  assert(openFail2.ok, 'reopen after failure');
  const secondFail = runMigrations({ db: openFail2.db, dataDir: dataFail, migrationsDir: migFail });
  assert(!secondFail.ok, 'second start must still fail on same broken step');
  assert(secondFail.failedStep?.id === '0002_broken', 'same failed step reported');
  assert(readSchemaVersion(openFail2.db) === 1, 'schema_version still 1');
  openFail2.db.close();

  const dataOkHost = join(work, 'data-host');
  mkdirSync(dataOkHost);
  const { createHost } = await import(createHostUrl);
  const host = createHost({
    SAGATREE_DATA_DIR: dataOkHost,
    SAGATREE_PORT: String(18910 + Math.floor(Math.random() * 200)),
    SAGATREE_HOST: '127.0.0.1',
  });
  assert(!('error' in host), `createHost should succeed: ${JSON.stringify(host)}`);
  assert(host.schemaVersion === 1, 'host schemaVersion 1');
  assert(host.isReady() === false, 'not ready before start');
  await host.start();
  assert(host.isReady() === true, 'ready after start');
  await host.stop();

  // --- AC3: integrity — orphan membership / invalid FK fails gate ---
  const dataIntegrity = join(work, 'data-integrity');
  mkdirSync(dataIntegrity);
  const bootOk = bootstrapHostPersistence({ dataDir: dataIntegrity, migrationsDir: catalogMigrations });
  assert(bootOk.ok, 'integrity base bootstrap');
  // Temporarily disable FK to insert orphan, then re-enable and check.
  bootOk.db.exec('PRAGMA foreign_keys=OFF');
  bootOk.db.exec(
    `INSERT INTO project_members (project_id, user_id, role, active, joined_at)
     VALUES ('missing-project', 'user-1', 'player', 1, '2026-10-21T00:00:00.000Z')`,
  );
  bootOk.db.exec('PRAGMA foreign_keys=ON');
  const integrity = runIntegrityCheck(bootOk.db);
  assert(!integrity.ok, 'orphan membership must fail integrity');
  assert(
    integrity.errors.some((e) => e.includes('orphan') || e.includes('foreign key')),
    `expected orphan/fk error, got ${integrity.errors.join('; ')}`,
  );
  bootOk.db.close();

  // Valid membership path passes
  const dataGood = join(work, 'data-good');
  mkdirSync(dataGood);
  const bootGood = bootstrapHostPersistence({ dataDir: dataGood, migrationsDir: catalogMigrations });
  assert(bootGood.ok, 'good bootstrap');
  bootGood.db.exec(`
    INSERT INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('w1', 'owner-1', 'World', '2026-10-21T00:00:00.000Z');
    INSERT INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('p1', 'w1', 'gm-1', 'Saga', '2026-10-21T00:00:00.000Z');
    INSERT INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('p1', 'player-1', 'player', 1, '2026-10-21T00:00:00.000Z');
  `);
  const goodIntegrity = runIntegrityCheck(bootGood.db);
  assert(goodIntegrity.ok, `good integrity: ${goodIntegrity.ok ? '' : goodIntegrity.errors.join('; ')}`);
  bootGood.db.close();

  // --- AC4: ownership registry + boundary private persistence ---
  assert(owningModuleForTable('worlds') === 'world', 'worlds → world');
  assert(owningModuleForTable('projects') === 'project', 'projects → project');
  assert(owningModuleForTable('project_members') === 'project', 'project_members → project');
  assert(owningModuleForTable('schema_migrations') === 'ops', 'schema_migrations → ops');
  const owned = Object.keys(TABLE_OWNERSHIP);
  assert(new Set(owned).size === owned.length, 'unique table ownership');

  const { checkRegisteredHostPackages } = await import(boundaryUrl);
  const violations = checkRegisteredHostPackages(root);
  const persistenceLeaks = violations.filter(
    (v) =>
      v.scope === 'host-module-boundary' &&
      String(v.rule).includes('persistence') &&
      !String(v.file).startsWith('server/src/bootstrap/'),
  );
  assert(persistenceLeaks.length === 0, `private persistence leaks: ${JSON.stringify(persistenceLeaks)}`);

  // Cross-module private import must be rejected by boundary checker (synthetic probe file not needed —
  // world must not import project persistence; verify source tree has no such import).
  const worldIndex = readFileSync(join(root, 'server/src/modules/world/index.ts'), 'utf8');
  assert(!worldIndex.includes('project/persistence'), 'world public API must not import project persistence');

  console.log('PASS: mig-011 sqlite schema bootstrap + migration runner');
} finally {
  rmSync(work, { recursive: true, force: true });
}
