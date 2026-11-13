#!/usr/bin/env node
/**
 * ATL2-D04 — Editable heightfield chunk + brushes.
 * Location: scripts/atl2-d04-heightfield.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const hf = jiti(join(root, 'src/domains/world/atlas/atlas-heightfield.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const tools = jiti(join(root, 'src/domains/world/atlas/atlas-tool-registry.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const plan = jiti(join(root, 'src/domains/world/atlas/atlas-product-geometry-plan.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d04.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d04-heightfield.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-d04'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(design.includes('UnifiedCanvasDoc.heightfield'));
assert.ok(gate.includes('atl2-d04-heightfield.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_HEIGHTFIELD_FORMAT'));
assert.ok(runtimeSrc.includes('product_heightfield'));
assert.ok(runtimeSrc.includes("runtimeId:'height'") || runtimeSrc.includes('tool===\'height\''));
assert.ok(editorSrc.includes('height: Mountains') || editorSrc.includes("id: 'height'"));
assert.ok(editorSrc.includes('workingDoc.heightfield') || editorSrc.includes('ATL2-D04'));
assert.ok(tools.isAtlasToolAllowed('height', null));
const classified = jiti(join(root, 'src/domains/world/atlas/atlas-canonical-features.ts'));

const empty = hf.emptyAtlasHeightfield({ cols: 8, rows: 8, cellSize: 10 });
assert.equal(empty.heights.length, 64);
assert.equal(hf.parseAtlasHeightfield(null), null);
assert.equal(hf.parseAtlasHeightfield({ format: 'nope' }), null);

const full = hf.emptyAtlasHeightfield();
assert.equal(full.originX, 0);
assert.equal(full.originZ, 0);
assert.ok(full.cols * full.cellSize >= hf.ATLAS_HEIGHTFIELD_MAP_EXTENT - 1e-6);

const raised = hf.applyHeightBrush(empty, {
  mode: 'raise',
  x: empty.originX + 40,
  z: empty.originZ + 40,
  radius: 25,
  strength: 3,
});
assert.ok(raised.heights.some((h) => h > 0.5));
assert.ok(raised.assetRef.version > empty.assetRef.version);

const wet = hf.emptyAtlasHeightfield({
  cols: 4,
  rows: 4,
  cellSize: 10,
  waterLevel: 0,
  heights: Array.from({ length: 16 }, () => -2),
});
const tryRaiseLand = hf.applyHeightBrush(wet, {
  mode: 'raise',
  x: wet.originX + 20,
  z: wet.originZ + 20,
  radius: 40,
  strength: 10,
});
assert.ok(tryRaiseLand.heights.every((h) => h < wet.waterLevel));

const smoothed = hf.applyHeightBrush(raised, {
  mode: 'smooth',
  x: empty.originX + 40,
  z: empty.originZ + 40,
  radius: 30,
  strength: 1,
});
assert.ok(smoothed.heights.every((h) => h >= hf.ATLAS_HEIGHT_MIN && h <= hf.ATLAS_HEIGHT_MAX));

const cleared = hf.clearAtlasHeightfield(raised);
assert.ok(cleared.heights.every((h) => h === 0));

const bad = hf.parseAtlasHeightfield({
  ...hf.serializeAtlasHeightfield(empty),
  heights: Array.from({ length: 64 }, () => 9999),
});
assert.equal(bad, null);

const doc0 = canvas.emptyUnifiedCanvasDoc(false);
const roomsBefore = doc0.rooms.length;
const withHill = ops.applyMapEdit(doc0, {
  op: 'paint_heightfield',
  stroke: {
    mode: 'raise',
    x: 500,
    z: 500,
    radius: 40,
    strength: 2,
  },
});
assert.ok(withHill.heightfield);
assert.equal(withHill.rooms.length, roomsBefore);
const roundTrip = canvas.parseUnifiedCanvasDoc(canvas.serializeUnifiedCanvasDoc(withHill));
assert.ok(roundTrip?.heightfield);
assert.equal(roundTrip.heightfield.heights.length, withHill.heightfield.heights.length);
const cat = classified.classifyUnifiedCanvasDoc(withHill, { scale: 'world' });
assert.ok(cat.counts.heightfield >= 1);

const legacy = canvas.parseUnifiedCanvasDoc({
  format: canvas.UNIFIED_CANVAS_FORMAT,
  layers: canvas.defaultUnifiedCanvasLayers(),
  strokes: [],
  objects: [],
  rooms: [],
  walls: [],
  heightfield: { format: 'broken' },
});
assert.ok(legacy);
assert.equal(legacy.heightfield, undefined);

const seed = bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), withHill);
assert.ok(seed.heightfield);
const back = bridge.syncWebglPropsIntoCanvasDoc(doc0, seed);
assert.ok(back.heightfield);

const g = plan.buildAtlasProductGeometryPlan(withHill);
assert.ok(g.contentFingerprint.includes('hf:'));
assert.ok(hf.heightfieldMeshTriangles(withHill.heightfield).length > 0);

const writeEvidence = process.env.ATL2_D04_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-d04-out-'));

const report = `# ATL2-D04 heightfield

- Verdict: CLEAR
- Format: ${hf.ATLAS_HEIGHTFIELD_FORMAT}
- Brush modes: raise / lower / smooth / flatten
- Runtime mesh: product_heightfield
`;

writeFileSync(join(outDir, 'atl2-d04-heightfield.md'), report);
writeFileSync(
  join(outDir, 'atl2-d04-heightfield.json'),
  JSON.stringify(
    {
      verdict: 'CLEAR',
      format: hf.ATLAS_HEIGHTFIELD_FORMAT,
      version: hf.ATLAS_HEIGHTFIELD_VERSION,
    },
    null,
    2,
  ),
);

console.log('atl2-d04-heightfield self-test: PASS (CLEAR)');
console.log(
  `report: ${join(outDir, 'atl2-d04-heightfield.md')}${writeEvidence ? '' : ' (transient)'}`,
);
