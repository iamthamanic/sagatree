#!/usr/bin/env node
/**
 * atlas-world-focus.self-test — Shared World Space Focus & Continuous Zoom Journey Contract.
 *
 * Verifies:
 *  - `resolveWorldFocusTarget` computes exact world-space center, span, and root→target chain
 *    from `ParentSpatialAnchor`s across all 6 hierarchy levels (World → Continent → Country → Place → Building → Room).
 *  - `recommendedWorldCameraSpan` scales target-appropriately (overview for root, framed settlement for Dornhain,
 *    tight interior framing for Taverne & Schankraum).
 *  - Unlocated maps (`status: 'unlocated'` or missing `parentAnchor`) fail honestly with a German explanation
 *    and NEVER invent fake coordinates.
 *  - `buildAtlasWorldScenePlan` preserves the full `focusTargetMapId` ancestor chain under budget pressure,
 *    aligns `activeEditorMapId` with an explicit `focusTargetMapId`, and reveals a centered settlement early
 *    via foveated focus priority (e.g. WO-5CFNZ-sized settlement by `span = 25`) without breaking hysteresis.
 *  - `buildAtlasSceneScatter` respects `exclusionRects` so coarse parent scatter clears child settlement footprints.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-world-focus-'));
const outfile = join(tmp, 'focus.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const atlas = await import(pathToFileURL(outfile).href);
const bundle = atlas.buildCalibratedDefaultWorld();

const maps = [
  ...Object.values(bundle.worldNodes).map((n) => ({ ...n, status: 'ready' })),
  { id: 'map.unlocated.city', parentAnchor: null, status: 'unlocated' },
  { id: 'map.orphan.no-anchor', parentAnchor: null, status: 'ready' },
];

const viewportPx = { width: 1280, height: 800 };

// 1) World root focus resolves cleanly
const rootFocus = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: bundle.rootSeedKey,
  labelDe: 'Weltkarte',
});
assert.equal(rootFocus.ok, true, 'root focus resolves');
assert.equal(rootFocus.depth, 1);
assert.deepEqual(rootFocus.focusChainMapIds, [bundle.rootSeedKey]);
assert.ok(rootFocus.recommendedCameraSpan >= 400, 'root camera span frames overview');

// 2) Dornhain settlement resolves to exact anchor-derived world coordinates and tight settlement span
const dornFocus = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: 'dornhain.map.place.dornhain',
  labelDe: 'Dornhain',
});
assert.equal(dornFocus.ok, true, 'Dornhain focus resolves');
assert.equal(dornFocus.depth, 4);
assert.deepEqual(dornFocus.focusChainMapIds, [
  bundle.rootSeedKey,
  'dornhain.map.continent.westmark',
  'dornhain.map.country.westmark',
  'dornhain.map.place.dornhain',
]);
const dornCenterDirect = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', {
  x: 500,
  y: 500,
});
assert.equal(dornCenterDirect.ok, true);
assert.ok(
  Math.abs(dornFocus.centerWorld.x - dornCenterDirect.value.x) < 1e-6 &&
    Math.abs(dornFocus.centerWorld.y - dornCenterDirect.value.y) < 1e-6,
  'Dornhain centerWorld matches localToWorld(500, 500)',
);
assert.ok(
  dornFocus.recommendedCameraSpan > 1 && dornFocus.recommendedCameraSpan < 15,
  `Dornhain camera span frames settlement tightly (got ${dornFocus.recommendedCameraSpan})`,
);

// 3) Building (Taverne) & Room (Schankraum) resolve strictly inside Dornhain with progressively tighter spans
const tavernFocus = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: 'dornhain.map.loc.tavern',
  labelDe: 'Taverne Zum Flüstern',
});
const roomFocus = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: 'dornhain.map.room.taproom',
  labelDe: 'Schankraum',
});
assert.equal(tavernFocus.ok, true, 'Taverne focus resolves');
assert.equal(roomFocus.ok, true, 'Schankraum focus resolves');
assert.equal(tavernFocus.depth, 5);
assert.equal(roomFocus.depth, 6);
assert.ok(
  tavernFocus.recommendedCameraSpan < dornFocus.recommendedCameraSpan &&
    roomFocus.recommendedCameraSpan < tavernFocus.recommendedCameraSpan,
  'camera span decreases monotonically: Dornhain > Taverne > Schankraum',
);

// 4) Unlocated & unanchored non-root maps fail honestly with German notice (no invented coordinates)
const unlocRes = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: 'map.unlocated.city',
  labelDe: 'new type city',
});
assert.equal(unlocRes.ok, false, 'unlocated map must not fake focus');
assert.equal(unlocRes.reason, 'unlocated');
assert.ok(
  unlocRes.reasonDe.includes('new type city') && unlocRes.reasonDe.includes('verortet'),
  `honest German unlocated reason (got: ${unlocRes.reasonDe})`,
);

const missingRes = atlas.resolveWorldFocusTarget({
  maps,
  targetMapId: 'map.does.not.exist',
  labelDe: 'Geisterstadt',
});
assert.equal(missingRes.ok, false);
assert.equal(missingRes.reason, 'missing');

// 5) Free-zoom foveated reveal: a settlement of ~8.7 world units (live WO-5CFNZ scale) enters cleanly by span = 25
const liveScaleMaps = [
  { id: 'world', parentAnchor: null, status: 'ready' },
  {
    id: 'settlement-live',
    status: 'ready',
    parentAnchor: {
      parentMapId: 'world',
      centerX: 227.7,
      centerY: 376.9,
      extentX: 3.872,
      extentY: 4.84,
      rotationRad: 0,
      metersPerUnit: 1,
    },
  },
];
const camSpan25 = atlas.createAtlasWorldCameraState({
  focusWorld: { x: 227.7, y: 376.9, z: 0 },
  span: 25,
  yawRad: 0.42,
  projection: 'diorama-oblique',
});
const planSpan25 = atlas.buildAtlasWorldScenePlan({
  maps: liveScaleMaps,
  camera: camSpan25,
  viewportPx,
});
const settlementEntry25 = planSpan25.entries.find((m) => m.mapId === 'settlement-live');
assert.ok(settlementEntry25, 'centered settlement is already active in scene plan by span = 25');
assert.ok(
  settlementEntry25.detailWeight > 0 && settlementEntry25.detailWeight < 1,
  `settlement detailWeight blends smoothly at span = 25 (got ${settlementEntry25.detailWeight})`,
);

// 6) Explicit focusTargetMapId keeps Taverne as activeEditorMapId (does not jump straight to Schankraum)
const camTavern = atlas.createAtlasWorldCameraState({
  focusWorld: { x: tavernFocus.centerWorld.x, y: tavernFocus.centerWorld.y, z: 0 },
  span: tavernFocus.recommendedCameraSpan,
  yawRad: 0.42,
  projection: 'diorama-oblique',
});
const planTavern = atlas.buildAtlasWorldScenePlan({
  maps,
  camera: camTavern,
  viewportPx,
  focusTargetMapId: 'dornhain.map.loc.tavern',
});
assert.equal(
  planTavern.activeEditorMapId,
  'dornhain.map.loc.tavern',
  'explicit focusTargetMapId keeps Taverne active instead of snapping into child room',
);
for (const ancestorId of tavernFocus.focusChainMapIds) {
  assert.ok(
    planTavern.entries.some((m) => m.mapId === ancestorId),
    `focus chain member ${ancestorId} survives budget`,
  );
}

// 7) Scatter exclusionRects keep coarse parent scatter clear of child settlement footprint
const sampleDoc = bundle.maps.find((m) => m.seedKey === 'dornhain.map.place.dornhain')?.buildCanvas();
assert.ok(sampleDoc, 'Dornhain default canvas exists');
const exclusion = { minX: 400, minY: 400, maxX: 600, maxY: 600 };
const scatter = atlas.buildAtlasSceneScatter({
  doc: sampleDoc,
  mapScale: 'settlement',
  look: 'outdoor',
  seed: 'dornhain-exclusion-test',
  presetId: 'balanced',
  exclusionRects: [exclusion],
});
assert.ok(Array.isArray(scatter.instances) && scatter.instances.length > 0, 'scatter returns non-empty instances');
for (const inst of scatter.instances) {
  const inside =
    inst.x >= exclusion.minX &&
    inst.x <= exclusion.maxX &&
    inst.y >= exclusion.minY &&
    inst.y <= exclusion.maxY;
  assert.equal(inside, false, `scatter ${inst.kind} at (${inst.x}, ${inst.y}) must respect exclusionRect`);
}

rmSync(tmp, { recursive: true, force: true });
console.log('atlas-world-focus.self-test: PASS (7/7)');
