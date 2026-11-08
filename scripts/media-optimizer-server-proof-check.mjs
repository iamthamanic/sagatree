#!/usr/bin/env node
/**
 * media-optimizer-server-proof-check — Deno WASM/CPU proof for #645.
 * Location: scripts/media-optimizer-server-proof-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  'archive/supabase-legacy/supabase/functions/_shared/media-server-optimize-proof.ts',
  'archive/supabase-legacy/supabase/functions/_shared/media-server-optimize-proof.proof.ts',
  'docs/media-optimizer-server-decision.md',
  'docs/media-optimizer-server-proof.md',
];
for (const p of paths) check(existsSync(join(root, p)), `exists ${p}`);

const proof = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/_shared/media-server-optimize-proof.ts'), 'utf8');
const decisionDoc = readFileSync(join(root, 'docs/media-optimizer-server-decision.md'), 'utf8');
check(
  /Deno Edge runtime|#645|#647|quality ladder/i.test(proof),
  'proof module identity marker',
);
check(/deno-adapter|dedicated-worker|not-viable/.test(decisionDoc), 'decision enum in docs');
check(/Storage|Auth/i.test(decisionDoc), 'docs mention Storage/Auth unchanged');
check(!/from ['"].*storage|from ['"].*auth/i.test(proof), 'no Storage/Auth imports in proof');

section('2 · Deno proof tests');
mkdirSync(join(root, '.qa/runs'), { recursive: true });
const denoAvailable = spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
let deno = { status: null, stdout: '', stderr: '' };
if (!denoAvailable) {
  // CUT-21: Deno is not a product runtime; archived Edge proofs are evidence-only.
  console.log('SKIP: Deno binary absent — archive media-server-optimize proof not executed (CUT-21)');
} else {
  deno = spawnSync(
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
      'archive/supabase-legacy/supabase/functions/_shared/media-server-optimize-proof.proof.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (deno.status !== 0) {
    console.error(deno.stdout);
    console.error(deno.stderr);
  }
  check(deno.status === 0, 'deno server optimize proof tests passed');
}
section('3 · decision + metrics snapshot');
// Parse decision from docs (authoritative after human/CI review of proof run).
const decisionMatch = decisionDoc.match(
  /\*\*Decision:\*\*\s*`?(deno-adapter|dedicated-worker|not-viable)`?/i,
);
check(Boolean(decisionMatch), 'Decision line in media-optimizer-server-decision.md');
const decision = decisionMatch?.[1]?.toLowerCase() ?? '';
check(
  ['deno-adapter', 'dedicated-worker', 'not-viable'].includes(decision),
  `decision=${decision}`,
);

const metricsPath = join(root, '.qa/runs/media-opt-server-proof-metrics.json');
const metrics = {
  decision,
  runtime: denoAvailable ? 'deno' : 'archive-skip-cut-21',
  generatedAt: new Date().toISOString(),
  notesDe: [
    'Produktive Storage-/Auth-Services wurden in diesem Proof nicht verändert.',
    denoAvailable
      ? 'Metriken stammen aus dem Deno-Testlauf (stdout summary + decision doc).'
      : 'CUT-21: Deno nicht vorhanden — Decision-Doc bleibt autoritativ; Edge-Proof nur Archiv.',
  ],
  denoExitCode: deno.status,
};
writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
check(existsSync(metricsPath), 'metrics json written');

section('4 · typed-strict');
const codeOnly = proof.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check(!/\bany\b/.test(codeOnly), 'no any');
check(!/\bas\s+unknown\b/.test(codeOnly), 'no as unknown');

if (failures > 0) {
  console.error(`\nmedia-optimizer-server-proof-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`media-optimizer-server-proof-check: OK (decision=${decision})`);
