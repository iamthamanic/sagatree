#!/usr/bin/env node
/**
 * CLI alias → restoreHostSnapshot (MIG-603).
 * Location: scripts/host-backup/restore-snapshot.mjs
 */
import { resolve } from 'node:path';
import { restoreHostSnapshot } from './lib.mjs';

function usage() {
  console.error(
    'Usage: node scripts/host-backup/restore-snapshot.mjs --snapshot <dir> --data-dir <dir>',
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

if (!opts.snapshot || !opts['data-dir']) usage();

const result = await restoreHostSnapshot({
  snapshotPath: resolve(opts.snapshot),
  targetDataDir: resolve(opts['data-dir']),
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
