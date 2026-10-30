#!/usr/bin/env node
/**
 * CLI: update/rollback drill with measured report (MIG-603 / #848).
 * Location: scripts/host-backup/rollback-drill.mjs
 *
 * Usage:
 *   node scripts/host-backup/rollback-drill.mjs \
 *     --data-dir <path> --backup-root <path> [--host-version <ver>]
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runRollbackDrill } from './lib.mjs';

function usage() {
  console.error(
    'Usage: node scripts/host-backup/rollback-drill.mjs --data-dir <path> --backup-root <dir> [--host-version <ver>]',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
/** @type {Record<string, string>} */
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--data-dir' || a === '--backup-root' || a === '--host-version') {
    opts[a.slice(2)] = args[++i] ?? '';
  } else {
    usage();
  }
}
if (!opts['data-dir'] || !opts['backup-root']) usage();

const result = await runRollbackDrill({
  dataDir: resolve(opts['data-dir']),
  backupRoot: resolve(opts['backup-root']),
  hostVersion: opts['host-version'] || 'drill',
  mutate(dir) {
    writeFileSync(join(dir, 'host.sqlite'), Buffer.from('NOT-A-SQLITE-FILE'));
  },
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

const reportPath = join(resolve(opts['backup-root']), 'RESTORE-DRILL-REPORT.md');
writeFileSync(
  reportPath,
  [
    '# RESTORE-DRILL-REPORT',
    '',
    `- measuredDurationMs: ${result.report.measuredDurationMs}`,
    `- writeLockHeldMs: ${result.report.writeLockHeldMs}`,
    `- schemaVersion: ${result.report.schemaVersion}`,
    `- hostVersion: ${result.report.hostVersion}`,
    `- snapshotId: ${result.report.snapshotId}`,
    '',
  ].join('\n'),
);

console.log(JSON.stringify({ ok: true, reportPath, ...result }, null, 2));
