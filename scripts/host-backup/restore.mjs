#!/usr/bin/env node
/**
 * CLI alias: restore published host snapshot (MIG-603 / #848).
 * Location: scripts/host-backup/restore.mjs
 */
import { resolve } from 'node:path';
import { restoreHostSnapshot } from './lib.mjs';

function usage() {
  console.error(
    'Usage: node scripts/host-backup/restore.mjs --snapshot <dir> --data-dir <target-data-dir>',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
/** @type {Record<string, string>} */
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--snapshot' || a === '--data-dir' || a === '--target') {
    opts[a.slice(2)] = args[++i] ?? '';
  } else {
    usage();
  }
}
const target = opts['data-dir'] || opts.target;
if (!opts.snapshot || !target) usage();

const result = await restoreHostSnapshot({
  snapshotPath: resolve(opts.snapshot),
  targetDataDir: resolve(target),
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
