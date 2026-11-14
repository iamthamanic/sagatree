#!/usr/bin/env node
/**
 * build-rulebook-index — generate src/domains/rulebook/generated/sagatree-core.json (AIB-01).
 * Location: scripts/build-rulebook-index.mjs
 *
 * Reads docs/sagatree core rules.md via the pure domain parser (esbuild bundle).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourcePath = join(root, 'docs', 'sagatree core rules.md');
const outPath = join(root, 'src', 'domains', 'rulebook', 'generated', 'sagatree-core.json');
const cacheDir = join(root, 'node_modules', '.cache', 'build-rulebook-index');
const esbuildCandidates = [
  join(root, 'node_modules', '.bin', 'esbuild'),
  join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
];
const esbuild = esbuildCandidates.find((p) => existsSync(p));
if (!esbuild) {
  console.error('esbuild not found — run npm install at repo root');
  process.exit(1);
}

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

// Host runtime bundle (AIB-04): Node can import search/evidence without Vite extensionless paths.
const hostRuntimePath = join(root, 'src', 'domains', 'rulebook', 'generated', 'host-runtime.mjs');
execFileSync(
  esbuild,
  [
    join(root, 'src/domains/rulebook/index.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--loader:.json=json',
    `--outfile=${hostRuntimePath}`,
  ],
  { stdio: 'inherit' },
);

// Package a copy under server/ so Dockerfile.host (server/src only) ships the runtime (Codex P1).
const hostPackagedPath = join(
  root,
  'server',
  'src',
  'modules',
  'ai',
  'internal',
  'generated',
  'host-runtime.mjs',
);
mkdirSync(dirname(hostPackagedPath), { recursive: true });
writeFileSync(hostPackagedPath, readFileSync(hostRuntimePath));

console.log(
  `Wrote ${outPath} (${index.manifest.sectionCount} sections, revision ${index.manifest.revisionHash.slice(0, 12)}…)`,
);
console.log(`Wrote ${hostRuntimePath}`);
console.log(`Wrote ${hostPackagedPath}`);
process.exit(0);
