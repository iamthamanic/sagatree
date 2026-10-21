import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runChild } from './cluster.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export async function sourceEvidence() {
  const sources = [];
  for (const name of (await readdir(here)).sort()) {
    if (!/\.(?:mjs|ts|py)$/.test(name) && !['package.json', 'package-lock.json'].includes(name)) continue;
    sources.push({ path: `scripts/stack-migration-db/${name}`, sha256: createHash('sha256').update(await readFile(join(here, name))).digest('hex') });
  }
  return {
    repositoryHead: (await runChild('git', ['rev-parse', 'HEAD'], { cwd: join(here, '../..') })).trim(),
    node: process.version, platform: `${process.platform}-${process.arch}`, harnessSources: sources,
    scope: 'Repository HEAD identifies the checkout; hashes identify the executed working-tree harness and each SQL source separately.',
  };
}
