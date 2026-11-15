#!/usr/bin/env node
/**
 * ATL2-H02 — atlas documentation sync guards (#1235).
 * Location: scripts/atl2-h02-docs-sync.self-test.mjs
 *
 * One canonical ATL2 index that names the actually active renderer (Custom WebGL, ADR-ST-10),
 * links ATL3 as future work, cites only existing repo paths, and historical docs carry a
 * status banner instead of being rewritten.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const INDEX = 'docs/architecture/atlas-v2-architecture.md';
const index = read(INDEX);

// 1) Active architecture + history + future, in one place.
for (const needle of [
  'ADR-ST-10',
  'custom-webgl-prototype-runtime',
  'AtlasGL',
  'AtlasLite3D',
  'Canvas 2D',
  'NO-GO',
  'not_planned',
  'Three.js',
]) {
  assert.ok(index.includes(needle), `index mentions ${needle}`);
}
for (const issue of [1196, 1234, 1235, 1266, 1267, 1268, 1269, 1270, 1294, 1295, 1296, 1297, 1298, 1299, 1300, 1301]) {
  assert.ok(index.includes(`#${issue}`), `index links #${issue}`);
}
assert.ok(!/Three\.js\s+(?:is|ist)\s+(?:the\s+)?(?:productive|produktiv)/i.test(index), 'no Three.js-productive claim');

// 2) Every backticked repo path in the index exists (reproducible, no dead links).
const pathLike = /`((?:docs|src|server|scripts|e2e|\.qa)\/[^`\s]+?|AGENTS\.md)`/g;
const cited = [...index.matchAll(pathLike)].map((m) => m[1].replace(/\/$/, ''));
assert.ok(cited.length >= 30, `index cites repo paths (${cited.length})`);
const missing = cited.filter((p) => !p.includes('*') && !p.includes('<') && !existsSync(join(root, p)));
assert.deepEqual(missing, [], 'all cited paths exist');

// 3) Historical docs carry a banner pointing to the index (content preserved, not rewritten).
const BANNERED = [
  '.qa/design/world-atlas-editor.md',
  '.qa/acceptance/world-atlas-editor.md',
  '.qa/design/unified-atlas-2d-3d-editor.md',
  '.qa/acceptance/unified-atlas-2d-3d-editor.md',
  '.qa/research/unified-atlas-renderer-comparison.md',
  '.qa/design/atl2-renderer-architecture-audit.md',
  '.qa/design/atl2-d01-renderer-decision.md',
  '.qa/design/atl2-r01-reuse-matrix.md',
  '.qa/design/atl2-a01-parity-matrix.md',
];
for (const f of BANNERED) {
  const head = read(f).split('\n').slice(0, 6).join('\n');
  assert.ok(head.includes('Status (ATL2-H02 #1235'), `${f}: status banner`);
  assert.ok(head.includes(INDEX), `${f}: banner points to index`);
  assert.ok(index.includes(f) || f.startsWith('.qa/design/atl2-'), `${f}: listed in index`);
}
// ADR text itself is not rewritten (still states NO-GO decision).
assert.ok(read('docs/architecture/ADR-ST-10-atl2-r01-custom-webgl-product-sot.md').includes('**NO-GO (Option A).**'));

// 4) Agents are routed to the index; e2e runner forwards spec/project args.
assert.ok(read('AGENTS.md').includes(INDEX), 'AGENTS.md points Atlas work to the index');
assert.ok(
  read('scripts/browser-e2e-with-host.mjs').includes("'test', ...process.argv.slice(2)"),
  'test:e2e forwards Playwright args',
);
assert.ok(read('package.json').includes('"test:e2e": "node scripts/browser-e2e-with-host.mjs"'));

// 5) Golden data + gate checklist + acceptance + gate wiring.
for (const needle of ['dornhain.unified.v4', 'dornhain-golden-hierarchy-seed.ts', 'dornhain-golden-reset.ts', 'atl2-golden-visual-v1']) {
  assert.ok(index.includes(needle), `golden: ${needle}`);
}
for (const gate of ['| A |', '| B |', '| C |', '| D |', '| E |', '| F |', '| G |', '| H |']) {
  assert.ok(index.includes(gate), `certification row ${gate}`);
}
const acceptance = read('.qa/acceptance/atl2-h02.md');
assert.ok(acceptance.includes('ADR-ST-10') && acceptance.includes('#1296'));
assert.ok(read('scripts/test-gate.mjs').includes('scripts/atl2-h02-docs-sync.self-test.mjs'));

console.log(JSON.stringify({ ok: true, citedPaths: cited.length, bannered: BANNERED.length }));
console.log('atl2-h02-docs-sync self-test: PASS');
