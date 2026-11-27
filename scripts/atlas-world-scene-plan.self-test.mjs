#!/usr/bin/env node
/**
 * atlas-world-scene-plan.self-test — SWS-03 Multi-Map Scene Plan + SWS-05 Unified Camera.
 *
 * Verifies:
 *  - Deterministic multi-map scene plan over the calibrated Bottom-Up Default World.
 *  - Camera-driven SSE refinement from Welt → Westmark → Nordreich → Dornhain → Taverne → Schankraum.
 *  - Hysteresis: child stays active between sseCoarsenPx and sseRefinePx (no flicker).
 *  - Replacement-Refinement cutouts emitted on parent when child crosses sseReplaceParentPx (D4).
 *  - Unlocated & portal maps honestly excluded (never invent geography, A5).
 *  - Multi-map budget cap (`maxActiveMaps = 6`) respected (Vertical Slice A.2).
 *  - `switchWorldCameraProjection` preserves focusWorld, yawRad, and span (no yaw=0 reset, E2).
 *  - `projectWorldCameraTo2dViewport` derives 2D view from the single shared World Camera (E1).
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-world-scene-plan-'));
const outfile = join(tmp, 'sp.mjs');

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
  // Add an unlocated child + a distant portal map to test honest exclusion
  { id: 'map.unlocated', parentAnchor: null, status: 'unlocated' },
  {
    id: 'map.portal',
    parentAnchor: {
      parentMapId: bundle.rootSeedKey,
      centerX: 500,
      centerY: 500,
      extentX: 50,
      extentY: 50,
      rotationRad: 0,
      metersPerUnit: 25,
    },
    status: 'ready',
    isPortal: true,
  },
];

const viewportPx = { width: 1280, height: 800 };

// 1) World overview: root + continents active, deep rooms culled/below-sse
const worldCam = atlas.createAtlasWorldCameraState({
  focusWorld: { x: 500, y: 500, z: 0 },
  span: 500,
  yawRad: 0.42,
  projection: 'diorama-oblique',
});
const planWorld = atlas.buildAtlasWorldScenePlan({ maps, camera: worldCam, viewportPx });
assert.equal(planWorld.rootMapId, bundle.rootSeedKey);
assert.ok(planWorld.entries.some((e) => e.mapId === bundle.rootSeedKey), 'world root rendered');
assert.ok(
  planWorld.entries.some((e) => e.mapId === 'dornhain.map.continent.westmark'),
  'Westmark visible at world zoom',
);
assert.ok(
  !planWorld.entries.some((e) => e.mapId === 'dornhain.map.room.taproom'),
  'Schankraum not loaded at planet zoom',
);
assert.ok(
  planWorld.excluded.some((e) => e.mapId === 'map.unlocated' && e.reason === 'unlocated'),
  'unlocated child honestly excluded',
);
assert.ok(
  planWorld.excluded.some((e) => e.mapId === 'map.portal' && e.reason === 'portal'),
  'portal map excluded from spatial graph',
);

// 2) Determinism: identical inputs produce identical plans
const planWorld2 = atlas.buildAtlasWorldScenePlan({ maps, camera: worldCam, viewportPx });
assert.deepEqual(planWorld, planWorld2, 'scene plan is 100% deterministic');

// 3) Zoom deep into Dornhain Tavern Taproom → activeEditorMapId shifts to Schankraum,
//    budget stays <= 6, parent+child simultaneously in graph with replacement cutouts!
const taproomWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.room.taproom', {
  x: 480,
  y: 480,
});
assert.equal(taproomWorld.ok, true);
const deepCam = atlas.createAtlasWorldCameraState({
  focusWorld: { x: taproomWorld.value.x, y: taproomWorld.value.y, z: 0 },
  span: 0.08,
  yawRad: 0.65,
  projection: 'diorama-oblique',
});
const planDeep = atlas.buildAtlasWorldScenePlan({
  maps,
  camera: deepCam,
  viewportPx,
  previousPlan: planWorld,
});
assert.ok(planDeep.entries.length <= 6, `budget respected (<=6, got ${planDeep.entries.length})`);
assert.equal(
  planDeep.activeEditorMapId,
  'dornhain.map.room.taproom',
  'editor context resolves to deepest focused map (D5)',
);
assert.ok(
  planDeep.entries.some((e) => e.mapId === 'dornhain.map.loc.tavern') &&
    planDeep.entries.some((e) => e.mapId === 'dornhain.map.room.taproom'),
  'parent Taverne + child Schankraum simultaneously in scene graph (D1)',
);
const tavernGroup = planDeep.entries.find((e) => e.mapId === 'dornhain.map.loc.tavern');
assert.ok(
  tavernGroup.cutoutRectsLocal.some((c) => c.childMapId === 'dornhain.map.room.taproom'),
  'parent receives Replacement-Refinement cutout for active child (D4)',
);

// 4) Hysteresis: zooming out to an SSE between sseCoarsenPx (95) and sseRefinePx (140)
//    keeps an already-active child visible without flickering, while fresh plan excludes it.
const dornhainWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', {
  x: 500,
  y: 500,
});
// Dornhain worldSpan = 400 (westmark) * 0.25 (nordreich) * 0.04 (dornhain) = 4.0 world units
// For ssePx = 115 px with vpH = 800: span = (4.0 / (2 * 115)) * 800 ≈ 13.91
const midSpan = (4.0 / (2 * 115)) * 800;
const midCam = atlas.createAtlasWorldCameraState({
  focusWorld: { x: dornhainWorld.value.x, y: dornhainWorld.value.y, z: 0 },
  span: midSpan,
  yawRad: 0.42,
});
const closeCam = { ...midCam, span: 4.0 };
const planClose = atlas.buildAtlasWorldScenePlan({ maps, camera: closeCam, viewportPx });
assert.ok(planClose.entries.some((e) => e.mapId === 'dornhain.map.place.dornhain'));
const planHystKeep = atlas.buildAtlasWorldScenePlan({
  maps,
  camera: midCam,
  viewportPx,
  previousPlan: planClose,
});
const planFreshSkip = atlas.buildAtlasWorldScenePlan({
  maps,
  camera: midCam,
  viewportPx,
  previousPlan: null,
});
assert.ok(
  planHystKeep.entries.some((e) => e.mapId === 'dornhain.map.place.dornhain'),
  'hysteresis retains child between coarsen and refine thresholds',
);
assert.ok(
  !planFreshSkip.entries.some((e) => e.mapId === 'dornhain.map.place.dornhain'),
  'fresh plan does not prematurely activate below refine threshold',
);

// 5) SWS-05 Unified Camera: switchWorldCameraProjection preserves focusWorld, yawRad, span (E2)
const camBefore = atlas.createAtlasWorldCameraState({
  focusWorld: { x: 263.2, y: 462.5, z: 0 },
  span: 120,
  yawRad: 1.15,
  projection: 'diorama-oblique',
});
const camTopDown = atlas.switchWorldCameraProjection(camBefore, 'ortho-topdown');
assert.deepEqual(camTopDown.focusWorld, camBefore.focusWorld, 'focus preserved on 2D switch');
assert.equal(camTopDown.yawRad, 1.15, 'yawRad preserved on ortho-topdown switch (NO yaw=0 reset!)');
assert.equal(camTopDown.span, 120, 'span preserved');
assert.equal(camTopDown.pitchRad, Math.PI / 2, 'ortho-topdown pitch = PI/2');

const camBack3d = atlas.switchWorldCameraProjection(camTopDown, 'perspective');
assert.equal(camBack3d.yawRad, 1.15, 'yawRad preserved back to 3D perspective');

// 6) Shared 2D viewport derivation from single World Camera (E1)
const vp2d = atlas.projectWorldCameraTo2dViewport(camTopDown, viewportPx);
assert.equal(vp2d.centerX, 263.2);
assert.equal(vp2d.centerY, 462.5);
assert.equal(vp2d.yawRad, 1.15);
assert.ok(Math.abs(vp2d.scalePxPerWorldUnit - 800 / 240) < 1e-9);

rmSync(tmp, { recursive: true, force: true });
console.log('✓ atlas-world-scene-plan.self-test: 6/6 (SSE LOD, hysteresis, cutouts, budget<=6, unlocated/portal, unified camera)');
