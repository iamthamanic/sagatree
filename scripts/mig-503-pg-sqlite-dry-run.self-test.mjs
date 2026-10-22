#!/usr/bin/env node
/**
 * mig-503-pg-sqlite-dry-run.self-test — synthetic PG→SQLite dry-run integrity.
 * Location: scripts/mig-503-pg-sqlite-dry-run.self-test.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
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

const migUrl = pathToFileURL(join(root, 'server/src/migration/postgres/index.ts')).href;
const boundaryUrl = pathToFileURL(join(root, 'scripts/architecture-boundary-check.mjs')).href;
const migrationsDir = join(root, 'server/migrations');

const {
  runPgSqliteDryRun,
  createSyntheticPostgresFixture,
  createFixtureWithUnmappedTable,
  mapPgValueToSqlite,
  PG_TO_SQLITE_TYPE_MAP,
  KNOWN_LEGACY_PERMISSION_DEVIATIONS,
  SYNTHETIC_SNAPSHOT_ID,
} = await import(migUrl);

const work = mkdtempSync(join(tmpdir(), 'mig503-'));

try {
  // --- Type mapping unit checks ---
  assert(PG_TO_SQLITE_TYPE_MAP.uuid === 'TEXT', 'uuid→TEXT');
  assert(PG_TO_SQLITE_TYPE_MAP.timestamptz === 'TEXT', 'timestamptz→TEXT');
  assert(PG_TO_SQLITE_TYPE_MAP.jsonb === 'TEXT', 'jsonb→TEXT');
  assert(PG_TO_SQLITE_TYPE_MAP.boolean === 'INTEGER', 'boolean→INTEGER');
  assert(mapPgValueToSqlite('boolean', true) === 1, 'boolean true→1');
  assert(mapPgValueToSqlite('boolean', false) === 0, 'boolean false→0');
  assert(
    mapPgValueToSqlite('timestamptz', '2026-10-21T12:00:00.000Z') === '2026-10-21T12:00:00.000Z',
    'timestamptz ISO',
  );
  assert(mapPgValueToSqlite('jsonb', { a: 1 }) === '{"a":1}', 'jsonb object→TEXT JSON');
  assert(mapPgValueToSqlite('uuid', '11111111-1111-4111-8111-111111111111').includes('1111'), 'uuid TEXT');

  // --- Fall 1: complete fixture → report with counts/checksums/mappings; FKs clean ---
  const dataOk = join(work, 'ok');
  mkdirSync(dataOk);
  const fixture = createSyntheticPostgresFixture();
  const report1 = runPgSqliteDryRun({
    dataDir: dataOk,
    migrationsDir,
    fixture,
  });
  assert(report1.ok, `happy path ok: ${report1.error}`);
  assert(report1.status === 'complete', `status complete got ${report1.status}`);
  assert(report1.snapshotId === SYNTHETIC_SNAPSHOT_ID, 'snapshot id');
  assert(report1.tables.length === 3, `expected 3 table reports got ${report1.tables.length}`);
  const byName = Object.fromEntries(report1.tables.map((t) => [t.name, t]));
  assert(byName.worlds.rowCount === 1, 'worlds count');
  assert(byName.projects.rowCount === 1, 'projects count');
  assert(byName.project_members.rowCount === 3, 'members count');
  assert(/^[a-f0-9]{64}$/.test(byName.worlds.checksumSha256), 'worlds checksum sha256');
  assert(
    byName.worlds.typeMappings.some((m) => m.column === 'id' && m.pgType === 'uuid' && m.sqliteType === 'TEXT'),
    'uuid mapping in report',
  );
  assert(
    byName.project_members.typeMappings.some(
      (m) => m.column === 'active' && m.pgType === 'boolean' && m.sqliteType === 'INTEGER',
    ),
    'boolean mapping in report',
  );
  assert(report1.fkErrors.length === 0, `fk errors: ${report1.fkErrors.join('; ')}`);
  assert(
    report1.deviations.some((d) => d.id === 'RPC-SEC-LEGACY-MAP-FLAG'),
    'legacy map deviation documented',
  );
  assert(
    report1.deviations.every((d) => d.importPolicy === 'document-only-no-production-import'),
    'deviations are document-only',
  );
  assert(KNOWN_LEGACY_PERMISSION_DEVIATIONS.length >= 1, 'deviations catalog non-empty');

  const proj = report1.ownerProjection;
  assert(proj, 'owner projection present');
  assert(proj.worldOwnerMatches, 'world owner');
  assert(proj.projectGmMatches, 'project gm');
  assert(proj.strangerHasNoMembership, 'stranger isolated');
  assert(proj.secretLabelDocumentedOnly, 'secret not persisted as production row');

  // --- Incomplete mapping fails closed ---
  const dataUnmapped = join(work, 'unmapped');
  mkdirSync(dataUnmapped);
  const blocked = runPgSqliteDryRun({
    dataDir: dataUnmapped,
    migrationsDir,
    fixture: createFixtureWithUnmappedTable(),
  });
  assert(!blocked.ok, 'unmapped must fail');
  assert(blocked.status === 'blocked_unmapped', `got ${blocked.status}`);
  assert(blocked.unmappedTables.includes('legacy_secret_notes'), 'lists unmapped table');
  assert(!existsSync(join(dataUnmapped, 'host.sqlite')), 'must not create target on blocked map');

  // --- Fall 2: abort mid-transfer → rolled back; retry succeeds without duplicates ---
  const dataAbort = join(work, 'abort');
  mkdirSync(dataAbort);
  const aborted = runPgSqliteDryRun({
    dataDir: dataAbort,
    migrationsDir,
    fixture,
    abortAfterRows: 1,
  });
  assert(!aborted.ok, 'abort must fail');
  assert(aborted.status === 'rolled_back', `got ${aborted.status}`);
  assert(
    aborted.tables.every((t) => t.rowCount === 0),
    'all mapped tables empty after rollback',
  );
  const incompleteMeta = JSON.parse(readFileSync(join(dataAbort, 'mig503-dry-run-meta.json'), 'utf8'));
  assert(incompleteMeta.status === 'incomplete', 'incomplete run isolated in meta');

  const retry = runPgSqliteDryRun({
    dataDir: dataAbort,
    migrationsDir,
    fixture,
  });
  assert(retry.ok, `retry after abort: ${retry.error}`);
  assert(retry.tables.find((t) => t.name === 'worlds')?.rowCount === 1, 'retry worlds=1');
  assert(retry.tables.find((t) => t.name === 'project_members')?.rowCount === 3, 'retry members=3');

  // Second successful run (idempotent) — same counts, no duplicate IDs
  const again = runPgSqliteDryRun({
    dataDir: dataAbort,
    migrationsDir,
    fixture,
  });
  assert(again.ok, `idempotent re-run: ${again.error}`);
  assert(again.tables.find((t) => t.name === 'worlds')?.rowCount === 1, 'idempotent worlds=1');
  assert(
    again.tables.find((t) => t.name === 'project_members')?.rowCount === 3,
    'idempotent members=3',
  );
  assert(
    again.tables.find((t) => t.name === 'worlds')?.checksumSha256 ===
      retry.tables.find((t) => t.name === 'worlds')?.checksumSha256,
    'checksum stable across idempotent re-run',
  );

  // --- Architecture boundary ---
  const { checkRegisteredHostPackages } = await import(boundaryUrl);
  const violations = checkRegisteredHostPackages(root);
  assert(violations.length === 0, `boundary: ${JSON.stringify(violations)}`);

  // --- CLI dry-run script exits 0 ---
  const cli = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/mig-503-pg-sqlite-dry-run.mjs', '--self-check'],
    { cwd: root, encoding: 'utf8' },
  );
  assert(cli.status === 0, `CLI self-check failed: ${cli.stderr || cli.stdout}`);

  console.log('mig-503-pg-sqlite-dry-run.self-test: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}
