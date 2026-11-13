#!/usr/bin/env node
/**
 * ATL2-D05 — Terrain mesh plan + LOD from heightfield.
 * Location: scripts/atl2-d05-terrain-mesh.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const terrain = jiti(join(root, 'src/domains/world/atlas/atlas-terrain-mesh.ts'));
const hf = jiti(join(root, 'src/domains/world/atlas/atlas-heightfield.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d05.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d05-terrain-mesh.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-d05'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(design.includes('custom WebGL'));
assert.ok(gate.includes('atl2-d05-terrain-mesh.self-test.mjs'));
assert.ok(indexSrc.includes('buildAtlasTerrainMeshPlan'));
assert.ok(runtimeSrc.includes('productTerrainLodStride'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');

assert.equal(terrain.atlasTerrainLodFromSpan(400), 'far');
assert.equal(terrain.atlasTerrainLodFromSpan(120), 'mid');
assert.equal(terrain.atlasTerrainLodFromSpan(40), 'near');
assert.equal(terrain.atlasTerrainLodStride('far'), 4);

let doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, {
  op: 'paint_heightfield',
  stroke: { mode: 'raise', x: 500, z: 500, radius: 80, strength: 4 },
});
assert.ok(doc.heightfield);

const far = terrain.buildAtlasTerrainMeshPlan(doc, { span: 400 });
const near = terrain.buildAtlasTerrainMeshPlan(doc, { span: 40 });
assert.equal(far.format, terrain.ATLAS_TERRAIN_MESH_FORMAT);
assert.ok(far.triangles.length > 0);
assert.ok(near.triangles.length >= far.triangles.length);
assert.ok(far.drawBudget.triangleCount <= far.drawBudget.maxTriangles);
assert.ok(near.waterPlane);
assert.ok(near.coastEdges.length >= 0);

const emptyPlan = terrain.buildAtlasTerrainMeshPlan(canvas.emptyUnifiedCanvasDoc(false), {
  span: 40,
});
assert.equal(emptyPlan.triangles.length, 0);
assert.equal(emptyPlan.waterPlane, null);

const writeEvidence = process.env.ATL2_D05_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-d05-out-'));

writeFileSync(
  join(outDir, 'atl2-d05-terrain-mesh.md'),
  `# ATL2-D05 terrain mesh\n\n- Verdict: CLEAR\n- Far tris: ${far.triangles.length}\n- Near tris: ${near.triangles.length}\n`,
);
writeFileSync(
  join(outDir, 'atl2-d05-terrain-mesh.json'),
  JSON.stringify(
    {
      verdict: 'CLEAR',
      farTriangles: far.triangles.length,
      nearTriangles: near.triangles.length,
      productTarget: target.ATLAS_PRODUCT_3D_TARGET,
    },
    null,
    2,
  ),
);

console.log('atl2-d05-terrain-mesh self-test: PASS (CLEAR)');
console.log(
  `report: ${join(outDir, 'atl2-d05-terrain-mesh.md')}${writeEvidence ? '' : ' (transient)'}`,
);
