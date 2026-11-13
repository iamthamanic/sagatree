#!/usr/bin/env node
/**
 * ATL2-D03 — Product camera modes (ortho / diorama / perspective).
 * Location: scripts/atl2-d03-product-camera-modes.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const cam = jiti(join(root, 'src/domains/world/atlas/atlas-product-camera.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d03.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d03-product-camera-modes.md'), 'utf8');
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

assert.ok(acceptance.includes('atl2-d03'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(design.includes('custom WebGL'));
assert.ok(gate.includes('atl2-d03-product-camera-modes.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_PRODUCT_CAMERA_MODES'));
assert.ok(runtimeSrc.includes('glm.perspective'));
assert.ok(runtimeSrc.includes('setCameraMode'));
assert.ok(runtimeSrc.includes('cycleCameraMode'));
assert.ok(runtimeSrc.includes('ortho-topdown'));
assert.ok(runtimeSrc.includes('diorama-oblique'));
assert.ok(runtimeSrc.includes('perspective'));
assert.ok(runtimeSrc.includes('cameraModeBtn'));
assert.ok(runtimeSrc.includes('state.camera'));
assert.ok(!editorSrc.includes('AtlasSpatialViewport'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');

assert.deepEqual([...cam.ATLAS_PRODUCT_CAMERA_MODES], [
  'ortho-topdown',
  'diorama-oblique',
  'perspective',
]);

const top = cam.defaultAtlasProductCameraState({ mode: 'ortho-topdown' });
assert.equal(top.mode, 'ortho-topdown');
assert.ok(Math.abs(top.pitchRad - Math.PI / 2) < 1e-9);

const diorama = cam.withAtlasProductCameraMode(top, 'diorama-oblique');
assert.equal(diorama.mode, 'diorama-oblique');
assert.ok(diorama.pitchRad >= cam.ATLAS_DIORAMA_PITCH_MIN);
assert.ok(diorama.pitchRad <= cam.ATLAS_DIORAMA_PITCH_MAX);

const persp = cam.withAtlasProductCameraMode(diorama, 'perspective');
assert.equal(persp.mode, 'perspective');
assert.equal(cam.cycleAtlasProductCameraMode('perspective'), 'ortho-topdown');

const parsed = cam.parseAtlasProductCameraState(persp);
assert.deepEqual(parsed, cam.clampAtlasProductCamera(persp));
assert.equal(cam.parseAtlasProductCameraState(null), null);

const mid = cam.interpolateAtlasProductCamera(top, diorama, 0.5);
assert.equal(mid.mode, 'diorama-oblique');
assert.ok(mid.span > 0);

const writeEvidence = process.env.ATL2_D03_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-d03-out-'));

const report = `# ATL2-D03 product camera modes

- Verdict: CLEAR
- Product target: ${target.ATLAS_PRODUCT_3D_TARGET}
- Modes: ${cam.ATLAS_PRODUCT_CAMERA_MODES.join(', ')}
- Runtime: glm.perspective + setCameraMode wired
`;

writeFileSync(join(outDir, 'atl2-d03-product-camera-modes.md'), report);
writeFileSync(
  join(outDir, 'atl2-d03-product-camera-modes.json'),
  JSON.stringify(
    {
      verdict: 'CLEAR',
      modes: [...cam.ATLAS_PRODUCT_CAMERA_MODES],
      productTarget: target.ATLAS_PRODUCT_3D_TARGET,
    },
    null,
    2,
  ),
);

console.log('atl2-d03-product-camera-modes self-test: PASS (CLEAR)');
console.log(
  `report: ${join(outDir, 'atl2-d03-product-camera-modes.md')}${writeEvidence ? '' : ' (transient)'}`,
);
