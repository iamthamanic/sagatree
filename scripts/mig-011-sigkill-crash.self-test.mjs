#!/usr/bin/env node
/**
 * Real process-crash recovery for MIG-011 migrations (POSIX SIGKILL).
 * Location: scripts/mig-011-sigkill-crash.self-test.mjs
 *
 * Isolated from the main self-test so SIGKILL cannot leave unsettled
 * top-level awaits in the parent test-gate process.
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

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const { bootstrapHostPersistence, openHostDatabase, readSchemaVersion } = await import(persistenceUrl);
const catalogMigrations = join(root, 'server/migrations');
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
await new Promise(() => {});
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
      detached: true,
    },
  );
  if (child.pid == null) {
    console.error('FAIL: crash worker failed to spawn');
    process.exit(1);
  }

  let childErr = '';
  child.stderr.on('data', (d) => {
    childErr += d;
  });

  const deadline = Date.now() + 10_000;
  while (!existsSync(marker) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  assert(existsSync(marker), `crash worker never entered TX: ${childErr}`);

  process.kill(child.pid, 'SIGKILL');
  await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5_000);
    child.on('close', () => {
      clearTimeout(t);
      resolve(null);
    });
  });

  const afterCrash = openHostDatabase(join(dataCrash, 'host.sqlite'));
  assert(afterCrash.ok, 'reopen after SIGKILL');
  const partial = afterCrash.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='crash_partial'`)
    .get();
  assert(!partial, 'uncommitted crash_partial must roll back after SIGKILL');
  assert(readSchemaVersion(afterCrash.db) === 1, 'committed v1 must survive SIGKILL');
  const journalAfterCrash = afterCrash.db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert(journalAfterCrash === 1, `no duplicate journal after crash, got ${journalAfterCrash}`);
  afterCrash.db.close();

  const restartCrash = bootstrapHostPersistence({ dataDir: dataCrash, migrationsDir: migCrash });
  assert(restartCrash.ok, `restart after SIGKILL: ${restartCrash.ok ? '' : restartCrash.error}`);
  assert(restartCrash.schemaVersion === 1, 'schema version stable after crash recovery');
  const stillNoPartial = restartCrash.db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='crash_partial'`)
    .get();
  assert(!stillNoPartial, 'partial table must stay absent after restart');
  restartCrash.db.close();

  console.log('PASS: mig-011 SIGKILL crash-recovery');
} finally {
  rmSync(work, { recursive: true, force: true });
}
