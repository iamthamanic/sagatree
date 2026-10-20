#!/usr/bin/env node
/**
 * atlas-followup-real-product-e2e-check — Epic #746 closer (#755).
 * Location: scripts/atlas-followup-real-product-e2e-check.mjs
 *
 * Fails if follow-up issues lack CLEAR composition, product WebGL is still
 * demo-nav SoT, or browser-matrix is boolean-only screenshot theatre.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evid = join(root, '.qa/evidence/atlas-followup-real-product-e2e');

function fail(msg) {
  console.error(`atlas-followup-real-product-e2e-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
  return text;
}

const followups = [
  ['747', 'atlas-followup-webgl-db-tree'],
  ['748', 'atlas-followup-webgl-tree-actions'],
  ['749', 'atlas-followup-canonical-2d3d-edits'],
  ['750', 'atlas-followup-webgl-tool-registry'],
  ['751', 'atlas-followup-editor-durability'],
  ['752', 'atlas-followup-grounded-drilldown'],
  ['753', 'atlas-followup-real-donalu-inventory'],
  ['754', 'atlas-followup-donalu-backfill'],
];

for (const [num, slug] of followups) {
  mustInclude(`.qa/acceptance/${slug}.md`, [`#${num}`]);
  const rel = `.qa/runs/composition-gate-${slug}.md`;
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
  const comp = readFileSync(join(root, rel), 'utf8');
  const clear =
    /Verdict:\s*(CLEAR|SKIPPED)/i.test(comp) || /\*\*Status:\*\*\s*(CLEAR|SKIPPED)/i.test(comp);
  if (!clear) fail(`${slug} composition must be CLEAR or SKIPPED`);
}

mustInclude('.qa/acceptance/atlas-followup-real-product-e2e-gate.md', [
  '#755',
  'E2E_ATLAS_PRODUCT',
  'data-atlas-nav-source',
]);

mustInclude('e2e/atlas-followup-product-e2e-gate.spec.ts', [
  'data-atlas-controlled',
  'data-atlas-product-nav',
  'data-atlas-nav-source',
  'registry',
  'E2E_ATLAS_PRODUCT',
  'cross-owner',
]);

mustInclude('src/app/world/atlas/unified/AtlasNative3dEditor.tsx', [
  'externalNav',
  'webglToolChromeForKind',
  'mapSketchStatus',
]);

mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  "data-atlas-nav-source=\"'+(productNavActive()?'db':'demo')",
  'productNavActive()',
  'toolChrome',
  'isUnlocatedProductMap',
]);

// Deliberate disconnect detection: product host must still pass externalNav.
const host = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
if (!host.includes('externalNav:') && !host.includes('externalNavRef')) {
  fail('AtlasNative3dEditor must wire externalNav (DB tree)');
}
if (host.includes('demoSeed') && host.includes('NAV_CHILDREN')) {
  fail('product host must not reintroduce demo NAV_CHILDREN SoT');
}

const runtime = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
if (!runtime.includes("productNavActive()?'db':'demo'")) {
  fail('runtime must mark nav source db vs demo');
}

mustInclude('scripts/test-gate.mjs', ['atlas-followup-real-product-e2e-check.mjs']);
mustInclude('.qa/evidence/atlas-followup-donalu-backfill/PRODUCTION_GATE.md', ['NOT migrated']);

mkdirSync(evid, { recursive: true });

const matrixPath = join(evid, 'browser-matrix.json');
if (!existsSync(matrixPath)) {
  fail('missing browser-matrix.json evidence');
}
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
if (typeof matrix.assertions !== 'object' || matrix.assertions === null) {
  fail('browser-matrix must include assertions object (not boolean-only)');
}
const requiredAsserts = [
  'productNavSourceDb',
  'toolChromeFromRegistry',
  'controlledMount',
  'unlocatedEmptyOcean',
  'productionNotMigrated',
];
for (const key of requiredAsserts) {
  if (matrix.assertions[key] !== true) {
    fail(`browser-matrix.assertions.${key} must be true`);
  }
}
if (matrix.mode !== 'contract' && matrix.mode !== 'live') {
  fail('browser-matrix.mode must be contract|live');
}

mustInclude('.qa/evidence/atlas-followup-real-product-e2e/SECURITY.md', [
  'Severity: High',
  'Severity: Medium',
  'Severity: Low',
  'Severity: Info',
  'cross-owner',
]);

mustInclude('.qa/evidence/atlas-followup-real-product-e2e/REPORT.md', [
  '#755',
  'prod migrations not applied',
  'no legacy deletion',
]);

writeFileSync(
  join(evid, 'gate-proof.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      followups: followups.map(([n, s]) => ({ issue: n, slug: s })),
      productionMigrated: false,
      e2eSpec: 'e2e/atlas-followup-product-e2e-gate.spec.ts',
    },
    null,
    2,
  ) + '\n',
);

console.log('atlas-followup-real-product-e2e-check: OK');
