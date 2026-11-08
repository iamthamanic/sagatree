#!/usr/bin/env node
/**
 * media-optimizer-provider-output-check — Meshy persist optimize (#647).
 * Location: scripts/media-optimizer-provider-output-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

section('1 · files');
const paths = [
  'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize.ts',
  'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize_test.ts',
  'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize.proof.ts',
  'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts',
  'docs/media-optimizer-server-decision.md',
  '.qa/acceptance/media-opt-provider-output.md',
];
for (const p of paths) check(existsSync(join(root, p)), `exists ${p}`);

const edge = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts'), 'utf8');
const adapter = readFileSync(
  join(root, 'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize.ts'),
  'utf8',
);
const decision = readFileSync(join(root, 'docs/media-optimizer-server-decision.md'), 'utf8');

check(/optimizeProviderThumbnailBytes/.test(edge), 'Edge wires provider optimize');
check(/downloadMeshyImageBytes/.test(edge), 'SSRF download retained');
check(/!optimized\.ok/.test(edge) || /optimized\.ok === false/.test(edge), 'fail-closed on optimize');
check(/status:\s*'failed'/.test(edge), 'job failed on optimize error');
check(/assertCanMutateDefinition/.test(edge), 'owner AuthZ retained');
check(/deno-adapter/.test(decision), 'proof decision is deno-adapter');
check(/ITEM_THUMBNAIL_SERVER_OPTIMIZE/.test(adapter), 'item-thumbnail budgets');
check(/validateThumbnailBytes/.test(adapter), 'post-encode magic validation');

section('2 · unit tests (no WASM encode)');
const denoAvailable = spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
if (!denoAvailable) {
  console.log('SKIP: Deno binary absent — archive raster optimize unit/proof not executed (CUT-21)');
} else {
  const unit = spawnSync(
    'deno',
    [
      'test',
      '--no-lock',
      '--node-modules-dir=auto',
      '--allow-read',
      '--allow-net',
      '--allow-env',
      'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize_test.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (unit.status !== 0) {
    console.error(unit.stdout);
    console.error(unit.stderr);
  }
  check(unit.status === 0, 'unit tests passed');

  section('3 · WASM provider optimize proof');
  const proof = spawnSync(
    'deno',
    [
      'test',
      '--no-lock',
      '--node-modules-dir=auto',
      '--allow-read',
      '--allow-write',
      '--allow-net',
      '--allow-env',
      '--allow-sys',
      'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize.proof.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (proof.status !== 0) {
    console.error(proof.stdout);
    console.error(proof.stderr);
  }
  check(proof.status === 0, 'provider optimize WASM proof passed');
}
section('4 · typed-strict');
const codeOnly = adapter.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check(!/\bany\b/.test(codeOnly), 'no any');
check(!/\bas\s+unknown\b/.test(codeOnly), 'no as unknown');

if (failures > 0) {
  console.error(`\nmedia-optimizer-provider-output-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('media-optimizer-provider-output-check: OK');
