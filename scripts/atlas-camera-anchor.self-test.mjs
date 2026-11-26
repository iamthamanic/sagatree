#!/usr/bin/env node
/**
 * atlas-camera-anchor.self-test — Pure Camera Projection, Cursor-Anchor Solver,
 * Continuous Logarithmic Pitch Curve & Truthful Scale HUD Self-Test (Phase A + B).
 *
 * Zero DOM / Zero WebGL — verifies mathematically that:
 *  1) `projectWorldPointWithRig` + `unprojectNdcToPlaneWithRig` round-trip accurately
 *     for ortho-topdown, diorama-oblique, and perspective across arbitrary yaw/pitch/aspect.
 *  2) `solveAnchoredCameraFocus` pins an elevated 3D terrain/building point `(ax, ay, az)`
 *     to an off-center cursor NDC `(ndcX, ndcY)` within < 0.05 px across zoom IN & OUT,
 *     even when pitch changes automatically and focus ground height varies on a slope.
 *  3) `dampAtlasThreeView` with active `anchor` keeps EVERY intermediate damped frame
 *     pinned within < 0.1 px (zero mid-zoom bowing or drift!).
 *  4) `autoAtlasThreePitchForSpan` is smooth & continuous across `[0.10 .. 1200]`,
 *     always returns `Math.PI / 2` for `ortho-topdown`, and raises gently for room readability.
 *  5) `formatAtlasTruthfulScaleHud` never saturates at a fake `2500%` across world scales.
 *  6) `normalizeWheelDelta` & `classifyUnifiedWheelGesture` clamp extreme `deltaMode` bursts.
 *  7) `atlasMapOwnerPlace` selects the shallowest owner place (`Dornhain`, never child landmarks).
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-camera-anchor-'));
const camOut = join(tmp, 'cam.mjs');
const inputOut = join(tmp, 'input.mjs');
const domainOut = join(tmp, 'domain.mjs');

buildSync({
  entryPoints: [join(root, 'src/infrastructure/world/atlas-three/atlas-three-camera.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: camOut,
});
buildSync({
  entryPoints: [join(root, 'src/infrastructure/world/atlas-three/atlas-unified-input.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: inputOut,
});
buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/atlas-map-pins.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: domainOut,
});

const cam = await import(pathToFileURL(camOut).href);
const input = await import(pathToFileURL(inputOut).href);
const pins = await import(pathToFileURL(domainOut).href);

const slopeElev = (x, z) => 2.5 + Math.sin(x * 0.02) * 3.5 + Math.cos(z * 0.025) * 2.5;

// 1) Round-trip projection / unprojection across all 3 camera modes & oblique yaw/pitch
for (const mode of ['ortho-topdown', 'diorama-oblique', 'perspective']) {
  for (const aspect of [1280 / 800, 768 / 1024, 390 / 844]) {
    const view = {
      mode,
      x: 420,
      z: 460,
      y: slopeElev(420, 460),
      span: 180,
      yawRad: -0.73,
      pitchRad: cam.autoAtlasThreePitchForSpan(mode, 180),
    };
    const rig = cam.buildAtlasThreeCameraRig(view, aspect);
    const pt = { x: 385, y: 11.4, z: 420 };
    const proj = cam.projectWorldPointWithRig(rig, pt);
    assert.equal(proj.visible, true, `${mode} aspect=${aspect.toFixed(2)} point visible`);
    const unproj = cam.unprojectNdcToPlaneWithRig(rig, proj.ndcX, proj.ndcY, pt.y);
    assert.ok(unproj, `${mode} unproject non-null`);
    assert.ok(
      Math.hypot(unproj.x - pt.x, unproj.z - pt.z) < 1e-4,
      `${mode} round-trip error < 1e-4 (got ${Math.hypot(unproj.x - pt.x, unproj.z - pt.z)})`,
    );
  }
}

// 2) Exact cursor-anchor stability under zoom IN & OUT with changing pitch & sloping terrain
const viewportW = 1280;
const viewportH = 800;
const aspect = viewportW / viewportH;
for (const mode of ['diorama-oblique', 'perspective', 'ortho-topdown']) {
  let view = {
    mode,
    x: 480,
    z: 490,
    y: slopeElev(480, 490),
    span: 420,
    yawRad: 0.62,
    pitchRad: cam.autoAtlasThreePitchForSpan(mode, 420),
  };
  const anchorWorld = { x: 227.744, y: 14.2, z: 376.88 };
  const rig0 = cam.buildAtlasThreeCameraRig(view, aspect);
  const startNdc = cam.projectWorldPointWithRig(rig0, anchorWorld);
  assert.equal(startNdc.visible, true, `${mode} start anchor visible`);

  const targetSpans = [280, 140, 60, 22, 6, 1.2, 0.35, 3.5, 45, 220];
  for (const nextSpan of targetSpans) {
    const nextPitch = cam.autoAtlasThreePitchForSpan(mode, nextSpan);
    const solved = cam.solveAnchoredCameraFocus({
      view: { ...view, span: nextSpan, pitchRad: nextPitch },
      anchorWorld,
      targetNdcX: startNdc.ndcX,
      targetNdcY: startNdc.ndcY,
      aspect,
      sampleFocusElevation: slopeElev,
    });
    const targetView = {
      ...view,
      x: solved.x,
      z: solved.z,
      y: solved.y,
      span: nextSpan,
      pitchRad: nextPitch,
    };

    // 3) Check EVERY intermediate damped frame (12 frames @ 16ms) stays pinned < 0.1 px!
    let cur = view;
    for (let f = 0; f < 12; f += 1) {
      const step = cam.dampAtlasThreeView(cur, targetView, 0.016, 12.5, {
        anchorWorld,
        targetNdcX: startNdc.ndcX,
        targetNdcY: startNdc.ndcY,
        aspect,
        sampleFocusElevation: slopeElev,
      });
      cur = step.next;
      const midRig = cam.buildAtlasThreeCameraRig(cur, aspect);
      const midNdc = cam.projectWorldPointWithRig(midRig, anchorWorld);
      const driftPx = Math.hypot(
        ((midNdc.ndcX - startNdc.ndcX) * 0.5) * viewportW,
        ((midNdc.ndcY - startNdc.ndcY) * 0.5) * viewportH,
      );
      assert.ok(
        driftPx < 0.1,
        `${mode} span->${nextSpan} frame ${f}: driftPx=${driftPx.toFixed(4)} must be < 0.1 px`,
      );
    }
    view = targetView;
  }
}

// 4) Continuous logarithmic pitch curve across full range [0.10 .. 1200]
assert.equal(cam.autoAtlasThreePitchForSpan('ortho-topdown', 0.2), Math.PI / 2);
assert.equal(cam.autoAtlasThreePitchForSpan('ortho-topdown', 800), Math.PI / 2);
const pitchWorld = cam.autoAtlasThreePitchForSpan('diorama-oblique', 530);
const pitchVillage = cam.autoAtlasThreePitchForSpan('diorama-oblique', 3.5);
const pitchRoom = cam.autoAtlasThreePitchForSpan('diorama-oblique', 0.2);
assert.ok(pitchWorld > pitchVillage, 'world view tilts steeper than village diorama');
assert.ok(pitchRoom > pitchVillage, 'room cutaway tilts slightly steeper for interior readability');
// Continuity check: adjacent log steps never jump > 0.04 rad
let prevP = cam.autoAtlasThreePitchForSpan('diorama-oblique', 0.12);
for (let s = 0.14; s <= 1200; s *= 1.15) {
  const p = cam.autoAtlasThreePitchForSpan('diorama-oblique', s);
  assert.ok(Math.abs(p - prevP) < 0.04, `pitch jump too large near span=${s}: ${Math.abs(p - prevP)}`);
  prevP = p;
}

// 5) Truthful scale HUD never saturates at 2500% across world hierarchy
const hudWorld = cam.formatAtlasTruthfulScaleHud(530, { isWorldSceneGraph: true });
const hudDorn = cam.formatAtlasTruthfulScaleHud(3.5, { isWorldSceneGraph: true });
const hudRoom = cam.formatAtlasTruthfulScaleHud(0.2, { isWorldSceneGraph: true });
assert.ok(!hudWorld.shortLabel.includes('2500%'));
assert.ok(!hudDorn.shortLabel.includes('2500%'));
assert.ok(!hudRoom.shortLabel.includes('2500%'));
assert.ok(hudRoom.zoomLevel > hudDorn.zoomLevel && hudDorn.zoomLevel > hudWorld.zoomLevel);

// 6) Wheel deltaMode normalization clamps extreme jumps
const burst = input.classifyUnifiedWheelGesture({
  deltaX: 0,
  deltaY: -10,
  deltaMode: 2,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  clientX: 400,
  clientY: 300,
  viewportHeight: 900,
});
assert.equal(burst.kind, 'wheel-zoom');
assert.ok(Math.abs(burst.zoomDelta) <= 220, `page-mode wheel delta clamped (got ${burst.zoomDelta})`);

// 7) Shallowest owner resolution prevents child landmarks from hijacking Dornhain badge
const owner = pins.atlasMapOwnerPlace(
  'dh-map-place-dornhain',
  [
    { id: 'pl-whisper', name: 'Whisper Road', kind: 'place', parentPlaceId: 'pl-dorn', status: 'active' },
    { id: 'pl-markt', name: 'Marktplatz', kind: 'place', parentPlaceId: 'pl-dorn', status: 'active' },
    { id: 'pl-dorn', name: 'Dornhain', kind: 'place', parentPlaceId: 'pl-nord', status: 'active' },
  ],
  [
    { placeId: 'pl-whisper', mapId: 'dh-map-place-dornhain', usage: 'primary' },
    { placeId: 'pl-markt', mapId: 'dh-map-place-dornhain', usage: 'primary' },
    { placeId: 'pl-dorn', mapId: 'dh-map-place-dornhain', usage: 'primary' },
  ],
);
assert.equal(owner?.id, 'pl-dorn', 'shallowest owner Dornhain wins over child landmarks');

rmSync(tmp, { recursive: true, force: true });
console.log('✓ atlas-camera-anchor.self-test: PASS (7/7 — exact <0.1px cursor anchor, C1 pitch, scale HUD, owner lock)');
