#!/usr/bin/env node
/**
 * liveact-iris-gaze-solver-check — authoritative #446 Iris Gaze gate.
 * Location: scripts/liveact-iris-gaze-solver-check.mjs
 *
 * Proves contract, head-relative gaze, per-eye solve, blendshape fallback,
 * A/B win vs V1 blendshape-only, privacy, no V1 frame pollution.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`liveact-iris-gaze-solver-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const design = join(root, '.qa/design/liveact-iris-gaze-solver.md');
const acceptance = join(root, '.qa/acceptance/liveact-iris-gaze-solver.md');
const gate = read('scripts/test-gate.mjs');
const gitignore = read('.gitignore');

check(existsSync(design), 'design artifact');
check(existsSync(acceptance), 'acceptance artifact');
check(/liveact-iris-gaze-solver/.test(read('.qa/design/liveact-iris-gaze-solver.md')), 'design slug');
check(/#446/.test(read('.qa/acceptance/liveact-iris-gaze-solver.md')), 'acceptance issue');
check(/Iris Geometry Solver/.test(read('.qa/design/liveact-iris-gaze-solver.md')), 'solver vs calib boundary');
check(/checkLiveActIrisGazeSolver|liveact-iris-gaze-solver-check/.test(gate), 'test-gate wiring');
check(/liveact-iris-gaze-local/.test(gitignore), 'local iris capture gitignore');

const domainFiles = [
  'src/domains/character/liveact/liveact-iris-gaze-contract.ts',
  'src/domains/character/liveact/liveact-iris-gaze-solve.ts',
  'src/domains/character/liveact/liveact-iris-gaze-sphere.ts',
  'src/domains/character/liveact/liveact-iris-gaze-fixtures.ts',
  'src/domains/character/liveact/liveact-iris-gaze-ab.ts',
];
for (const rel of domainFiles) {
  const src = read(rel);
  for (const pattern of [/@ts-ignore/, /@ts-expect-error/, /@ts-nocheck/, / as any\b/, / as unknown as /]) {
    check(!pattern.test(src), `${rel} no type escape ${pattern}`);
  }
  check(!/\bMediaPipe\b/.test(src), `${rel} no MediaPipe in domain`);
  check(!/\b474\b|\b469\b/.test(src), `${rel} no iris magic indices in domain`);
}
const abSrc = read('src/domains/character/liveact/liveact-iris-gaze-ab.ts');
const fixSrc = read('src/domains/character/liveact/liveact-iris-gaze-fixtures.ts');
check(/fairBlendshapeGazeFromGeometry/.test(abSrc), 'A/B uses fair blendshape path');
check(/solveGazeFromIrisOnSphere|eyeball-sphere/.test(read('src/domains/character/liveact/liveact-iris-gaze-solve.ts') + abSrc), 'sphere solve wired');
check(!/gain\s*=\s*0\.72/.test(fixSrc), 'no sabotaged blendshape gain');
check(!/\*\s*0\.35/.test(fixSrc) || /fairBlendshapeGazeFromGeometry/.test(fixSrc), 'no head-leak sabotage baseline');
check(/buildDenseFaceLocalFrame/.test(read('src/domains/character/liveact/liveact-iris-gaze-solve.ts')), 'reuses #445 face frame');

check(/LIVEACT_IRIS_GAZE_CONTRACT/.test(read('src/domains/character/liveact/index.ts')), 'barrel exports');
check(/subscribeIrisGaze/.test(read('src/infrastructure/character/liveact/liveact-engine.ts')), 'engine iris side-channel');
check(/arbitrateLiveActGaze/.test(read('src/infrastructure/character/liveact/mediapipe-face-source.ts')), 'source arbitrates iris');
check(
  /MEDIAPIPE_LEFT_IRIS_CONTOUR_INDICES/.test(
    read('src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts'),
  ),
  'infra iris indices',
);
const frameContract = read('src/domains/character/liveact/liveact-contract.ts');
check(!/IrisGaze|irisContour/.test(frameContract), 'V1 frame not polluted');
check(/assertLiveActFrameLocalOnly/.test(frameContract), 'V1 local-only assert');

// Provenance: installed API indices match adapter constants
const adapter = read('src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts');
check(/474,\s*475,\s*476,\s*477/.test(adapter), 'LEFT iris contour indices');
check(/469,\s*470,\s*471,\s*472/.test(adapter), 'RIGHT iris contour indices');
check(!/\b468\b|\b473\b/.test(adapter), 'no undocumented iris center hardcodes');

// Provenance against the installed package (not just the source text): the adapter's contour
// indices must equal FaceLandmarker.FACE_LANDMARKS_{LEFT,RIGHT}_IRIS of the pinned version.
const LEFT_IRIS_CONTOUR = [474, 475, 476, 477];
const RIGHT_IRIS_CONTOUR = [469, 470, 471, 472];
const pinnedMediaPipe = JSON.parse(read('package.json')).dependencies?.['@mediapipe/tasks-vision'];
const installedMediaPipe = JSON.parse(read('node_modules/@mediapipe/tasks-vision/package.json')).version;
check(
  typeof pinnedMediaPipe === 'string' && /^\d+\.\d+\.\d+$/.test(pinnedMediaPipe),
  `@mediapipe/tasks-vision exact pin (got ${pinnedMediaPipe})`,
);
check(installedMediaPipe === pinnedMediaPipe, `installed mediapipe ${installedMediaPipe} == pin ${pinnedMediaPipe}`);
const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
const connectionIndices = (connections) =>
  [...new Set((connections ?? []).flatMap((c) => [c.start, c.end]))].sort((a, b) => a - b);
check(
  JSON.stringify(connectionIndices(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS)) === JSON.stringify(LEFT_IRIS_CONTOUR),
  `FACE_LANDMARKS_LEFT_IRIS@${installedMediaPipe} == ${LEFT_IRIS_CONTOUR.join(',')}`,
);
check(
  JSON.stringify(connectionIndices(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS)) === JSON.stringify(RIGHT_IRIS_CONTOUR),
  `FACE_LANDMARKS_RIGHT_IRIS@${installedMediaPipe} == ${RIGHT_IRIS_CONTOUR.join(',')}`,
);

const privacyRoots = [
  '.qa/evidence/liveact-iris-gaze-solver',
  '.qa/fixtures/liveact-iris-gaze-solver',
];
const bannedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov']);
function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}
for (const rel of privacyRoots) {
  for (const file of walkFiles(join(root, rel))) {
    const lower = file.toLowerCase();
    for (const ext of bannedExt) {
      check(!lower.endsWith(ext), `privacy: no media ${relative(root, file)}`);
    }
  }
}

const outfile = join(root, '.qa/runs/liveact-iris-gaze-solver-bundle.mjs');
mkdirSync(join(root, '.qa/runs'), { recursive: true });
await build({
  entryPoints: [join(root, 'src/domains/character/liveact/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile,
  write: true,
  logLevel: 'silent',
});

const mod = await import(outfile + `?t=${Date.now()}`);

check(mod.LIVEACT_IRIS_GAZE_CONTRACT === 'SagaTreeLiveActIrisGazeV1', 'contract id');

// Directional solve
const leftFix = mod.buildIrisGazeFixture('iris-look-left');
const leftSolved = mod.solveIrisGaze({
  geometry: leftFix.geometry,
  sequence: 1,
  timestampMs: 0,
});
check(leftSolved.faceNormalizationOk, 'look-left norm ok');
check(leftSolved.left.available && leftSolved.left.x > 0.3, 'look-left left.x positive');
check(leftSolved.right.available && leftSolved.right.x > 0.3, 'look-left right.x positive');

const rightFix = mod.buildIrisGazeFixture('iris-look-right');
const rightSolved = mod.solveIrisGaze({
  geometry: rightFix.geometry,
  sequence: 2,
  timestampMs: 0,
});
check(rightSolved.left.x < -0.3, 'look-right left.x negative');

// Golden numerical: known sphere angles recovered within geometric tolerance
const yaw10 = mod.buildIrisGazeFixture('iris-yaw-10');
const yaw10Solved = mod.solveIrisGaze({ geometry: yaw10.geometry, sequence: 10, timestampMs: 0 });
check(Math.abs(yaw10Solved.left.yawDeg - 10) <= 0.5, `golden +10° yaw got ${yaw10Solved.left.yawDeg}`);
const yawNeg = mod.buildIrisGazeFixture('iris-yaw-neg10');
const yawNegSolved = mod.solveIrisGaze({ geometry: yawNeg.geometry, sequence: 11, timestampMs: 0 });
check(Math.abs(yawNegSolved.left.yawDeg - -10) <= 0.5, `golden -10° yaw got ${yawNegSolved.left.yawDeg}`);
const pitch8 = mod.buildIrisGazeFixture('iris-pitch-8');
const pitch8Solved = mod.solveIrisGaze({ geometry: pitch8.geometry, sequence: 12, timestampMs: 0 });
check(Math.abs(pitch8Solved.left.pitchDeg - 8) <= 0.75, `golden +8° pitch got ${pitch8Solved.left.pitchDeg}`);

// Head-relative: neutral under yaw / combined
const headYaw = mod.buildIrisGazeFixture('iris-head-yaw-neutral-eyes');
const headSolved = mod.solveIrisGaze({
  geometry: headYaw.geometry,
  sequence: 3,
  timestampMs: 0,
});
check(headSolved.faceNormalizationOk, 'head yaw norm ok');
check(Math.abs(headSolved.left.x) <= 0.03, `head-yaw left.x~0 got ${headSolved.left.x}`);
check(Math.abs(headSolved.left.y) <= 0.03, `head-yaw left.y~0 got ${headSolved.left.y}`);
check(Math.abs(headSolved.right.x) <= 0.03, 'head-yaw right.x~0');
const headComb = mod.buildIrisGazeFixture('iris-head-combined-neutral-eyes');
const headCombSolved = mod.solveIrisGaze({
  geometry: headComb.geometry,
  sequence: 13,
  timestampMs: 0,
});
check(Math.abs(headCombSolved.left.x) <= 0.03, 'combined head left.x~0');
check(Math.abs(headCombSolved.left.y) <= 0.03, 'combined head left.y~0');

// Convergence allowed (L/R disagree intentionally)
const conv = mod.buildIrisGazeFixture('iris-convergence');
const convSolved = mod.solveIrisGaze({ geometry: conv.geometry, sequence: 14, timestampMs: 0 });
check(convSolved.left.yawDeg < 0 && convSolved.right.yawDeg > 0, 'convergence signs');

// Fallback arbitration — V1 equality when iris unavailable
const missing = mod.buildIrisGazeFixture('iris-missing-contour');
const missingSolved = mod.solveIrisGaze({
  geometry: missing.geometry,
  sequence: 4,
  timestampMs: 0,
});
const blend = { eyeLeftX: 0.4, eyeLeftY: 0, eyeRightX: 0.4, eyeRightY: 0 };
const arb = mod.arbitrateLiveActGaze({ iris: missingSolved, blendshape: blend });
check(arb.fallbackState === 'mixed' || arb.fallbackState === 'blendshape' || arb.fallbackState === 'iris', 'arb state');
check(arb.eyeLeftX === blend.eyeLeftX, 'missing left iris → exact V1 blendshape left');
check(arb.eyeLeftY === blend.eyeLeftY, 'missing left iris → exact V1 blendshape left Y');
check(typeof arb.eyeRightX === 'number', 'right still numeric');

// A/B — must beat fair blendshape baseline
const ab = mod.runIrisGazeAbBenchmark();
check(ab.iris.medianDeg !== null, 'iris median measured');
check(ab.blendshape.medianDeg !== null, 'blendshape median measured');
check(ab.iris.medianStatus === 'PASS', `iris median PASS got ${ab.iris.medianStatus} (${ab.iris.medianDeg})`);
check(ab.iris.p95Status === 'PASS', `iris p95 PASS got ${ab.iris.p95Status} (${ab.iris.p95Deg})`);
check(ab.iris.neutralStatus === 'PASS', `iris neutral PASS got ${ab.iris.neutralStatus}`);
check(ab.irisBeatsBlendshape === true, `iris must beat blendshape (iris=${ab.iris.medianDeg} blend=${ab.blendshape.medianDeg} Δ=${ab.medianImprovementDeg})`);
check(
  ab.medianImprovementDeg !== null && ab.medianImprovementDeg >= mod.LIVEACT_IRIS_AB_MIN_MEDIAN_IMPROVEMENT_DEG,
  `meaningful improvement ≥ ${mod.LIVEACT_IRIS_AB_MIN_MEDIAN_IMPROVEMENT_DEG}° got ${ab.medianImprovementDeg}`,
);
check(ab.headRelativeMaxAbs <= 0.03, `head-relative max ${ab.headRelativeMaxAbs}`);
if (ab.binocularFarDisagreementDeg !== null) {
  check(ab.binocularFarDisagreementDeg <= 2.5, `binocular disagree ${ab.binocularFarDisagreementDeg}`);
}
check(ab.method.iris === 'eyeball-sphere-solve', 'method iris sphere');
check(/planar-aperture/.test(ab.method.blendshape), 'method fair planar V1');

// Determinism
const ab2 = mod.runIrisGazeAbBenchmark();
const h1 = createHash('sha256').update(JSON.stringify(ab)).digest('hex');
const h2 = createHash('sha256').update(JSON.stringify(ab2)).digest('hex');
check(h1 === h2, 'A/B deterministic');

// V1 baseline freeze evidence
const baseline = {
  path: 'MediaPipe eyeLook blendshapes → eyeLeft/Right X/Y → mirror → LiveActFrameV1 → smooth/calibrate → exclusive gaze output (#403)',
  blendshapeOnlyMedianDeg: ab.blendshape.medianDeg,
  blendshapeOnlyP95Deg: ab.blendshape.p95Deg,
  blendshapeNeutralOffsetMax: ab.blendshape.neutralOffsetMax,
  note: 'Frozen synthetic A/B baseline for #446 — not retuned.',
};

mkdirSync(join(root, '.qa/evidence/liveact-iris-gaze-solver'), { recursive: true });
writeFileSync(
  join(root, '.qa/evidence/liveact-iris-gaze-solver/v1-blendshape-gaze-baseline.json'),
  JSON.stringify(baseline, null, 2) + '\n',
);

const summary = {
  contractVersion: mod.LIVEACT_IRIS_GAZE_CONTRACT,
  irisLandmarkProvenance: {
    package: `@mediapipe/tasks-vision@${installedMediaPipe}`,
    leftContour: LEFT_IRIS_CONTOUR,
    rightContour: RIGHT_IRIS_CONTOUR,
    center: 'centroid(contour[4])',
  },
  ab,
  baseline,
  privacy: {
    committedRawIrisSeries: 0,
    committedWebcam: 0,
  },
  authoritativeGate: 'scripts/liveact-iris-gaze-solver-check.mjs',
  deterministicHash: h1,
};

writeFileSync(
  join(root, '.qa/runs/446-iris-gaze-solver-summary.json'),
  JSON.stringify(summary, null, 2) + '\n',
);

console.log('liveact-iris-gaze-solver-check OK');
console.log(
  JSON.stringify(
    {
      irisMedian: ab.iris.medianDeg,
      blendMedian: ab.blendshape.medianDeg,
      improvement: ab.medianImprovementDeg,
      headRelativeMaxAbs: ab.headRelativeMaxAbs,
      irisBeatsBlendshape: ab.irisBeatsBlendshape,
    },
    null,
    2,
  ),
);
