#!/usr/bin/env node
/**
 * mig-011-sqlite-schema.self-test — catalog migrate once, rollback on failure,
 * integrity FK/orphan gate, module ownership, BEGIN IMMEDIATE concurrency.
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
import { spawnSync } from 'node:child_process';

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
  listMigrationFiles,
  readSchemaVersion,
  readMigrationFailure,
  runIntegrityCheck,
  foreignKeysEnabled,
  TABLE_OWNERSHIP,
  owningModuleForTable,
  legacySchemaUpgradeLockPresent,
  clearLegacySchemaUpgradeLockAfterVerifiedStandstill,
} = await import(persistenceUrl);

const catalogMigrations = join(root, 'server/migrations');
const catalogSteps = listMigrationFiles(catalogMigrations);
assert(catalogSteps.length >= 1, 'catalog must have migrations');
const expectedVersion = catalogSteps[catalogSteps.length - 1].version;
const expectedJournal = catalogSteps.length;
const nextBrokenVersion = expectedVersion + 1;
const nextBrokenId = `${String(nextBrokenVersion).padStart(4, '0')}_broken`;
const work = mkdtempSync(join(tmpdir(), 'mig011-'));

try {
  // --- AC1: migrate twice → schema_version stable; foreign_keys ON ---
  const data1 = join(work, 'data1');
  mkdirSync(data1);
  const boot1 = bootstrapHostPersistence({ dataDir: data1, migrationsDir: catalogMigrations });
  assert(boot1.ok, `bootstrap1: ${boot1.ok ? '' : boot1.error}`);
  assert(boot1.schemaVersion === expectedVersion, `schemaVersion after first run expected ${expectedVersion} got ${boot1.schemaVersion}`);
  assert(foreignKeysEnabled(boot1.db), 'foreign_keys must be ON after bootstrap');
  const v1 = readSchemaVersion(boot1.db);
  boot1.db.close();

  const boot2 = bootstrapHostPersistence({ dataDir: data1, migrationsDir: catalogMigrations });
  assert(boot2.ok, `bootstrap2: ${boot2.ok ? '' : boot2.error}`);
  assert(boot2.schemaVersion === v1, 'second run must leave schema_version unchanged');
  assert(readSchemaVersion(boot2.db) === v1, 'readSchemaVersion stable');
  const journalCount = boot2.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(journalCount === expectedJournal, `journal rows expected ${expectedJournal} got ${journalCount}`);
  boot2.db.close();

  // --- AC2: broken migration rolls back; next start reports same failed step (crash mid-migrate) ---
  const dataFail = join(work, 'data-fail');
  const migFail = join(work, 'migrations-fail');
  mkdirSync(dataFail);
  mkdirSync(migFail);
  for (const name of readdirSync(catalogMigrations)) {
    copyFileSync(join(catalogMigrations, name), join(migFail, name));
  }
  writeFileSync(
    join(migFail, `${nextBrokenId}.sql`),
    `-- intentional failure\nCREATE TABLE broken_step (id TEXT NOT NULL PRIMARY KEY) STRICT;\nINSERT INTO broken_step (id) VALUES (NULL);\n`,
    'utf8',
  );

  const openFail = openHostDatabase(join(dataFail, 'host.sqlite'));
  assert(openFail.ok, 'open fail db');
  const firstFail = runMigrations({ db: openFail.db, dataDir: dataFail, migrationsDir: migFail });
  assert(!firstFail.ok, 'broken migration must fail');
  assert(firstFail.failedStep?.id === nextBrokenId, `failed step id got ${firstFail.failedStep?.id}`);
  assert(readSchemaVersion(openFail.db) === expectedVersion, `schema_version must remain ${expectedVersion} after rolled-back broken step`);
  const brokenExists = openFail.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='broken_step'`)
    .get();
  assert(!brokenExists, 'broken_step table must not remain after rollback');
  openFail.db.close();

  const failureSidecar = readMigrationFailure(dataFail);
  assert(failureSidecar?.id === nextBrokenId, `sidecar must record ${nextBrokenId}`);

  // Restart after crash: same failed step, no data loss of applied v1
  const openFail2 = openHostDatabase(join(dataFail, 'host.sqlite'));
  assert(openFail2.ok, 'reopen after failure');
  const secondFail = runMigrations({ db: openFail2.db, dataDir: dataFail, migrationsDir: migFail });
  assert(!secondFail.ok, 'second start must still fail on same broken step');
  assert(secondFail.failedStep?.id === nextBrokenId, 'same failed step reported');
  assert(readSchemaVersion(openFail2.db) === expectedVersion, `schema_version still ${expectedVersion}`);
  const worldsIntact = openFail2.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='worlds'`)
    .get();
  assert(!!worldsIntact, 'applied catalog tables must survive crash/rollback of broken next step');
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
  assert(host.schemaVersion === expectedVersion, `host schemaVersion ${expectedVersion}`);
  assert(host.isReady() === false, 'not ready before start');
  await host.start();
  assert(host.isReady() === true, 'ready after start');
  await host.stop();

  // --- AC3: integrity — orphan membership / invalid FK fails gate ---
  const dataIntegrity = join(work, 'data-integrity');
  mkdirSync(dataIntegrity);
  const bootOk = bootstrapHostPersistence({ dataDir: dataIntegrity, migrationsDir: catalogMigrations });
  assert(bootOk.ok, 'integrity base bootstrap');
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

  // --- Legacy schema-upgrade.lock: fail-closed (no auto-delete); operator recovery ---
  const dataLegacy = join(work, 'data-legacy');
  mkdirSync(dataLegacy);
  const legacyLock = join(dataLegacy, 'schema-upgrade.lock');
  writeFileSync(legacyLock, 'held-by-old-host\n', 'utf8');
  assert(legacySchemaUpgradeLockPresent(dataLegacy), 'legacy lock detected');
  const bootWhileLegacy = bootstrapHostPersistence({ dataDir: dataLegacy, migrationsDir: catalogMigrations });
  assert(!bootWhileLegacy.ok, 'migrate must fail-closed while legacy lock present');
  assert(
    String(bootWhileLegacy.error).includes('legacy schema-upgrade.lock'),
    `legacy fail error got ${bootWhileLegacy.error}`,
  );
  assert(existsSync(legacyLock), 'legacy lock must remain (no auto-delete)');

  // Old+new concurrency: old host holds legacy lock + reserved write TX (pre-check version outside TX).
  // New host refuses on lock presence — never steals the lock from a live old upgrader.
  const dataOldNew = join(work, 'data-old-new');
  mkdirSync(dataOldNew);
  // Seed v1 without lock, then simulate old host re-locking for a follow-on step.
  const seedOldNew = bootstrapHostPersistence({ dataDir: dataOldNew, migrationsDir: catalogMigrations });
  assert(seedOldNew.ok, 'seed old-new');
  seedOldNew.db.close();
  writeFileSync(join(dataOldNew, 'schema-upgrade.lock'), 'old-runner-active\n', 'utf8');
  const oldConn = openHostDatabase(join(dataOldNew, 'host.sqlite'));
  assert(oldConn.ok, 'old host reopen');
  // Old pattern: read version outside TX, then BEGIN (still holds reserved lock).
  const oldVersionOutside = readSchemaVersion(oldConn.db);
  assert(oldVersionOutside === expectedVersion, `old host sees v${expectedVersion}`);
  oldConn.db.exec('BEGIN IMMEDIATE');
  const newWhileOld = bootstrapHostPersistence({ dataDir: dataOldNew, migrationsDir: catalogMigrations });
  assert(!newWhileOld.ok, 'new host must fail-closed while old lock file present');
  assert(String(newWhileOld.error).includes('legacy schema-upgrade.lock'), newWhileOld.error);
  oldConn.db.exec('ROLLBACK');
  oldConn.db.close();
  // Without verified standstill, clear must not be callable as auto-path — require explicit flag.
  const cleared = clearLegacySchemaUpgradeLockAfterVerifiedStandstill(dataOldNew, {
    oldHostVerifiedStopped: true,
  });
  assert(cleared.ok, `operator clear: ${cleared.ok ? '' : cleared.error}`);
  assert(!existsSync(join(dataOldNew, 'schema-upgrade.lock')), 'lock removed only after verified standstill');
  const bootAfterClear = bootstrapHostPersistence({ dataDir: dataOldNew, migrationsDir: catalogMigrations });
  assert(bootAfterClear.ok, `bootstrap after verified clear: ${bootAfterClear.ok ? '' : bootAfterClear.error}`);
  assert(bootAfterClear.schemaVersion === expectedVersion, 'schema intact after old+new sequence');
  bootAfterClear.db.close();

  // --- Real process crash (SIGKILL) mid-migration TX (isolated subprocess) ---
  const sigkill = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(root, 'scripts/mig-011-sigkill-crash.self-test.mjs')],
    { encoding: 'utf8', timeout: 30_000 },
  );
  if (sigkill.status !== 0) {
    console.error(sigkill.stdout);
    console.error(sigkill.stderr);
  }
  assert(sigkill.status === 0, `SIGKILL crash self-test exit ${sigkill.status}`);
  assert(/PASS: mig-011 SIGKILL|SKIP: SIGKILL/.test(sigkill.stdout), 'SIGKILL self-test output');

  // --- duplicate migration version must fail closed (not skip) ---
  const migDup = join(work, 'migrations-dup');
  mkdirSync(migDup);
  writeFileSync(join(migDup, '0001_a.sql'), 'SELECT 1;\n', 'utf8');
  writeFileSync(join(migDup, '0001_b.sql'), 'SELECT 2;\n', 'utf8');
  let dupThrown = false;
  try {
    listMigrationFiles(migDup);
  } catch (err) {
    dupThrown = /duplicate migration version/.test(err instanceof Error ? err.message : String(err));
  }
  assert(dupThrown, 'duplicate version must throw from listMigrationFiles');
  const dataDup = join(work, 'data-dup');
  mkdirSync(dataDup);
  const openDup = openHostDatabase(join(dataDup, 'host.sqlite'));
  assert(openDup.ok, 'open dup db');
  const dupRun = runMigrations({ db: openDup.db, dataDir: dataDup, migrationsDir: migDup });
  assert(!dupRun.ok, 'runMigrations must fail on duplicate versions');
  assert(/duplicate migration version/.test(dupRun.error), `dup error got ${dupRun.error}`);
  openDup.db.close();

  // --- Two concurrent host starts on the same DB (BEGIN IMMEDIATE exclusivity) ---
  const dataRace = join(work, 'data-race');
  mkdirSync(dataRace);
  const workerPath = join(work, 'race-worker.mjs');
  writeFileSync(
    workerPath,
    `
import { pathToFileURL } from 'node:url';
const persistenceUrl = process.env.P_URL;
const dataDir = process.env.DATA_DIR;
const migrationsDir = process.env.MIG_DIR;
const { bootstrapHostPersistence } = await import(persistenceUrl);
const result = bootstrapHostPersistence({ dataDir, migrationsDir });
if (!result.ok) {
  console.log(JSON.stringify({ ok: false, error: result.error, failedStepId: result.failedStepId }));
  process.exit(0);
}
const count = result.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
result.db.close();
console.log(JSON.stringify({ ok: true, schemaVersion: result.schemaVersion, journal: count }));
`,
    'utf8',
  );

  const spawnOne = () =>
    spawnSync(
      process.execPath,
      ['--experimental-strip-types', workerPath],
      {
        env: {
          ...process.env,
          P_URL: persistenceUrl,
          DATA_DIR: dataRace,
          MIG_DIR: catalogMigrations,
        },
        encoding: 'utf8',
        timeout: 15_000,
      },
    );

  // Sequential warm-up ensure catalog applies once
  const warm = spawnOne();
  assert(warm.status === 0, `warm worker exit ${warm.status}: ${warm.stderr}`);
  const warmOut = JSON.parse(warm.stdout.trim().split('\n').at(-1));
  assert(warmOut.ok === true && warmOut.journal === expectedJournal, `warm bootstrap: ${JSON.stringify(warmOut)}`);

  const { spawn } = await import('node:child_process');
  const runParallelOn = (dataDir) =>
    new Promise((resolve) => {
      const outs = [];
      let left = 2;
      const start = (label) => {
        const child = spawn(
          process.execPath,
          ['--experimental-strip-types', workerPath],
          {
            env: { ...process.env, P_URL: persistenceUrl, DATA_DIR: dataDir, MIG_DIR: catalogMigrations },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => {
          stdout += d;
        });
        child.stderr.on('data', (d) => {
          stderr += d;
        });
        child.on('close', (code) => {
          outs.push({ label, code, stdout, stderr });
          left -= 1;
          if (left === 0) resolve(outs);
        });
      };
      start('p1');
      start('p2');
    });

  // Concurrent pair on already-migrated DB — no duplicate journal; fail-closed on busy OK
  const parallel = await runParallelOn(dataRace);
  for (const p of parallel) {
    assert(p.code === 0, `parallel ${p.label} exit ${p.code}: ${p.stderr}`);
    const parsed = JSON.parse(p.stdout.trim().split('\n').at(-1));
    if (parsed.ok) {
      assert(parsed.journal === expectedJournal, `parallel ${p.label} journal must stay ${expectedJournal} got ${parsed.journal}`);
      assert(parsed.schemaVersion === expectedVersion, `parallel ${p.label} version`);
    } else {
      assert(
        /busy|locked|upgrade/i.test(parsed.error || ''),
        `parallel fail-closed expected busy, got ${parsed.error}`,
      );
    }
  }
  const verifyRace = openHostDatabase(join(dataRace, 'host.sqlite'));
  assert(verifyRace.ok, 'reopen race db');
  const raceJournal = verifyRace.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(raceJournal === expectedJournal, `no duplicate journal after concurrent starts, got ${raceJournal}`);
  assert(readSchemaVersion(verifyRace.db) === expectedVersion, 'schema version intact after concurrent starts');
  verifyRace.db.close();

  // Fresh-DB concurrent migrate: at least one succeeds; journal never >1; no corruption
  const dataRaceFresh = join(work, 'data-race-fresh');
  mkdirSync(dataRaceFresh);
  const freshParallel = await runParallelOn(dataRaceFresh);
  const freshParsed = freshParallel.map((p) => {
    assert(p.code === 0, `fresh parallel ${p.label} exit ${p.code}: ${p.stderr}`);
    return JSON.parse(p.stdout.trim().split('\n').at(-1));
  });
  assert(
    freshParsed.some((p) => p.ok === true),
    `at least one concurrent migrate must succeed: ${JSON.stringify(freshParsed)}`,
  );
  for (const p of freshParsed) {
    if (!p.ok) {
      assert(/busy|locked|upgrade/i.test(p.error || ''), `fresh fail-closed: ${p.error}`);
    }
  }
  const verifyFresh = openHostDatabase(join(dataRaceFresh, 'host.sqlite'));
  assert(verifyFresh.ok, 'reopen fresh race db');
  const freshJournal = verifyFresh.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(freshJournal === expectedJournal, `fresh concurrent journal must be ${expectedJournal} got ${freshJournal}`);
  verifyFresh.db.close();

  // --- AC4: ownership registry + boundary private persistence ---
  assert(owningModuleForTable('worlds') === 'world', 'worlds → world');
  assert(owningModuleForTable('world_maps') === 'world', 'world_maps → world');
  assert(owningModuleForTable('user_ai_provider_credentials') === 'ai', 'credentials → ai');
  assert(owningModuleForTable('ai_provider_credential_rate_limits') === 'ai', 'rate limits → ai');
  assert(owningModuleForTable('projects') === 'project', 'projects → project');
  assert(owningModuleForTable('project_members') === 'project', 'project_members → project');
  assert(owningModuleForTable('schema_migrations') === 'ops', 'schema_migrations → ops');
  assert(owningModuleForTable('assets') === 'media', 'assets → media');
  assert(owningModuleForTable('asset_upload_sessions') === 'media', 'asset_upload_sessions → media');
  assert(owningModuleForTable('saga_definitions') === 'saga', 'saga_definitions → saga');
  assert(owningModuleForTable('saga_definition_versions') === 'saga', 'saga_definition_versions → saga');
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

  const worldIndex = readFileSync(join(root, 'server/src/modules/world/index.ts'), 'utf8');
  assert(!worldIndex.includes('project/persistence'), 'world public API must not import project persistence');

  console.log('PASS: mig-011 sqlite schema bootstrap + migration runner (BEGIN IMMEDIATE)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
