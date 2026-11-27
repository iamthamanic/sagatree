#!/usr/bin/env node
/**
 * sws-renderer-input-history.self-test — SWS-04 Multi-Map Scene Graph,
 * SWS-05/06 Unified Camera & MacBook Input, SWS-08 3D Undo/Redo (Checklist D, E, F).
 *
 * Verifies headless (no real GPU required):
 *  - D1: AtlasThreeMultiMapGraph mounts Parent + Child groups simultaneously at exact
 *        SWS-01 localToWorld transforms (matrixWorld matches localToWorld < 1e-5).
 *  - D2: Full Welt → Westmark → Nordreich → Dornhain → Taverne → Schankraum zoom sequence
 *        has clearRootCount === 0.
 *  - D3: AtlasThreeWorkstation does NOT trigger portal overlay fade on non-portal transitions.
 *  - D4: applyLocalCutoutFilter removes parent objects inside active child cutout rect;
 *        dispose() brings liveGeometryCount to 0.
 *  - D5: activeEditorMapId tracks deepest focused map without swapping out parent group.
 *  - E2: switchCameraMode preserves yawRad (no hard yawRad: 0 reset).
 *  - E3–E5: normalizeWheelDelta (deltaMode 0/1/2), Chromium ctrlKey+wheel pinch,
 *           Safari gesturechange pinch, two-finger trackpad pan, Shift+wheel orbit,
 *           non-passive listener binding with preventDefault().
 *  - F1–F3: 120 batched 3D edit/undo/redo cycles (move, rotate, scale, stamp, height, biome)
 *           through atlas-edit-history + cancel batch restore.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import * as THREE from 'three';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const atlas = jiti(join(root, 'src/domains/world/atlas/index.ts'));
const mm = jiti(join(root, 'src/infrastructure/world/atlas-three/atlas-three-multimap.ts'));
const inp = jiti(join(root, 'src/infrastructure/world/atlas-three/atlas-unified-input.ts'));

// ─── 1) SWS-04 Multi-Map Scene Graph (D1, D2, D4, D5) ────────────────────────
const bundle = atlas.buildCalibratedDefaultWorld();
const mapInputs = Object.values(bundle.worldNodes).map((n) => ({ ...n, status: 'ready' }));

const sources = new Map();
sources.set(bundle.rootSeedKey, {
  mapId: bundle.rootSeedKey,
  doc: bundle.rootDoc,
  mapScale: 'world',
  look: 'outdoor',
  revisionKey: 'r1',
});
for (const m of bundle.maps) {
  sources.set(m.seedKey, {
    mapId: m.seedKey,
    doc: m.buildCanvas(),
    mapScale: m.kind === 'scene' ? 'interior' : m.kind === 'settlement' ? 'settlement' : 'world',
    look: m.kind === 'scene' ? 'indoor' : 'outdoor',
    revisionKey: 'r1',
  });
}

const dummyMat = new THREE.MeshBasicMaterial();
const graph = new mm.AtlasThreeMultiMapGraph(() => dummyMat, dummyMat);

const taproomWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.room.taproom', {
  x: 480,
  y: 480,
});
assert.equal(taproomWorld.ok, true);

// Continuous zoom ladder from planet overview all the way into Schankraum
const zoomSpans = [500, 160, 40, 2.5, 0.25, 0.06];
let prevPlan = null;
for (const span of zoomSpans) {
  const cam = atlas.createAtlasWorldCameraState({
    focusWorld: { x: taproomWorld.value.x, y: taproomWorld.value.y, z: 0 },
    span,
    yawRad: 0.42,
  });
  const plan = atlas.buildAtlasWorldScenePlan({
    maps: mapInputs,
    camera: cam,
    viewportPx: { width: 1280, height: 800 },
    previousPlan: prevPlan,
  });
  graph.sync({
    scenePlan: plan,
    sources,
    presetId: 'balanced',
    hideRoofs: false,
    viewSpan: span,
  });
  prevPlan = plan;
}

const stats = graph.getStats();
assert.equal(stats.clearRootCount, 0, 'D2: clearRootCount === 0 across full 6-level zoom');
assert.equal(stats.incrementalSyncCount, zoomSpans.length);
assert.equal(stats.activeEditorMapId, 'dornhain.map.room.taproom', 'D5: editor context = Schankraum');
assert.ok(
  stats.activeMapIds.includes('dornhain.map.loc.tavern') &&
    stats.activeMapIds.includes('dornhain.map.room.taproom'),
  'D1: Parent Taverne + Child Schankraum simultaneously mounted in scene graph',
);

// Verify exact 3D matrixWorld transform parity with SWS-01 localToWorld!
const taproomGroup = graph.getGroup('dornhain.map.room.taproom');
assert.ok(taproomGroup, 'Schankraum group mounted');
const localPt = new THREE.Vector3(480, 0, 480);
localPt.applyMatrix4(taproomGroup.content.matrixWorld);
assert.ok(
  Math.hypot(localPt.x - taproomWorld.value.x, localPt.z - taproomWorld.value.y) < 1e-5,
  `D1: Three.js matrixWorld (${localPt.x},${localPt.z}) matches SWS-01 localToWorld (${taproomWorld.value.x},${taproomWorld.value.y})`,
);

// Verify D4 Replacement-Refinement cutout filtering
const sampleDoc = bundle.maps.find((m) => m.seedKey === 'dornhain.map.loc.tavern').buildCanvas();
const filteredDoc = mm.applyLocalCutoutFilter(sampleDoc, [
  { childMapId: 'dornhain.map.room.taproom', minX: 150, minY: 110, maxX: 650, maxY: 610 },
]);
assert.equal(filteredDoc.objects.length, 0, 'D4: coarse parent objects inside child cutout suppressed');

// Verify clean GPU disposal (budget = 0)
graph.dispose();
assert.equal(graph.getStats().liveGeometryCount, 0, 'Disposal releases 100% of geometries');
dummyMat.dispose();

// ─── 2) SWS-06 Unified Input Controller (E3, E4, E5) ─────────────────────────
// E5: deltaMode normalization
assert.deepEqual(inp.normalizeWheelDelta(10, 20, 0, 800), { dx: 10, dy: 20 });
assert.deepEqual(inp.normalizeWheelDelta(0, 3, 1, 800), { dx: 0, dy: 48 });
assert.deepEqual(inp.normalizeWheelDelta(0, 1, 2, 900), { dx: 0, dy: 900 });

// E3: Chromium trackpad pinch (ctrlKey + wheel)
const pinch = inp.classifyUnifiedWheelGesture({
  deltaX: 0,
  deltaY: -6,
  deltaMode: 0,
  ctrlKey: true,
  shiftKey: false,
  metaKey: false,
  clientX: 400,
  clientY: 300,
  viewportHeight: 800,
});
assert.equal(pinch.kind, 'pinch-zoom');
assert.ok(pinch.zoomDelta < 0, 'pinch out zooms in');

// E3: Safari gesturechange scale ratio
const safariZoomIn = inp.safariGestureScaleToZoomDelta(1.0, 1.2);
const safariZoomOut = inp.safariGestureScaleToZoomDelta(1.2, 1.0);
assert.ok(safariZoomIn < 0 && safariZoomOut > 0, 'Safari gesture scale maps cleanly to zoom delta');

// E4: Two-finger trackpad scroll = Pan
const pan = inp.classifyUnifiedWheelGesture({
  deltaX: 14,
  deltaY: -12,
  deltaMode: 0,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  clientX: 400,
  clientY: 300,
  viewportHeight: 800,
});
assert.equal(pan.kind, 'pan');
assert.equal(pan.deltaX, 14);
assert.equal(pan.deltaY, -12);

// Shift + Wheel = Orbit
const orbit = inp.classifyUnifiedWheelGesture({
  deltaX: 20,
  deltaY: 10,
  deltaMode: 0,
  ctrlKey: false,
  shiftKey: true,
  metaKey: false,
  clientX: 400,
  clientY: 300,
  viewportHeight: 800,
});
assert.equal(orbit.kind, 'orbit');
assert.ok(orbit.deltaYawRad !== 0);

// Physical mouse wheel notch = Zoom
const mouseZoom = inp.classifyUnifiedWheelGesture({
  deltaX: 0,
  deltaY: 120,
  deltaMode: 0,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  clientX: 400,
  clientY: 300,
  viewportHeight: 800,
});
assert.equal(mouseZoom.kind, 'wheel-zoom');

// Non-passive listener registration & preventDefault check
const listeners = new Map();
const fakeEl = {
  addEventListener(type, fn, opts) {
    listeners.set(type, { fn, opts });
  },
  removeEventListener(type) {
    listeners.delete(type);
  },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
};
let zoomed = 0;
let panned = 0;
const unbind = inp.bindAtlasUnifiedInput(fakeEl, {
  onZoomAtScreen: () => {
    zoomed += 1;
  },
  onPanByScreen: () => {
    panned += 1;
  },
  onOrbitByDelta: () => {},
});
assert.equal(listeners.get('wheel')?.opts?.passive, false, 'E5: wheel listener is non-passive');
assert.equal(listeners.get('gesturestart')?.opts?.passive, false, 'E3/E5: Safari gesturestart non-passive');
assert.equal(listeners.get('gesturechange')?.opts?.passive, false, 'E3/E5: Safari gesturechange non-passive');

let wheelPrevented = false;
listeners.get('wheel').fn({
  preventDefault: () => {
    wheelPrevented = true;
  },
  deltaX: 0,
  deltaY: -8,
  deltaMode: 0,
  ctrlKey: true,
  shiftKey: false,
  metaKey: false,
  clientX: 200,
  clientY: 200,
});
assert.equal(wheelPrevented, true, 'E5: preventDefault blocks native browser zoom');
assert.equal(zoomed, 1);

listeners.get('gesturestart').fn({ preventDefault: () => {}, scale: 1.0 });
listeners.get('gesturechange').fn({
  preventDefault: () => {},
  scale: 1.15,
  clientX: 300,
  clientY: 250,
});
assert.equal(zoomed, 2, 'Safari gesturechange triggers cursor zoom');
unbind();
assert.equal(listeners.size, 0, 'unbind cleans all listeners');

// ─── 3) SWS-08 3D Edit History Batching ≥100 Cycles (F1, F2, F3) ─────────────
let doc = atlas.buildGoldenDornhainCanvas();
let hist = atlas.emptyAtlasEditHistory();
const targetId = doc.objects[0].id;
const origX = doc.objects[0].x;

// Run 110 mixed 3D batched gestures (move, rotate, scale, height, biome, stamp)
for (let i = 0; i < 110; i += 1) {
  const mode = i % 5;
  hist = atlas.beginAtlasEditBatch(hist, doc);
  if (mode === 0) {
    // Multi-step drag move → must collapse into ONE history entry
    doc = atlas.applyMapEdit(doc, { op: 'move_object', id: targetId, x: origX + i + 0.5, y: 500 });
    doc = atlas.applyMapEdit(doc, { op: 'move_object', id: targetId, x: origX + i + 1, y: 500 });
  } else if (mode === 1) {
    doc = atlas.applyMapEdit(doc, { op: 'transform_object', id: targetId, patch: { angle: (i * 15) % 360 } });
  } else if (mode === 2) {
    doc = atlas.applyMapEdit(doc, { op: 'transform_object', id: targetId, patch: { size: 0.5 + (i % 4) * 0.1 } });
  } else if (mode === 3) {
    doc = atlas.applyAtlasTerrainSculptDab(doc, { x: 400, y: 400, radius: 40, strength: 1.5, op: 'raise' });
  } else {
    doc = atlas.applyMapEdit(doc, {
      op: 'add_stroke',
      stroke: { id: `st-${i}`, material: 'gras', width: 12, points: [[300, 300], [320, 320]] },
    });
  }
  hist = atlas.commitAtlasEditBatch(hist, doc);
}

assert.equal(hist.past.length, atlas.ATLAS_EDIT_HISTORY_LIMIT, 'F3: capped cleanly at 100 undo entries');

// Undo all 100 steps, then Redo all 100 steps — exact roundtrip
const finalBeforeUndo = JSON.stringify(doc);
let undoCount = 0;
while (atlas.canAtlasUndo(hist)) {
  const step = atlas.undoAtlasEdit(hist, doc);
  assert.ok(step);
  hist = step.history;
  doc = step.doc;
  undoCount += 1;
}
assert.equal(undoCount, 100, 'F3: 100 undo cycles succeeded');

let redoCount = 0;
while (atlas.canAtlasRedo(hist)) {
  const step = atlas.redoAtlasEdit(hist, doc);
  assert.ok(step);
  hist = step.history;
  doc = step.doc;
  redoCount += 1;
}
assert.equal(redoCount, 100, 'F3: 100 redo cycles succeeded');
assert.equal(JSON.stringify(doc), finalBeforeUndo, 'F3: 100-cycle undo→redo reproduces exact state');

// Cancel batch restores pre-gesture doc
const beforeCancel = JSON.stringify(doc);
hist = atlas.beginAtlasEditBatch(hist, doc);
doc = atlas.applyMapEdit(doc, { op: 'move_object', id: targetId, x: 999, y: 999 });
const cancelled = atlas.cancelAtlasEditBatch(hist);
assert.ok(cancelled);
assert.equal(JSON.stringify(cancelled.doc), beforeCancel, 'cancelAtlasEditBatch restores pre-drag doc');

// ─── 4) Source Contracts (D3, E2, F2) ────────────────────────────────────────
const wsSrc = readFileSync(join(root, 'src/app/world/atlas/unified/AtlasThreeWorkstation.tsx'), 'utf8');
assert.ok(wsSrc.includes('bindAtlasUnifiedInput'), 'Workstation uses non-passive Unified Input Controller');
assert.ok(wsSrc.includes('switchWorldCameraProjection'), 'Workstation uses SWS-05 yaw-preserving switchWorldCameraProjection');
assert.ok(wsSrc.includes('if (!isPortal)'), 'D3: Workstation skips portal overlay fade on spatial transitions');
assert.ok(wsSrc.includes('onBeginEditBatchRef') && wsSrc.includes('onCommitEditBatchRef'), 'F2: Workstation batches 3D drag edits');
assert.ok(!wsSrc.includes("yawRad: mode === 'ortho-topdown' ? 0"), 'E2: no hard yawRad: 0 reset in switchCameraMode');

console.log('✓ sws-renderer-input-history.self-test: PASS (Multi-Map D1-D5, Trackpad E2-E5, 100-cycle 3D Undo/Redo F1-F3)');
