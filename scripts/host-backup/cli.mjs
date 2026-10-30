#!/usr/bin/env node
/**
 * Host backup CLI (MIG-603) — create / verify / restore / rollback-drill.
 * Location: scripts/host-backup/cli.mjs
 *
 * Usage:
 *   node scripts/host-backup/cli.mjs create --data-dir <path> --backup-root <path>
 *   node scripts/host-backup/cli.mjs verify --snapshot <path>
 *   node scripts/host-backup/cli.mjs restore --snapshot <path> --data-dir <path>
 *   node scripts/host-backup/cli.mjs rollback-drill --data-dir <path> --backup-root <path>
 */
import {
  createHostSnapshot,
  restoreHostSnapshot,
  runRollbackDrill,
  verifySnapshot,
} from './lib.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function usage() {
  console.error(`Usage:
  node scripts/host-backup/cli.mjs create --data-dir <dir> --backup-root <dir> [--host-version <v>] [--snapshot-id <id>]
  node scripts/host-backup/cli.mjs verify --snapshot <dir>
  node scripts/host-backup/cli.mjs restore --snapshot <dir> --data-dir <dir>
  node scripts/host-backup/cli.mjs rollback-drill --data-dir <dir> --backup-root <dir> [--host-version <v>]
`);
  process.exit(2);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--') && i + 1 < argv.length) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '-h' || cmd === '--help') usage();
const args = parseArgs(rest);

try {
  if (cmd === 'create') {
    if (!args['data-dir'] || !args['backup-root']) usage();
    const result = await createHostSnapshot({
      dataDir: args['data-dir'],
      backupRoot: args['backup-root'],
      hostVersion: args['host-version'],
      snapshotId: args['snapshot-id'],
    });
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'verify') {
    if (!args.snapshot) usage();
    const result = await verifySnapshot(args.snapshot);
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'restore') {
    if (!args.snapshot || !args['data-dir']) usage();
    const result = await restoreHostSnapshot({
      snapshotPath: args.snapshot,
      targetDataDir: args['data-dir'],
    });
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'rollback-drill') {
    if (!args['data-dir'] || !args['backup-root']) usage();
    const result = await runRollbackDrill({
      dataDir: args['data-dir'],
      backupRoot: args['backup-root'],
      hostVersion: args['host-version'] ?? 'drill',
      mutate(dir) {
        writeFileSync(join(dir, 'host.sqlite'), Buffer.from('NOT-A-SQLITE-FILE'));
      },
    });
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    const reportPath = join(args['backup-root'], 'RESTORE-DRILL-REPORT.md');
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
    console.log(JSON.stringify({ ...result, reportPath }, null, 2));
  } else {
    usage();
  }
} catch (err) {
  console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
