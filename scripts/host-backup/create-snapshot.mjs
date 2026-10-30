#!/usr/bin/env node
/**
 * CLI alias → createHostSnapshot (MIG-603).
 * Location: scripts/host-backup/create-snapshot.mjs
 */
import { resolve } from 'node:path';
import { createHostSnapshot } from './lib.mjs';

function usage() {
  console.error(
    'Usage: node scripts/host-backup/create-snapshot.mjs --data-dir <dir> --backup-root <dir> [--host-version <v>] [--snapshot-id <id>]',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
/** @type {Record<string, string>} */
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  const key = args[i];
  if (!key.startsWith('--')) usage();
  const val = args[i + 1];
  if (!val || val.startsWith('--')) usage();
  opts[key.slice(2)] = val;
  i += 1;
}

if (!opts['data-dir'] || !opts['backup-root']) usage();

const result = await createHostSnapshot({
  dataDir: resolve(opts['data-dir']),
  backupRoot: resolve(opts['backup-root']),
  hostVersion: opts['host-version'],
  snapshotId: opts['snapshot-id'],
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
