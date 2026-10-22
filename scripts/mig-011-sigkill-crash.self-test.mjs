#!/usr/bin/env node
/**
 * Real process-crash recovery for MIG-011 migrations (POSIX SIGKILL).
 * Location: scripts/mig-011-sigkill-crash.self-test.mjs
 *
 * Isolated from the main self-test so SIGKILL cannot leave unsettled
 * top-level awaits in the parent test-gate process.
 *
 * PASS only when the worker is still alive at kill time, SIGKILL is delivered,
 * and close reports signal === 'SIGKILL'. Early exit / ESRCH / timeout / other
 * signals are FAIL — never treated as crash-recovery success.
 */
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

if (process.platform === 'win32') {
  console.log('SKIP: SIGKILL crash-recovery (POSIX only)');
  process.exit(0);
}

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function formatExit(code, signal) {
  return `exitCode=${code === null || code === undefined ? 'null' : code} signal=${signal === null || signal === undefined ? 'null' : signal}`;
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const { bootstrapHostPersistence, openHostDatabase, readSchemaVersion, listMigrationFiles } = await import(persistenceUrl);
const catalogMigrations = join(root, 'server/migrations');
const catalogSteps = listMigrationFiles(catalogMigrations);
const expectedVersion = catalogSteps[catalogSteps.length - 1].version;
const expectedJournal = catalogSteps.length;
const work = mkdtempSync(join(tmpdir(), 'mig011-sigkill-'));

try {
  const dataCrash = join(work, 'data-crash');
  const migCrash = join(work, 'migrations-crash');
  mkdirSync(dataCrash);
  mkdirSync(migCrash);
  for (const name of readdirSync(catalogMigrations)) {
    copyFileSync(join(catalogMigrations, name), join(migCrash, name));
  }

  const seedCrash = bootstrapHostPersistence({ dataDir: dataCrash, migrationsDir: migCrash });
  assert(seedCrash.ok, 'crash seed');
  seedCrash.db.close();

  const marker = join(dataCrash, 'in-tx.marker');
  const crashWorker = join(work, 'crash-worker.mjs');
  // Keep-alive via setInterval (bare forever-Promise can exit under strip-types).
  writeFileSync(
    crashWorker,
    `
import { writeFileSync } from 'node:fs';
const persistenceUrl = process.env.P_URL;
const dbPath = process.env.DB_PATH;
const markerPath = process.env.MARKER;
const { openHostDatabase } = await import(persistenceUrl);
const opened = openHostDatabase(dbPath);
if (!opened.ok) { console.error(opened.error); process.exit(2); }
const db = opened.db;
db.exec('BEGIN IMMEDIATE');
db.exec('CREATE TABLE crash_partial (id TEXT NOT NULL PRIMARY KEY) STRICT');
db.exec("INSERT INTO crash_partial (id) VALUES ('uncommitted')");
writeFileSync(markerPath, 'in-tx\\n', 'utf8');
setInterval(() => {}, 60_000);
`,
    'utf8',
  );

  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', crashWorker],
    {
      env: {
        ...process.env,
        P_URL: persistenceUrl,
        DB_PATH: join(dataCrash, 'host.sqlite'),
        MARKER: marker,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  assert(child.pid != null, 'crash worker failed to spawn');

  let childErr = '';
  child.stderr.on('data', (d) => {
    childErr += d;
  });

  /** @type {{ code: number | null, signal: NodeJS.Signals | null } | null} */
  let closeInfo = null;
  const closePromise = new Promise((resolve) => {
    child.on('close', (code, signal) => {
      closeInfo = { code, signal };
      resolve(closeInfo);
    });
  });

  const markerDeadline = Date.now() + 10_000;
  while (!existsSync(marker) && Date.now() < markerDeadline && closeInfo === null) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (closeInfo !== null) {
    assert(
      false,
      `crash worker exited before SIGKILL (${formatExit(closeInfo.code, closeInfo.signal)}); stderr=${childErr || '(empty)'}`,
    );
  }
  assert(existsSync(marker), `crash worker never entered TX; stderr=${childErr || '(empty)'}`);

  // Settle so keep-alive timer is armed; worker must still be alive.
  await new Promise((r) => setTimeout(r, 150));
  if (closeInfo !== null) {
    assert(
      false,
      `crash worker exited before SIGKILL (${formatExit(closeInfo.code, closeInfo.signal)}); stderr=${childErr || '(empty)'}`,
    );
  }

  // Prove liveness; ESRCH means the process is already gone → FAIL (not a SIGKILL proof).
  try {
    process.kill(child.pid, 0);
  } catch (err) {
    const errno = err && typeof err === 'object' && 'code' in err ? String(err.code) : String(err);
    assert(
      false,
      `crash worker not alive before SIGKILL (${errno}); ${formatExit(closeInfo?.code ?? null, closeInfo?.signal ?? null)}`,
    );
  }

  try {
    process.kill(child.pid, 'SIGKILL');
  } catch (err) {
    const errno = err && typeof err === 'object' && 'code' in err ? String(err.code) : String(err);
    assert(false, `process.kill(SIGKILL) failed (${errno}); worker must be killable`);
  }

  const closeResult = await Promise.race([
    closePromise,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 5_000)),
  ]);

  if (closeResult && typeof closeResult === 'object' && 'timedOut' in closeResult && closeResult.timedOut) {
    assert(false, 'timeout waiting for worker close after SIGKILL (no exitCode/signal)');
  }

  const { code: exitCode, signal: exitSignal } = /** @type {{ code: number | null, signal: NodeJS.Signals | null }} */ (
    closeResult
  );
  assert(
    exitSignal === 'SIGKILL',
    `worker must terminate with SIGKILL; got ${formatExit(exitCode, exitSignal)}`,
  );

  // --- SQLite recovery only after verified SIGKILL ---
  const afterCrash = openHostDatabase(join(dataCrash, 'host.sqlite'));
  assert(afterCrash.ok, 'reopen after SIGKILL');
  const partial = afterCrash.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='crash_partial'`)
    .get();
  assert(!partial, 'uncommitted crash_partial must roll back after SIGKILL');
  assert(readSchemaVersion(afterCrash.db) === expectedVersion, 'committed catalog version must survive SIGKILL');
  const journalAfterCrash = afterCrash.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(journalAfterCrash === expectedJournal, `no duplicate journal after crash, got ${journalAfterCrash}`);
  afterCrash.db.close();

  const restartCrash = bootstrapHostPersistence({ dataDir: dataCrash, migrationsDir: migCrash });
  assert(restartCrash.ok, `restart after SIGKILL: ${restartCrash.ok ? '' : restartCrash.error}`);
  assert(restartCrash.schemaVersion === expectedVersion, 'schema version stable after crash recovery');
  const stillNoPartial = restartCrash.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='crash_partial'`)
    .get();
  assert(!stillNoPartial, 'partial table must stay absent after restart');
  restartCrash.db.close();

  console.log(`PASS: mig-011 SIGKILL crash-recovery (${formatExit(exitCode, exitSignal)})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
