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
const multimapOut = join(tmp, 'multimap.mjs');

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
  entryPoints: [join(root, 'src/domains/world/atlas/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: domainOut,
});
buildSync({
  entryPoints: [join(root, 'src/infrastructure/world/atlas-three/atlas-three-multimap.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: multimapOut,
});

const cam = await import(pathToFileURL(camOut).href);
const input = await import(pathToFileURL(inputOut).href);
const pins = await import(pathToFileURL(domainOut).href);
const multimap = await import(pathToFileURL(multimapOut).href);

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

// 5) Truthful calibration- & projection-grounded scale HUD (exact values, zero invented 1250m, zero fake m/km when uncalibrated)
const hudOrthoWorld = cam.formatAtlasTruthfulScaleHud(500, {
  isWorldSceneGraph: true,
  metersPerUnit: 250,
  mode: 'ortho-topdown',
  pitchRad: Math.PI / 2,
});
assert.equal(hudOrthoWorld.calibrated, true);
assert.equal(hudOrthoWorld.visibleGroundWu, 1000);
assert.equal(hudOrthoWorld.visibleMeters, 250_000);
assert.equal(hudOrthoWorld.shortLabel, '~250 km');

const hudOrthoTown = cam.formatAtlasTruthfulScaleHud(2.0, {
  isWorldSceneGraph: true,
  metersPerUnit: 250,
  mode: 'ortho-topdown',
  pitchRad: Math.PI / 2,
});
assert.equal(hudOrthoTown.visibleGroundWu, 4.0);
assert.equal(hudOrthoTown.visibleMeters, 1000);
assert.equal(hudOrthoTown.shortLabel, '~1,0 km');

const hudDioramaTown = cam.formatAtlasTruthfulScaleHud(2.0, {
  isWorldSceneGraph: true,
  metersPerUnit: 250,
  mode: 'diorama-oblique',
  pitchRad: Math.PI / 4,
});
assert.ok(
  hudDioramaTown.visibleGroundWu > hudOrthoTown.visibleGroundWu + 1.5,
  `oblique diorama ground span (${hudDioramaTown.visibleGroundWu.toFixed(2)}) > ortho (${hudOrthoTown.visibleGroundWu})`,
);

const hudPerspTown = cam.formatAtlasTruthfulScaleHud(2.0, {
  isWorldSceneGraph: true,
  metersPerUnit: 250,
  mode: 'perspective',
  pitchRad: 0.78,
});
assert.ok(
  hudPerspTown.visibleGroundWu > hudOrthoTown.visibleGroundWu,
  `tilted perspective ground span (${hudPerspTown.visibleGroundWu.toFixed(2)}) > ortho (${hudOrthoTown.visibleGroundWu})`,
);

const hudRoom = cam.formatAtlasTruthfulScaleHud(0.2, {
  isWorldSceneGraph: true,
  metersPerUnit: 250,
  mode: 'ortho-topdown',
  pitchRad: Math.PI / 2,
});
assert.equal(hudRoom.visibleMeters, 100);
assert.equal(hudRoom.shortLabel, '~100 m');
assert.ok(hudRoom.zoomLevel > hudOrthoTown.zoomLevel && hudOrthoTown.zoomLevel > hudOrthoWorld.zoomLevel);

// Uncalibrated world/map MUST NOT invent meters or kilometers!
const hudUncal = cam.formatAtlasTruthfulScaleHud(500, {
  isWorldSceneGraph: true,
  metersPerUnit: null,
  mode: 'ortho-topdown',
  pitchRad: Math.PI / 2,
});
assert.equal(hudUncal.calibrated, false);
assert.equal(hudUncal.visibleMeters, null);
assert.equal(hudUncal.shortLabel, '~1000 WE');
assert.ok(!/\b(km|m)\b/i.test(hudUncal.shortLabel), 'uncalibrated shortLabel never claims m/km');
assert.ok(hudUncal.detailTitleDe.includes('unkalibriert'));

assert.equal(
  pins.extractMapCalibrationMetersPerUnit({ worldSpace: { calibrated: true, metersPerUnit: 250 } }),
  250,
);
assert.equal(
  pins.extractMapCalibrationMetersPerUnit({ mapFrame: { parentAnchor: { parentMapId: 'r', centerX: 500, centerY: 500, extentX: 20, extentY: 20, rotationRad: 0, metersPerUnit: 1 } } }),
  1,
);
assert.equal(pins.extractMapCalibrationMetersPerUnit({ worldSpace: { calibrated: false } }), null);
assert.equal(pins.extractMapCalibrationMetersPerUnit({}), null);

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

// 8) Small-step wheel settling regression: finalizing `view = targetView = damped.next` BEFORE
//    clearing `zoomAnchor` produces ZERO next-frame drift & zero Y jump
{
  const mode = 'diorama-oblique';
  let view = {
    mode,
    x: 280,
    z: 540,
    y: slopeElev(280, 540),
    span: 24,
    yawRad: 0.4,
    pitchRad: cam.autoAtlasThreePitchForSpan(mode, 24),
  };
  const anchorWorld = { x: 282, y: 12.74, z: 544 };
  const rigStart = cam.buildAtlasThreeCameraRig(view, aspect);
  const ndc = cam.projectWorldPointWithRig(rigStart, anchorWorld);
  let target = { ...view };
  for (let step = 0; step < 5; step += 1) {
    const nextSpan = target.span * 0.96; // tiny wheel step
    const nextPitch = cam.autoAtlasThreePitchForSpan(mode, nextSpan);
    const solved = cam.solveAnchoredCameraFocus({
      view: { ...target, span: nextSpan, pitchRad: nextPitch },
      anchorWorld,
      targetNdcX: ndc.ndcX,
      targetNdcY: ndc.ndcY,
      aspect,
      sampleFocusElevation: slopeElev,
    });
    target = { ...target, x: solved.x, z: solved.z, y: solved.y, span: nextSpan, pitchRad: nextPitch };
  }
  let settledCount = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    const d = cam.dampAtlasThreeView(view, target, 0.016, 12.5, {
      anchorWorld,
      targetNdcX: ndc.ndcX,
      targetNdcY: ndc.ndcY,
      aspect,
      sampleFocusElevation: slopeElev,
    });
    view = d.next;
    if (d.settled) {
      target = { ...d.next };
      settledCount += 1;
      break;
    }
  }
  assert.equal(settledCount, 1, 'small wheel steps converge cleanly to settled');
  // Next frame AFTER clearing anchor must stay identical (zero unanchored re-damp / Y jump!)
  const afterClear = cam.dampAtlasThreeView(view, target, 0.016, 12.5, null);
  assert.equal(afterClear.settled, true);
  assert.equal(afterClear.next.x, view.x);
  assert.equal(afterClear.next.z, view.z);
  assert.equal(afterClear.next.y, view.y);
}

// 9) World-Space Pins (`buildAtlasWorldPins`) + Projection-Driven Hierarchy + Honest Moorbrück Focus
{
  const bundle = pins.buildCalibratedDefaultWorld();
  const sceneMaps = [
    ...Object.values(bundle.worldNodes).map((n) => ({ ...n, status: 'ready' })),
    {
      id: 'map.unlocated.test',
      parentAnchor: null,
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      status: 'unlocated',
    },
  ];
  const worldPlaces = [
    { id: 'pl.westmark', name: 'Kontinent Westmark', kind: 'continent', parentPlaceId: null, status: 'active' },
    { id: 'pl.suedmark', name: 'Südmark', kind: 'country', parentPlaceId: 'pl.westmark', status: 'active' },
    { id: 'pl.moorbrueck', name: 'Moorbrück', kind: 'settlement', parentPlaceId: 'pl.suedmark', status: 'active' },
    { id: 'pl.dornhain', name: 'Dornhain', kind: 'settlement', parentPlaceId: 'pl.westmark', status: 'active' },
    { id: 'pl.markt', name: 'Marktplatz', kind: 'place', parentPlaceId: 'pl.dornhain', status: 'active' },
    { id: 'pl.unloc', name: 'Geisterstadt', kind: 'settlement', parentPlaceId: null, status: 'active' },
  ];
  const worldLinks = [
    { placeId: 'pl.westmark', mapId: 'dornhain.map.continent.westmark', usage: 'primary', anchor: {} },
    { placeId: 'pl.suedmark', mapId: 'dornhain.map.country.suedmark', usage: 'primary', anchor: {} },
    { placeId: 'pl.moorbrueck', mapId: 'dornhain.map.place.moorbrueck', usage: 'primary', anchor: {} },
    { placeId: 'pl.moorbrueck', mapId: 'dornhain.map.country.suedmark', usage: 'overview', anchor: { x: 620, y: 460 } },
    { placeId: 'pl.dornhain', mapId: 'dornhain.map.place.dornhain', usage: 'primary', anchor: {} },
    { placeId: 'pl.markt', mapId: 'dornhain.map.place.dornhain', usage: 'primary', anchor: { x: 520, y: 540 } },
    { placeId: 'pl.unloc', mapId: 'map.unlocated.test', usage: 'primary', anchor: {} },
  ];
  const worldPins = pins.buildAtlasWorldPins({
    maps: sceneMaps,
    places: worldPlaces,
    links: worldLinks,
    rootMapId: bundle.rootSeedKey,
  });
  const moorPin = worldPins.find((p) => p.id === 'pl.moorbrueck');
  assert.ok(moorPin, 'Moorbrück pin resolved in World Space');
  assert.ok(Math.abs(moorPin.x - 282) < 0.05 && Math.abs(moorPin.y - 544) < 0.05, `Moorbrück at (282,544), got (${moorPin.x},${moorPin.y})`);
  assert.ok(Math.abs((moorPin.worldSpan ?? 0) - 4.0) < 0.05);
  assert.equal(worldPins.filter((p) => p.id === 'pl.moorbrueck').length, 1, 'deduplicated per place.id');
  const marktPin = worldPins.find((p) => p.id === 'pl.markt');
  assert.ok(marktPin, 'child landmark without own primary map resolved via localToWorld');
  assert.equal(worldPins.find((p) => p.id === 'pl.unloc'), undefined, 'unlocated place omitted honestly');

  // Projection-driven label visibility: hidden on world overview (3px), visible on regional zoom (36px), locked when focused
  const presWorld = pins.computeAtlasPinZoomPresentation(moorPin, 530, 'world', {
    isWorldSceneGraph: true,
    projectedSpanPx: 3,
  });
  assert.equal(presWorld.visible, false, 'Moorbrück pin hidden on world overview');
  const presRegional = pins.computeAtlasPinZoomPresentation(moorPin, 44, 'world', {
    isWorldSceneGraph: true,
    projectedSpanPx: 36,
  });
  assert.equal(presRegional.visible, true, 'Moorbrück pin visible at regional/country zoom');
  const presFocused = pins.computeAtlasPinZoomPresentation(moorPin, 530, 'world', {
    isWorldSceneGraph: true,
    projectedSpanPx: 3,
    isFocused: true,
  });
  assert.equal(presFocused.visible, true);
  assert.equal(presFocused.locked, true);

  // Honest spatial activeEditorMapId: Südmark countryside -> Südmark; inside Moorbrück -> Moorbrück
  const runtimeCfg = { maxActiveMaps: 6, sseRefinePx: 140, sseCoarsenPx: 95, sseReplaceParentPx: 210 };
  const planSuedmarkOpen = pins.buildAtlasWorldScenePlan({
    maps: sceneMaps,
    camera: pins.createAtlasWorldCameraState({ focusWorld: { x: 250, y: 540, z: 0 }, span: 25 }),
    viewportPx: { width: 1280, height: 800 },
    config: runtimeCfg,
  });
  assert.equal(
    planSuedmarkOpen.activeEditorMapId,
    'dornhain.map.country.suedmark',
    'open countryside beside Moorbrück reports Südmark (not Westmark, not Moorbrück)',
  );
  // Stale off-screen `focusTargetMapId` (e.g. Schankraum in Nordreich after moving camera to Südmark)
  // MUST NOT starve Südmark / Moorbrück out of the 6-map budget!
  const planStaleFocus = pins.buildAtlasWorldScenePlan({
    maps: sceneMaps,
    camera: pins.createAtlasWorldCameraState({ focusWorld: { x: 250, y: 540, z: 0 }, span: 25 }),
    viewportPx: { width: 1280, height: 800 },
    focusTargetMapId: 'dornhain.map.room.taproom',
    config: runtimeCfg,
  });
  assert.equal(
    planStaleFocus.activeEditorMapId,
    'dornhain.map.country.suedmark',
    'stale off-screen Schankraum focusTargetMapId cannot starve Südmark out of budget',
  );
  const planMoorbrueck = pins.buildAtlasWorldScenePlan({
    maps: sceneMaps,
    camera: pins.createAtlasWorldCameraState({ focusWorld: { x: 282, y: 544, z: 0 }, span: 10 }),
    viewportPx: { width: 1280, height: 800 },
    previousPlan: planSuedmarkOpen,
    config: runtimeCfg,
  });
  assert.equal(
    planMoorbrueck.activeEditorMapId,
    'dornhain.map.place.moorbrueck',
    'free zoom inside Moorbrück AABB activates Moorbrück',
  );
  // Active-map calibration derivation when root is uncalibrated but Moorbrück has metersPerUnit=1
  const derivedRootMpu = pins.resolveWorldCalibrationMetersPerUnit({
    maps: sceneMaps,
    rootMetersPerUnit: null,
    activeMapId: 'dornhain.map.place.moorbrueck',
  });
  assert.ok(
    Math.abs(derivedRootMpu - 250) < 1e-6,
    `derived world calibration from Moorbrück (1 m/unit / 0.004) === 250 m/WE (got ${derivedRootMpu})`,
  );
  const uncalibratedRootMpu = pins.resolveWorldCalibrationMetersPerUnit({
    maps: sceneMaps,
    rootMetersPerUnit: null,
    activeMapId: bundle.rootSeedKey,
  });
  assert.equal(uncalibratedRootMpu, null, 'uncalibrated root stays null (never invents m/km)');
}

// 10) Macro overlay opacity reaches exact 0 (zero 0.08 ghost!) while regional carrier river stays active
assert.equal(
  multimap.computeMacroOverlayTargetOpacity({
    depth: 1,
    detailWeight: 1,
    viewSpan: 3.5,
    childWeight: 1,
    hasActiveSettlementOrDeeper: true,
  }),
  0,
  'World macro overlay opacity is exact 0 at settlement zoom (no 0.08 ghost)',
);
assert.equal(
  multimap.computeMacroOverlayTargetOpacity({
    depth: 3,
    detailWeight: 1,
    viewSpan: 3.5,
    childWeight: 1,
    hasActiveSettlementOrDeeper: true,
  }),
  0,
  'Country macro overlay opacity is exact 0 at settlement close-up',
);
assert.ok(
  multimap.computeMacroWaterTargetOpacity({
    depth: 3,
    detailWeight: 1,
    viewSpan: 10,
    childWeight: 1,
    hasActiveSettlementOrDeeper: true,
  }) >= 0.9,
  'Country carrier river stays active on regional approach up to settlement cutout',
);
assert.equal(
  multimap.computeMacroWaterTargetOpacity({
    depth: 3,
    detailWeight: 1,
    viewSpan: 1.8,
    childWeight: 1,
    hasActiveSettlementOrDeeper: true,
  }),
  0,
  'Coarse country river hands off cleanly to calibrated local settlement river at close-up zoom',
);
assert.equal(
  multimap.computeMacroOverlayTargetOpacity({
    depth: 1,
    detailWeight: 1,
    viewSpan: 530,
    childWeight: 0,
    hasActiveSettlementOrDeeper: false,
  }),
  1,
  'Zooming back out restores World macro overlays smoothly to 1.0',
);

rmSync(tmp, { recursive: true, force: true });
console.log('✓ atlas-camera-anchor.self-test: PASS (10/10 — cursor anchor, settling, calibrated HUD, world pins, Moorbrück focus, zero-ghost macro fade)');
