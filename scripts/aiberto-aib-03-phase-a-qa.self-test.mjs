#!/usr/bin/env node
/**
 * AIB-03 self-test — Phase-A QA structural + offline search perf (T-005/T-011/NFR-001).
 * Location: scripts/aiberto-aib-03-phase-a-qa.self-test.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-03');
mkdirSync(outdir, { recursive: true });

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('AIB-03: Phase-A QA structural checks…');

check(existsSync(join(root, 'e2e/aiberto-phase-a.spec.ts')), 'e2e aiberto-phase-a.spec.ts present');
check(
  existsSync(join(root, '.qa/acceptance/aiberto-aib-03-phase-a-qa.md')),
  'acceptance aiberto-aib-03-phase-a-qa.md',
);
check(
  existsSync(join(root, '.qa/runs/composition-gate-aiberto-aib-03-phase-a-qa.md')),
  'composition proof present',
);

const e2e = read('e2e/aiberto-phase-a.spec.ts');
check(/data-aiberto-search/.test(e2e), 'e2e covers search');
check(/data-aiberto-orc-notice/.test(e2e), 'e2e asserts ORC notice');
check(/320/.test(e2e), 'e2e covers 320px');
check(/Bibliothek|Home/.test(e2e), 'e2e asserts shell chrome still reachable');

const pw = read('playwright.config.ts');
check(/aiberto-phase-a/.test(pw), 'mobile/tablet testMatch includes aiberto-phase-a');

const companion = read('src/app/ai-assistant/AibertoCompanion.tsx');
const layout = read('src/app/shell/Layout.tsx');
check(/AibertoCompanion/.test(layout), 'Layout still mounts companion');
check(!/lucide-react/.test(companion + e2e), 'no lucide');

// NFR-001: offline search latency budget (pure domain, no Host)
console.log('AIB-03: NFR-001 offline searchRulebook latency…');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
execFileSync(
  esbuild,
  [
    join(root, 'src/domains/rulebook/index.ts'),
    '--bundle',
    '--platform=neutral',
    '--format=esm',
    `--outfile=${join(outdir, 'rulebook.mjs')}`,
  ],
  { stdio: 'pipe' },
);
const rb = await import(pathToFileURL(join(outdir, 'rulebook.mjs')).href);
const index = rb.getSagaTreeCoreRulebookIndex();
const queries = ['Kampf', 'Erfahrung', 'Fertigkeit', 'Attribute', 'zzzz-no-hit'];
const samples = [];
for (const q of queries) {
  const t0 = performance.now();
  for (let i = 0; i < 50; i += 1) rb.searchRulebook(index, q, { limit: 20 });
  samples.push((performance.now() - t0) / 50);
}
const p95 = [...samples].sort((a, b) => a - b)[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
// Local/CI budget: < 25ms mean per query on Node (document; not wall-clock UI)
check(p95 < 25, `NFR-001 search p95 < 25ms (got ${p95.toFixed(2)}ms)`);
console.log(`AIB-03 NFR-001 search latency samples(ms)=${samples.map((n) => n.toFixed(2)).join(',')} p95=${p95.toFixed(2)}`);

console.log('AIB-03 Phase-A QA self-test passed.');
