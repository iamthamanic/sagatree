#!/usr/bin/env node
/**
 * mig-701-parity-window.self-test — dual-run read parity + rollback archive (#850).
 * Location: scripts/mig-701-parity-window.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
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
const cutoverUrl = pathToFileURL(join(root, 'server/src/migration/cutover/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const {
  seedDornhainParityAuthority,
  runDornhainParityWindowDrill,
  compareParitySnapshots,
  captureParitySnapshot,
} = await import(cutoverUrl);

function boot(label) {
  const work = mkdtempSync(join(tmpdir(), `mig701-${label}-`));
  const dataDir = join(work, 'data');
  mkdirSync(dataDir);
  const result = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(result.ok, `bootstrap ${label}`);
  return { work, dataDir, db: result.db };
}

const authority = boot('auth');
const shadow = boot('shadow');
const archiveDir = join(authority.work, 'parity-archive');
mkdirSync(archiveDir);

try {
  seedDornhainParityAuthority(authority.db, 'owner-dornhain', 42);

  // Unit: empty snapshots must never set shutdownPredecessorMet
  {
    const emptyReport = compareParitySnapshots([], [], 42);
    assert(emptyReport.shutdownPredecessorMet === false, 'empty×empty blocks shutdown');
    assert(
      emptyReport.discrepancies.some((d) => d.discrepancyKind === 'empty-snapshot'),
      'empty-snapshot discrepancy',
    );
  }

  // Unit: empty shadow vs seeded authority
  {
    let threw = false;
    try {
      captureParitySnapshot(shadow.db, 'owner-dornhain');
    } catch {
      threw = true;
    }
    assert(threw, 'shadow without revision meta must fail closed');
  }

  const report = runDornhainParityWindowDrill({
    authorityDb: authority.db,
    shadowDb: shadow.db,
    archiveDir,
    ownerUserId: 'owner-dornhain',
    responsibleDecision: 'self-test operator',
  });

  assert(report.clean.shutdownPredecessorMet === true, 'clean parity');
  assert(report.clean.shadowWroteBusinessState === false, 'clean is read-only');
  assert(report.clean.confirmedRevision === 42, 'same revision');
  assert(report.injected.shutdownPredecessorMet === false, 'injected blocks shutdown');
  assert(
    report.injected.discrepancies.some((d) => d.discrepancyKind === 'digest-mismatch'),
    'report names digest-mismatch',
  );
  for (const d of report.injected.discrepancies) {
    assert(d.recordId && d.kind && d.revision === 42, 'discrepancy identifies record/revision/kind');
    assert(d.recordKey && d.recordKey.includes(':'), 'composite recordKey kind:id');
  }
  assert(report.catalogIntactOnAuthority === true, 'Dornhain catalog intact on authority');
  assert(existsSync(report.rollback.archivePath), 'rollback archive written');
  const archive = JSON.parse(readFileSync(report.rollback.archivePath, 'utf8'));
  assert(archive.result === 'rollback-to-authority', 'archive result');
  assert(archive.responsibleDecision === 'self-test operator', 'archive decision');
  assert(archive.confirmedRevision === 42, 'archive revision');
  assert(archive.discrepancyCount >= 1, 'archive discrepancy count');
  assert(typeof archive.observationDurationMs === 'number', 'archive duration');

  console.log(
    `PASS: mig-701 parity window clean=${report.clean.authorityRecordCount} injected=${report.injected.discrepancies.length} archive=${report.rollback.archivePath}`,
  );
} finally {
  authority.db.close?.();
  shadow.db.close?.();
  rmSync(authority.work, { recursive: true, force: true });
  rmSync(shadow.work, { recursive: true, force: true });
}
