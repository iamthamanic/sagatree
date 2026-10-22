#!/usr/bin/env node
/**
 * mig-503-pg-sqlite-dry-run — CLI for synthetic Postgres→SQLite dry-run (#844).
 * Location: scripts/mig-503-pg-sqlite-dry-run.mjs
 *
 * Defaults to an isolated temp dataDir. Never connects to production Postgres.
 * Usage:
 *   node --experimental-strip-types scripts/mig-503-pg-sqlite-dry-run.mjs
 *   node --experimental-strip-types scripts/mig-503-pg-sqlite-dry-run.mjs --self-check
 *   node --experimental-strip-types scripts/mig-503-pg-sqlite-dry-run.mjs --data-dir /tmp/mig503
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function parseArgs(argv) {
  /** @type {{ selfCheck: boolean; dataDir: string | null }} */
  const out = { selfCheck: false, dataDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-check') out.selfCheck = true;
    else if (arg === '--data-dir') {
      out.dataDir = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: mig-503-pg-sqlite-dry-run [--data-dir DIR] [--self-check]`);
      process.exit(0);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const migUrl = pathToFileURL(join(root, 'server/src/migration/postgres/index.ts')).href;
const { runPgSqliteDryRun, createSyntheticPostgresFixture } = await import(migUrl);

const dataDir = args.dataDir ?? mkdtempSync(join(tmpdir(), 'mig503-cli-'));
mkdirSync(dataDir, { recursive: true });

const report = runPgSqliteDryRun({
  dataDir,
  migrationsDir: join(root, 'server/migrations'),
  fixture: createSyntheticPostgresFixture(),
});

const outPath = join(dataDir, 'mig503-dry-run-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

if (!report.ok) {
  console.error(`mig-503 dry-run FAILED (${report.status}): ${report.error}`);
  console.error(`report: ${outPath}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      snapshotId: report.snapshotId,
      status: report.status,
      tables: report.tables.map((t) => ({
        name: t.name,
        rowCount: t.rowCount,
        checksumSha256: t.checksumSha256,
      })),
      deviations: report.deviations.map((d) => d.id),
      reportPath: outPath,
      dataDir,
      selfCheck: args.selfCheck,
    },
    null,
    2,
  ),
);
