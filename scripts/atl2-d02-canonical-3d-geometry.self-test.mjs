#!/usr/bin/env node
/**
 * ATL2-D02 — Canonical Atlas features as editable productive WebGL geometry.
 * Location: scripts/atl2-d02-canonical-3d-geometry.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const planMod = jiti(join(root, 'src/domains/world/atlas/atlas-product-geometry-plan.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));
const hierarchy = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const retire = jiti(join(root, 'src/domains/world/atlas/atlas-webgl-write-retire.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d02.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d02-canonical-3d-geometry.md'), 'utf8');
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

assert.ok(acceptance.includes('atl2-d02'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-07'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(design.includes('custom WebGL'));
assert.ok(gate.includes('atl2-d02-canonical-3d-geometry.self-test.mjs'));
assert.ok(indexSrc.includes('buildAtlasProductGeometryPlan'));
assert.ok(runtimeSrc.includes('productDoorInto'));
assert.ok(runtimeSrc.includes('productWallSegmentInto'));
assert.ok(runtimeSrc.includes('carve door openings') || runtimeSrc.includes('door openings'));
assert.ok(runtimeSrc.includes('productGeometryFingerprint'));
assert.ok(runtimeSrc.includes('state.doors'));
assert.ok(runtimeSrc.includes('jambs + lintel') || runtimeSrc.includes('open doorway'));
assert.ok(!editorSrc.includes('AtlasSpatialViewport'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');

const golden = starter.buildDornhainUnifiedCanvasDoc();
const goldenPlan = planMod.buildAtlasProductGeometryPlan(golden, { mapScale: 'world' });
assert.equal(goldenPlan.format, 'atl2-product-geometry-plan-v1');
assert.ok(goldenPlan.counts.area + goldenPlan.counts.room >= 1, 'areas/rooms');
assert.ok(goldenPlan.counts.path >= 1, 'paths');
assert.ok(goldenPlan.counts.building_footprint + goldenPlan.counts.prop >= 1, 'props/footprints');
assert.ok(typeof goldenPlan.contentFingerprint === 'string' && goldenPlan.contentFingerprint.length > 8);

const tavern = hierarchy.buildGoldenTavernCanvas();
const wall = tavern.walls[0];
assert.ok(wall, 'tavern has wall');
const doorId = 'atl2-d02-test-door';
const withDoor = {
  ...tavern,
  doors: [{ id: doorId, wallId: wall.id, t: 0.5, width: Math.max(0.8, wall.width * 2) }],
};
const interiorPlan = planMod.buildAtlasProductGeometryPlan(withDoor, { mapScale: 'interior' });
assert.ok(interiorPlan.counts.wall >= 1);
assert.equal(interiorPlan.counts.door, 1);
const doorPrim = interiorPlan.primitives.find((p) => p.kind === 'door' && p.id === doorId);
assert.ok(doorPrim);
assert.equal(doorPrim.wallId, wall.id);
const [px, py] = canvas.wallPointAt(wall, 0.5);
assert.ok(Math.hypot(doorPrim.position[0] - px, doorPrim.position[1] - py) < 1e-6);

const orphanPlan = planMod.buildAtlasProductGeometryPlan({
  ...withDoor,
  doors: [{ id: 'orphan', wallId: 'missing-wall', t: 0.2, width: 1 }],
});
assert.equal(orphanPlan.counts.door, 0);

const seeded = bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), withDoor);
assert.ok(Array.isArray(seeded.doors));
assert.equal(seeded.doors.length, 1);
assert.equal(seeded.doors[0].id, doorId);
assert.ok(Number.isFinite(seeded.doors[0].x) && Number.isFinite(seeded.doors[0].z));

const round = bridge.syncWebglPropsIntoCanvasDoc(canvas.emptyUnifiedCanvasDoc(false), seeded);
assert.equal((round.doors ?? []).length, 1);
assert.equal(round.doors[0].wallId, wall.id);

const concave = canvas.roomFromPolygon('concave-1', 'stein', [
  [0, 0],
  [40, 0],
  [40, 10],
  [20, 10],
  [20, 30],
  [40, 30],
  [40, 40],
  [0, 40],
]);
assert.ok(concave);
const concavePlan = planMod.buildAtlasProductGeometryPlan({
  ...canvas.emptyUnifiedCanvasDoc(false),
  rooms: [concave],
});
const areaPrim = concavePlan.primitives.find((p) => p.id === 'concave-1');
assert.ok(areaPrim && (areaPrim.kind === 'area' || areaPrim.kind === 'room'));
assert.ok(areaPrim.triangles.length >= 3, 'concave triangulates');

const seeds = planMod.planDoorSeeds(withDoor);
assert.equal(seeds.length, 1);
assert.equal(seeds[0].id, doorId);

const freed = retire.geometryFreeWebglRuntime(seeded);
assert.equal(freed.doors.length, 0);
assert.equal(retire.webglRuntimeHasGeometry(freed), false);
assert.equal(retire.canvasDocHasGeometry(withDoor), true);

const writeEvidence = process.env.ATL2_D02_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-d02-out-'));

const report = `# ATL2-D02 canonical 3D geometry

- Verdict: CLEAR
- Product target: ${target.ATLAS_PRODUCT_3D_TARGET}
- Golden plan counts: ${JSON.stringify(goldenPlan.counts)}
- Interior+door plan counts: ${JSON.stringify(interiorPlan.counts)}
- Bridge doors projected: ${seeded.doors.length}
- Concave tris: ${areaPrim.triangles.length}
`;

writeFileSync(join(outDir, 'atl2-d02-canonical-3d-geometry.md'), report);
writeFileSync(
  join(outDir, 'atl2-d02-canonical-3d-geometry.json'),
  JSON.stringify(
    {
      verdict: 'CLEAR',
      goldenCounts: goldenPlan.counts,
      interiorDoorCounts: interiorPlan.counts,
      bridgeDoors: seeded.doors.length,
      concaveTris: areaPrim.triangles.length,
    },
    null,
    2,
  ),
);

if (!writeEvidence) {
  // CI / local verify without mutating .qa/runs unless seeded once.
  assert.ok(true);
} else {
  assert.equal(writeEvidence, true);
}

console.log(`atl2-d02-canonical-3d-geometry self-test: PASS (CLEAR)`);
console.log(
  `report: ${join(outDir, 'atl2-d02-canonical-3d-geometry.md')}${writeEvidence ? '' : ' (transient)'}`,
);
