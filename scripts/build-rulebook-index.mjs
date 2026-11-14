#!/usr/bin/env node
/**
 * build-rulebook-index — generate src/domains/rulebook/generated/sagatree-core.json (AIB-01).
 * Location: scripts/build-rulebook-index.mjs
 *
 * Reads docs/sagatree core rules.md via the pure domain parser (esbuild bundle).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourcePath = join(root, 'docs', 'sagatree core rules.md');
const outPath = join(root, 'src', 'domains', 'rulebook', 'generated', 'sagatree-core.json');
const cacheDir = join(root, 'node_modules', '.cache', 'build-rulebook-index');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

function sha256Hex(payloadUtf8) {
  return createHash('sha256').update(payloadUtf8, 'utf8').digest('hex');
}

mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, 'parse-source.mjs');
execFileSync(
  esbuild,
  [
    join(root, 'src/domains/rulebook/parse-source.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundlePath}`,
  ],
  { stdio: 'inherit' },
);

const { buildRulebookIndexFromMarkdown } = await import(pathToFileURL(bundlePath).href);
const markdown = readFileSync(sourcePath, 'utf8');
const index = buildRulebookIndexFromMarkdown(markdown, sha256Hex);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${outPath} (${index.manifest.sectionCount} sections, revision ${index.manifest.revisionHash.slice(0, 12)}…)`,
);
process.exit(0);
