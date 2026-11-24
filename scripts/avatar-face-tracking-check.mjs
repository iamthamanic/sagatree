#!/usr/bin/env node
/**
 * avatar-face-tracking-check — deterministic tests for Face Tracking (#12 / #243 / #244).
 * Location: scripts/avatar-face-tracking-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-face-tracking-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/face-tracking-contract.ts');
const index = read('src/domains/character/avatar/index.ts');
const runtime = read('src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts');
const studio = read('src/infrastructure/character/avatar/character-studio-runtime.ts');
const controls = read('src/app/character/avatar/AvatarFaceTrackingControls.tsx');
const liveSurfaceControls = read('src/app/character/liveact/LiveActSurfaceControls.tsx');
const canvas = read('src/app/character/avatar/AvatarCanvas.tsx');
const surfaceViewer = read('src/app/character/avatar/AvatarSurfaceViewer.tsx');
const playerPanel = read('src/app/character/avatar/PlayerAvatarPanel.tsx');
const gmPanel = read('src/app/session/GamemasterPanel.tsx');
const pkg = JSON.parse(read('package.json'));

check(/FACE_TRACKING_CONTRACT_VERSION/.test(domain), 'contract version');
check(/mapFaceTrackingSample/.test(domain), 'sample mapper');
check(/smoothFaceTrackingDrive/.test(domain), 'smoothing');
check(/selectPrimaryFaceIndex/.test(domain), 'primary face rule');
check(/assertFaceTrackingDriveLocalOnly/.test(domain), 'privacy assert');
check(/resolveFaceTrackingFpsCap/.test(domain), 'fps cap');
check(/resolveFaceTrackingQualityProfile/.test(domain), 'quality profile resolver');
check(/FACE_TRACKING_QUALITY_PROFILES/.test(domain), 'quality profiles const');
check(/enableHeadPose/.test(domain), 'mobile head-pose feature cap');
check(!/from ['"]react['"]/.test(domain), 'domain no React');
check(!/from ['"]three['"]/.test(domain), 'domain no Three');
check(!/mediapipe|getUserMedia|HTMLVideoElement/.test(domain), 'domain no MediaPipe/DOM');

check(/export \{[\s\S]*mapFaceTrackingSample/.test(index), 'barrel exports mapper');
check(/FACE_TRACKING_CONTRACT_VERSION/.test(index), 'barrel exports version');
check(/resolveFaceTrackingQualityProfile/.test(index), 'barrel exports quality profile');

check(/AvatarFaceTrackingRuntime/.test(runtime), 'runtime class');
check(/getUserMedia/.test(runtime), 'camera permission path');
check(/explicit user action|Explicit user action/.test(runtime), 'explicit start comment');
check(/visibilitychange/.test(runtime), 'tab visibility pause');
check(/track\.stop/.test(runtime), 'track cleanup');
check(/createMediaPipeFaceTrackingDetector/.test(runtime), 'mediapipe factory');
check(/MEDIAPIPE_VISION_WASM_PATH/.test(runtime), 'self-host wasm path const');
check(/MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH/.test(runtime), 'self-host model path const');
const liveactSource = read('src/infrastructure/character/liveact/mediapipe-face-source.ts');
check(/\/mediapipe\/wasm/.test(liveactSource), 'wasm path /mediapipe/wasm (shared LiveAct source)');
check(/\/mediapipe\/models\/face_landmarker\.task/.test(liveactSource), 'model path first-party (shared LiveAct source)');
check(/from ['"].*liveact\/mediapipe-face-source['"]/.test(runtime), 'runtime re-exports shared MediaPipe paths');
check(!/cdn\.jsdelivr\.net/.test(runtime), 'no jsdelivr CDN in runtime');
check(!/storage\.googleapis\.com/.test(runtime), 'no google storage CDN in runtime');
check(/@mediapipe\/tasks-vision/.test(runtime), 'pinned npm import');
check(/activeFaceTrackingRuntime/.test(runtime), 'singleton active claim');
check(/getActiveFaceTrackingRuntime/.test(runtime), 'singleton getter export');
check(!/localStorage|indexedDB|sessionStorage/.test(runtime), 'no landmark persistence');
check(!/fetch\([^)]*landmark|analytics|postMessage/.test(runtime), 'no landmark upload heur');

check(pkg.dependencies?.['@mediapipe/tasks-vision'] === '1.2.3', 'pinned mediapipe 1.2.3');

check(/applyFaceTrackingDrive/.test(studio), 'studio applies drive');
check(/resetFaceTrackingPose/.test(studio), 'studio resets pose');
check(/bindHumanoidBones/.test(studio), 'humanoid bone bind (head + feet)');
check(/this\.headBone = head/.test(studio), 'head bone assigned for face tracking');
check(!/appearance\.avatar\s*=/.test(studio), 'no appearance write from tracking');

check(/data-avatar-face-tracking-start/.test(controls), 'start control');
check(/data-avatar-face-tracking-stop/.test(controls), 'stop control');
check(/aria-label="Face Tracking starten"/.test(controls), 'start aria');
check(/Lokal im Browser/.test(controls), 'privacy copy');
check(/qualityProfileLabelDe|data-avatar-face-tracking-profile/.test(controls), 'profile label UI');
check(!/AvatarFaceTrackingRuntime/.test(canvas), 'canvas no legacy runtime (#334)');
check(/LiveActSurfaceControls|useLiveActViewport/.test(read('src/app/character/avatar/AvatarSurfaceViewer.tsx')), 'surface owns LiveAct UI');
check(/data-avatar-face-tracking-start/.test(liveSurfaceControls), 'live surface start control');
check(/controlMode/.test(canvas), 'editor vs live control mode');

check(/player-panel/.test(surfaceViewer), 'surface viewer knows player-panel');
check(/data-avatar-face-tracking-bound/.test(surfaceViewer), 'FT bind marker on surface');
check(/controlMode=\{controlMode\}/.test(surfaceViewer) || /controlMode=\{liveSurface/.test(surfaceViewer) || /controlMode={controlMode}/.test(surfaceViewer), 'surface passes controlMode');
check(/AvatarSurfaceViewer/.test(playerPanel), 'player panel shared surface');
check(/enableFaceTracking/.test(playerPanel), 'player panel FT policy prop');
check(/PlayerAvatarPanel/.test(gmPanel), 'GM panel mounts PlayerAvatarPanel');

// Ensure first-party assets exist (vendor from node_modules if needed).
const vendor = spawnSync(process.execPath, [join(root, 'scripts/vendor-mediapipe-face-landmarker.mjs')], {
  cwd: root,
  encoding: 'utf8',
});
check(vendor.status === 0, `vendor mediapipe: ${vendor.stderr || vendor.stdout || 'ok'}`);
const wasmInternal = join(root, 'public/mediapipe/wasm/vision_wasm_internal.wasm');
const modelPath = join(root, 'public/mediapipe/models/face_landmarker.task');
check(existsSync(wasmInternal), 'public mediapipe wasm present');
check(existsSync(modelPath) && statSync(modelPath).size > 100_000, 'public face_landmarker.task present');

// --- bundled domain behavior ---
const outDir = join(root, 'node_modules/.cache/avatar-face-tracking-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'face-tracking.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/face-tracking-contract.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const ft = await import(outfile);

check(ft.selectPrimaryFaceIndex([]) === -1, 'empty faces → -1');
check(ft.selectPrimaryFaceIndex([{ presence: 0.2 }, { presence: 0.9 }]) === 1, 'highest score');
check(ft.selectPrimaryFaceIndex([{ presence: 0.5 }, { presence: 0.5 }]) === 0, 'tie → first');

check(ft.resolveFaceTrackingFpsCap({ isMobile: true }) === 15, 'mobile fps');
check(ft.resolveFaceTrackingFpsCap({ isMobile: false }) === 30, 'desktop fps');

const mobileProfile = ft.resolveFaceTrackingQualityProfile({ isMobile: true });
check(mobileProfile.id === 'mobile', 'mobile profile id');
check(mobileProfile.fpsCap === 15, 'mobile profile fps');
check(mobileProfile.enableHeadPose === false, 'mobile disables head pose matrices');
check(mobileProfile.outputFacialTransformationMatrixes === false, 'mobile no matrices');

const desktopProfile = ft.resolveFaceTrackingQualityProfile({ isMobile: false });
check(desktopProfile.id === 'desktop', 'desktop profile id');
check(desktopProfile.enableHeadPose === true, 'desktop head pose on');

const active = ft.mapFaceTrackingSample({
  presence: 0.9,
  headYaw: 2,
  headPitch: -2,
  headRoll: 0.1,
  eyeLookX: 0.5,
  eyeLookY: -0.2,
  blinkLeft: 0.8,
  blinkRight: 0.2,
  smile: 0.7,
  browDown: 0.1,
  jawOpen: 0.4,
  faceIndex: 0,
  faceCount: 1,
});
check(active.trackingLost === false, 'active not lost');
check(active.head.yaw <= ft.DEFAULT_FACE_TRACKING_LIMITS.maxYaw, 'yaw clamped');
check(active.facialWeights.blink >= 0.79, 'blink from max eye');
check(active.facialWeights.happy >= 0.69, 'smile → happy');
ft.assertFaceTrackingDriveLocalOnly(active);

const lost = ft.mapFaceTrackingSample(ft.createEmptyFaceTrackingSample());
check(lost.trackingLost === true, 'empty → lost');

const smoothed = ft.smoothFaceTrackingDrive(active, lost, 0.5);
check(smoothed.trackingLost === true, 'smooth lost');
check(Math.abs(smoothed.head.yaw) < Math.abs(active.head.yaw), 'ease toward neutral');

console.log('avatar-face-tracking-check PASS');
