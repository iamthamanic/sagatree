#!/usr/bin/env node
/**
 * atlas-worldbuilder-canonical-2d3d-check — bidirectional 2D↔3D bridge (#749).
 * Location: scripts/atlas-worldbuilder-canonical-2d3d-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-canonical-2d3d-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-followup-canonical-2d3d-edits.md', ['#749', 'ghost']);
mustInclude('src/domains/world/atlas/webgl-runtime-bridge.ts', [
  'STAMP_TO_PROP',
  'emptyWebglRuntime',
  'syncCanvasDocIntoWebglRuntime',
  'syncWebglPropsIntoCanvasDoc',
]);
mustInclude('src/domains/world/atlas/index.ts', [
  'emptyWebglRuntime',
  'syncCanvasDocIntoWebglRuntime',
  'STAMP_TO_PROP',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'syncCanvasDocIntoWebglRuntime',
  'emptyWebglRuntime',
  'controlledSeed',
  'handleWebglPersist',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-canonical-2d3d-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/webgl-runtime-bridge.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);

const emptyDoc = {
  format: 'sagatree-unified-atlas-v1',
  layers: {
    terrain: true,
    roads: true,
    region: true,
    city: true,
    interior: true,
    drawings: true,
    objects: true,
    grid: false,
  },
  strokes: [],
  objects: [],
  rooms: [],
  walls: [],
  demoSeed: false,
};

// 1) 2D add object → into runtime → back to doc same id
const docWithTable = {
  ...emptyDoc,
  objects: [{ id: 'o-table-1', type: 'tisch', x: 12, y: 34, size: 1.5, angle: 0.25 }],
};
const runtimeFromDoc = mod.syncCanvasDocIntoWebglRuntime(mod.emptyWebglRuntime(), docWithTable);
if (!runtimeFromDoc.props.some((p) => p && p.id === 'o-table-1' && p.type === 'table')) {
  fail('2D→WebGL did not project tisch→table with stable id');
}
const prop = runtimeFromDoc.props.find((p) => p.id === 'o-table-1');
if (!prop || prop.x !== 12 || prop.z !== 34 || prop.size !== 1.5 || prop.rotation !== 0.25) {
  fail('2D→WebGL lost x/y→x/z, size, or angle→rotation');
}
const backDoc = mod.syncWebglPropsIntoCanvasDoc(emptyDoc, runtimeFromDoc);
if (!backDoc.objects.some((o) => o.id === 'o-table-1' && o.type === 'tisch')) {
  fail('round-trip WebGL→2D lost stable id');
}
const backObj = backDoc.objects.find((o) => o.id === 'o-table-1');
if (!backObj || backObj.x !== 12 || backObj.y !== 34 || backObj.size !== 1.5 || backObj.angle !== 0.25) {
  fail('round-trip lost geometry');
}

// 2) WebGL last prop delete → doc.objects length 0
const runtimeEmptyProps = {
  ...runtimeFromDoc,
  props: [],
};
const cleared = mod.syncWebglPropsIntoCanvasDoc(docWithTable, runtimeEmptyProps);
if (cleared.objects.length !== 0) {
  fail(`empty props must clear objects, got length ${cleared.objects.length}`);
}

// 3) Round-trip no ghost: seed from cleared doc must not resurrect
const ghostCheck = mod.syncCanvasDocIntoWebglRuntime(runtimeFromDoc, cleared);
if (ghostCheck.props.length !== 0) {
  fail(`ghost props after clear: ${ghostCheck.props.length}`);
}
const remountDoc = mod.syncWebglPropsIntoCanvasDoc(cleared, ghostCheck);
if (remountDoc.objects.length !== 0) {
  fail('ghost objects after remount projection');
}

// Preserve non-geometry fields from prior runtime
const withNames = {
  ...mod.emptyWebglRuntime(),
  placeNames: { world: { label: 'Testwelt' } },
  context: 'welt',
};
const projected = mod.syncCanvasDocIntoWebglRuntime(withNames, docWithTable);
if (!projected.placeNames || projected.placeNames.world?.label !== 'Testwelt') {
  fail('syncCanvasDocIntoWebglRuntime must preserve placeNames');
}
if (projected.context !== 'welt') fail('must preserve context');

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-canonical-2d3d-check.mjs')) {
  fail('test-gate must invoke canonical-2d3d check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-canonical-2d3d-check: OK');
