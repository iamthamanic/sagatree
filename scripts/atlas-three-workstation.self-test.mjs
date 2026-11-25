#!/usr/bin/env node
/**
 * Atlas Three.js PBR Workstation & Domain Helpers Self-Test (ADR-ST-11 / ATL3 / ATL4).
 * Location: scripts/atlas-three-workstation.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const scatterMod = jiti(join(root, 'src/domains/world/atlas/atlas-scene-scatter.ts'));
const brushMod = jiti(join(root, 'src/domains/world/atlas/atlas-biome-brush.ts'));
const zoomMod = jiti(join(root, 'src/domains/world/atlas/atlas-continuous-zoom.ts'));
const cameraMod = jiti(join(root, 'src/infrastructure/world/atlas-three/atlas-three-camera.ts'));
const golden = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));

// 1) Architecture & code hygiene checks
const workstationSrc = read('src/app/world/atlas/unified/AtlasThreeWorkstation.tsx');
const splitSrc = read('src/app/world/atlas/unified/AtlasSplit2dCanvas.tsx');
const nativeSrc = read('src/app/world/atlas/unified/AtlasNative3dEditor.tsx');
const threeSceneSrc = read('src/infrastructure/world/atlas-three/atlas-three-scene.ts');
const threeRuntimeSrc = read('src/infrastructure/world/atlas-three/atlas-three-runtime.ts');
const pbrSrc = read('src/infrastructure/world/atlas-three/pbr-textures.ts');

for (const [name, src] of [
  ['AtlasThreeWorkstation.tsx', workstationSrc],
  ['AtlasSplit2dCanvas.tsx', splitSrc],
  ['AtlasNative3dEditor.tsx', nativeSrc],
]) {
  assert.ok(!/from ['"]three['"]/.test(src), `${name} must not import three directly (#94/H01)`);
  assert.ok(!/lucide-react/.test(src), `${name} must not import lucide-react`);
  assert.ok(!/\bas any\b|@ts-ignore|@ts-expect-error/.test(src), `${name} must have no type escape hatches`);
}
for (const [name, src] of [
  ['atlas-three-scene.ts', threeSceneSrc],
  ['atlas-three-runtime.ts', threeRuntimeSrc],
  ['pbr-textures.ts', pbrSrc],
]) {
  assert.ok(!/\bas any\b|@ts-ignore|@ts-expect-error/.test(src), `${name} must have no type escape hatches`);
}
assert.ok(threeRuntimeSrc.includes('PCFShadowMap'), 'runtime enables PCFShadowMap');
assert.ok(threeRuntimeSrc.includes('ACESFilmicToneMapping'), 'runtime enables ACESFilmicToneMapping');
assert.ok(threeRuntimeSrc.includes('FogExp2'), 'runtime uses FogExp2 for seamless infinite horizon');
assert.ok(threeRuntimeSrc.includes('infiniteOcean'), 'runtime mounts camera-following infinite ocean');
assert.ok(threeRuntimeSrc.includes('skyDome'), 'runtime mounts atmospheric sky dome');
assert.ok(threeSceneSrc.includes('synthesizeWorldReliefHeightfield'), 'scene synthesizes 3D world relief');
assert.ok(threeSceneSrc.includes('aoDiscs'), 'scene computes ground contact-shadow AO discs');
assert.ok(workstationSrc.includes('data-atlas-bottom-taskbar'), 'workstation renders floating bottom scale/navigation taskbar');
assert.ok(workstationSrc.includes('data-atlas-compass-dial'), 'workstation renders interactive rotating compass dial');
assert.ok(workstationSrc.includes('data-atlas-grid-toggle'), 'workstation renders tactical grid toggle');

// 1b) Smooth camera pitch curve & inertia damping
const pitchFar = cameraMod.autoAtlasThreePitchForSpan('diorama-oblique', 900);
const pitchClose = cameraMod.autoAtlasThreePitchForSpan('diorama-oblique', 90);
assert.ok(pitchFar > pitchClose, `expected steeper overview pitch (${pitchFar}) > close diorama pitch (${pitchClose})`);
const damped = cameraMod.dampAtlasThreeView(
  { mode: 'diorama-oblique', x: 500, z: 500, span: 600, yawRad: 0, pitchRad: 1.0 },
  { mode: 'diorama-oblique', x: 600, z: 500, span: 300, yawRad: 0.5, pitchRad: 0.8 },
  0.016,
);
assert.ok(damped.next.x > 500 && damped.next.x < 600, 'dampAtlasThreeView smoothly interpolates x');
assert.ok(damped.next.span < 600 && damped.next.span > 300, 'dampAtlasThreeView smoothly interpolates span');
assert.equal(damped.settled, false, 'dampAtlasThreeView does not snap immediately on 16ms step');

// 2) Scatter determinism, suggestive-only authority & budget enforcement
const worldDoc = starter.buildDornhainUnifiedCanvasDoc();
const worldScatterA = scatterMod.buildAtlasSceneScatter({
  doc: worldDoc,
  seed: 'dornhain.unified.v4',
  mapScale: 'world',
  presetId: 'high',
});
const worldScatterB = scatterMod.buildAtlasSceneScatter({
  doc: worldDoc,
  seed: 'dornhain.unified.v4',
  mapScale: 'world',
  presetId: 'high',
});
assert.deepEqual(worldScatterA, worldScatterB, 'world scatter must be deterministic');
assert.ok(worldScatterA.instances.length > 50, `expected rich world scatter, got ${worldScatterA.instances.length}`);
assert.ok(worldScatterA.instances.every((i) => i.authority === 'suggestive'), 'all scatter is suggestive');
assert.ok(worldScatterA.instances.length <= worldScatterA.maxBudget, 'scatter respects maxBudget');

const dornhainDoc = golden.buildGoldenDornhainCanvas();
const townScatter = scatterMod.buildAtlasSceneScatter({
  doc: dornhainDoc,
  seed: 'dornhain.map.place.dornhain',
  mapScale: 'settlement',
  presetId: 'high',
});
assert.ok(townScatter.instances.length > 40, `expected rich Dornhain scatter, got ${townScatter.instances.length}`);

const cryptDoc = golden.buildGoldenCryptCanvas();
const cryptScatter = scatterMod.buildAtlasSceneScatter({
  doc: cryptDoc,
  seed: 'dornhain.map.loc.crypt',
  mapScale: 'interior',
  presetId: 'balanced',
});
assert.ok(cryptScatter.instances.every((i) => i.kind === 'rubble'), 'interior scatter only places subtle rubble');

// 3) Terrain sculpt brush dabs
const raised = brushMod.applyAtlasTerrainSculptDab(worldDoc, {
  x: 500,
  y: 500,
  radius: 80,
  strength: 6,
  op: 'raise',
});
assert.ok(raised.heightfield, 'sculpt lazily creates canonical heightfield');
const peakRaised = Math.max(...raised.heightfield.heights);
assert.ok(peakRaised > 0, `expected raised terrain peak > 0, got ${peakRaised}`);

const lowered = brushMod.applyAtlasTerrainSculptDab(raised, {
  x: 500,
  y: 500,
  radius: 80,
  strength: 12,
  op: 'lower',
});
assert.ok(Math.max(...lowered.heightfield.heights) < peakRaised, 'lower op reduces elevation');

// 4) Continuous zoom transitions & scale labels
assert.ok(zoomMod.formatAtlasSpanLabelDe(450, 'world').includes('km'));
assert.ok(zoomMod.formatAtlasSpanLabelDe(200, 'settlement').includes('m'));
const enter = zoomMod.resolveContinuousZoomTransition({
  centerX: 360,
  centerY: 510,
  span: 110,
  wheelDeltaY: -120,
  hasParentMap: false,
  pins: [{ id: 'p-dornhain', label: 'Dornhain', x: 360, y: 510, kind: 'place' }],
  mapScale: 'world',
});
assert.equal(enter.kind, 'enter-child');
assert.equal(enter.pin.id, 'p-dornhain');

const exit = zoomMod.resolveContinuousZoomTransition({
  centerX: 500,
  centerY: 500,
  span: 920,
  wheelDeltaY: 120,
  hasParentMap: true,
  pins: [],
  mapScale: 'settlement',
});
assert.equal(exit.kind, 'exit-parent');

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atlas-three-workstation',
    worldScatter: worldScatterA.instances.length,
    dornhainScatter: townScatter.instances.length,
    cryptScatter: cryptScatter.instances.length,
  }),
);
