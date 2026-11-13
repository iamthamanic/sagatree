#!/usr/bin/env node
/**
 * ATL2-D01 — Renderer comparison + productive 3D target decision.
 * Location: scripts/atl2-d01-renderer-decision.self-test.mjs
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d01.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d01-renderer-decision.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const spatialSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasSpatialViewport.tsx'),
  'utf8',
);
const nativeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
const pocResearch = readFileSync(
  join(root, '.qa/research/unified-atlas-renderer-comparison.md'),
  'utf8',
);
const pocResults = JSON.parse(
  readFileSync(join(root, '.qa/evidence/unified-atlas-renderer-poc/results.json'), 'utf8'),
);

assert.ok(acceptance.includes('atl2-d01'));
assert.ok(gate.includes('atl2-d01-renderer-decision.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_PRODUCT_3D_TARGET'));
assert.ok(design.includes('custom-webgl-prototype-runtime'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(target.ATLAS_RENDERER_DECISION.target, 'custom-webgl-prototype-runtime');
assert.equal(target.isProductAtlasRendererTarget('custom-webgl-prototype-runtime'), true);
assert.equal(target.isProductAtlasRendererTarget('three-spatial-viewport'), false);

assert.ok(editorSrc.includes('AtlasNative3dEditor'));
assert.ok(!editorSrc.includes('AtlasSpatialViewport'));
assert.ok(nativeSrc.includes('mountAtlasPrototype3d'));
assert.ok(runtimeSrc.includes('class AtlasGL'));
assert.ok(runtimeSrc.includes('class AtlasLite3D'));
assert.ok(runtimeSrc.includes('activate3D'));
assert.ok(spatialSrc.includes("import * as THREE from 'three'"));

// Golden parity: canvas → webgl → canvas
const golden = starter.buildDornhainUnifiedCanvasDoc();
const before = {
  objects: golden.objects.length,
  rooms: golden.rooms.length,
  walls: golden.walls.length,
  strokes: golden.strokes.length,
  objectIds: golden.objects.map((o) => o.id).sort(),
};
assert.ok(before.objects >= 1 && before.rooms >= 1 && before.strokes >= 1);

const t0 = performance.now();
const seeded = bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), golden);
const round = bridge.syncWebglPropsIntoCanvasDoc(canvas.emptyUnifiedCanvasDoc(false), seeded);
const bridgeMs = performance.now() - t0;

assert.equal(round.objects.length, before.objects, 'object count');
assert.equal(round.rooms.length, before.rooms, 'room count');
assert.equal(round.walls.length, before.walls, 'wall count');
assert.equal(round.strokes.length, before.strokes, 'stroke count');
assert.deepEqual(
  round.objects.map((o) => o.id).sort(),
  before.objectIds,
  'object ids preserved',
);

// Graphics presets
const high = target.resolveAtlasGraphicsPreset('high');
const lite = target.resolveAtlasGraphicsPreset('lite');
assert.equal(high.maxPixelRatio, 2);
assert.equal(lite.preferSoftwareFallback, true);
assert.equal(target.clampAtlasPixelRatio(3, high), 2);
assert.equal(target.clampAtlasPixelRatio(0.8, lite), 0.8);

// Historical PoC still archived (Hybrid vs Unified Three) — informational only
assert.ok(pocResearch.includes('Adopt Variant A'));
assert.ok(pocResults.variants && typeof pocResults.variants === 'object');

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const evidence = {
  gate: 'atl2-d01',
  issue: 1212,
  head,
  verdict: 'CLEAR',
  target: target.ATLAS_PRODUCT_3D_TARGET,
  golden: before,
  bridgeMs: Number(bridgeMs.toFixed(3)),
  presets: target.ATLAS_GRAPHICS_PRESETS.map((p) => p.id),
  productChrome: {
    native3d: true,
    spatialViewportImported: false,
    atlasGl: true,
    atlasLite3d: true,
  },
  historicalPoc: {
    research: '.qa/research/unified-atlas-renderer-comparison.md',
    note: 'Hybrid vs Unified-Three PoC retained; does not override live custom-WebGL product path.',
  },
  residuals: [
    {
      severity: 'Low',
      item: 'Interactive FPS/draw-call soak on device matrix',
      note: 'Structural Lite3D + preset contracts locked; device soak deferred to Gate D / #1218.',
      blocksGate: false,
    },
  ],
};

const report = `# ATL2-D01 — Renderer decision

- Issue: #1212
- HEAD: \`${evidence.head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## Decision

- **Target:** \`${evidence.target}\`
- Product host: \`AtlasNative3dEditor\` → \`atlas-prototype-runtime.mjs\`
- Parallel Three \`AtlasSpatialViewport\`: inventory only (not mounted in product chrome)

## Golden bridge parity

- objects/rooms/walls/strokes: **${before.objects}/${before.rooms}/${before.walls}/${before.strokes}**
- ID-preserving canvas→webgl→canvas: **yes**
- Bridge wall-clock: **${evidence.bridgeMs} ms**

## Graphics presets

| Preset | Locked |
|--------|--------|
${evidence.presets.map((id) => `| ${id} | yes |`).join('\n')}

## Historical PoC

- Archived Hybrid vs Unified-Three comparison retained under research/
- Does **not** reopen a second product engine

## Residuals

${evidence.residuals.map((r) => `- **${r.severity}**: ${r.item} — ${r.note}`).join('\n')}

## Decision line

Phase D hardens **${evidence.target}**. SpatialViewport retirement tracked for cleanup (#1234 / Gate H).
`;

const writeEvidence = process.env.ATL2_D01_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-d01-out-'));
writeFileSync(join(outDir, 'atl2-d01-renderer-decision.md'), report);
writeFileSync(join(outDir, 'atl2-d01-renderer-decision.json'), JSON.stringify(evidence, null, 2));

const committedPath = join(root, '.qa/runs/atl2-d01-renderer-decision.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /custom-webgl-prototype-runtime/);
} else {
  assert.equal(writeEvidence, true, 'seed evidence with ATL2_D01_WRITE_EVIDENCE=1');
}

console.log(`atl2-d01-renderer-decision self-test: PASS (${evidence.verdict})`);
console.log(`report: ${join(outDir, 'atl2-d01-renderer-decision.md')}${writeEvidence ? '' : ' (transient)'}`);
