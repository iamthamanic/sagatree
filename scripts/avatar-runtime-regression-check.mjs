import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`Avatar runtime regression check failed: missing ${label}.`);
    process.exit(1);
  }
}

function requireDependency(record, name, expected, label) {
  if (!record || record[name] !== expected) {
    console.error(`Avatar runtime regression check failed: ${label}.`);
    process.exit(1);
  }
}

const runtime = read('src/infrastructure/character/avatar/character-studio-runtime.ts');
const canvas = read('src/app/character/avatar/AvatarCanvas.tsx');
const manifests = read('src/infrastructure/character/avatar/avatar-asset-manifests.ts');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

requireMatch(runtime, /new THREE\.WebGLRenderer\(/, 'native Three.js WebGL renderer');
requireMatch(runtime, /new OrbitControls\(this\.camera, canvas\)/, 'OrbitControls bound to the avatar canvas');
requireMatch(runtime, /new GLTFLoader\(\)/, 'GLTFLoader runtime');
requireMatch(runtime, /new VRMLoaderPlugin\(parser\)/, 'VRMLoaderPlugin registration');
requireMatch(runtime, /VRMUtils\.rotateVRM0\(vrm\)/, 'VRM0 orientation normalization');
requireMatch(runtime, /this\.currentVrm\?\.update\(delta\)/, 'VRM per-frame update');
requireMatch(runtime, /this\.resize\(\)/, 'responsive canvas resize in the render loop');
requireMatch(runtime, /const safeUrl = normalizeAvatarModelUrl\(url\)/, 'runtime-level model URL validation');
requireMatch(runtime, /this\.loader\.loadAsync\(safeUrl\)/, 'loader using only the validated model URL');
requireMatch(runtime, /version !== this\.loadVersion/, 'stale async model load protection');
requireMatch(runtime, /VRMUtils\.deepDispose\(root\)/, 'late/stale model disposal');
requireMatch(runtime, /this\.renderer\.setAnimationLoop\(null\)/, 'animation-loop cleanup');
requireMatch(runtime, /this\.controls\.dispose\(\)/, 'OrbitControls cleanup');
requireMatch(runtime, /this\.renderer\.forceContextLoss\(\)/, 'WebGL context cleanup');

requireMatch(manifests, /normalizeAvatarModelUrl\(avatar\.model_url \?\? ''\)/, 'explicit model URL normalization');
requireMatch(manifests, /normalizeAvatarModelUrl\(manifest\.fallbackUrl\)/, 'manifest fallback URL normalization');
requireMatch(canvas, /new CharacterStudioRuntime\(/, 'AvatarCanvas runtime ownership');
requireMatch(canvas, /runtime\.dispose\(\)/, 'AvatarCanvas unmount cleanup');
requireMatch(
  editor,
  /(?:<AvatarCanvas avatar=\{currentAvatar\} canvasRef=\{avatarCanvasRef\} \/>)|(?:AvatarSurfaceViewer[\s\S]*canvasRef=\{avatarCanvasRef\})/,
  'shared live-preview canvas ref',
);
requireMatch(runtime, /capturePortraitDataUrl\(\)/, 'runtime portrait capture from WebGL renderer');
requireMatch(runtime, /fitPortraitCamera\(\)/, 'portrait camera frames head + upper torso');
requireMatch(runtime, /capturePortraitFromRenderer\(this\.renderer\)/, 'portrait uses same renderer path as live preview');
requireMatch(canvas, /capturePortraitBlob/, 'AvatarCanvas exposes framed portrait blob capture');
requireMatch(canvas, /capturePortraitDataUrl\(\)/, 'AvatarCanvas portrait capture goes through studio runtime');
requireMatch(editor, /portraitCaptureRef/, 'CharacterEditor portrait capture handle');
requireMatch(editor, /captureAndUploadPortrait/, 'CharacterEditor portrait upload shares hochladen path');
requireMatch(editor, /pendingAutoPortraitRef/, 'auto portrait after Meshy/import when runtime ready');
requireMatch(runtime, /setInspectMode\(/, 'inspect mode toggles orbit limits');
requireMatch(runtime, /applyCameraFrame\(/, 'camera frame presets');
requireMatch(runtime, /fitRegionCamera\(/, 'region framing helper');
requireMatch(runtime, /applyOrbitLimits\(/, 'default vs inspect orbit limits');
requireMatch(canvas, /AvatarCameraViewControls/, 'camera view controls UI');

const dependencies = packageJson.dependencies;
const devDependencies = packageJson.devDependencies;
const lockRootDependencies = packageLock.packages?.['']?.dependencies;
const lockRootDevDependencies = packageLock.packages?.['']?.devDependencies;

requireDependency(dependencies, 'three', '0.186.1', 'package.json must pin three@0.186.1');
requireDependency(dependencies, '@pixiv/three-vrm', '3.5.1', 'package.json must pin @pixiv/three-vrm@3.5.1');
requireDependency(devDependencies, '@types/three', '0.186.0', 'package.json must pin @types/three@0.186.0');
requireDependency(lockRootDependencies, 'three', '0.186.1', 'package-lock root must match three');
requireDependency(lockRootDependencies, '@pixiv/three-vrm', '3.5.1', 'package-lock root must match @pixiv/three-vrm');
requireDependency(lockRootDevDependencies, '@types/three', '0.186.0', 'package-lock root must match @types/three');

const forbiddenDirectDependencies = [
  '@solana/web3.js',
  '@solana/wallet-adapter-base',
  'ethers',
  'web3',
  'wagmi',
  'viem',
];

for (const dependency of forbiddenDirectDependencies) {
  if (dependency in (dependencies ?? {}) || dependency in (devDependencies ?? {})) {
    console.error(`Avatar runtime regression check failed: forbidden direct Web3 dependency ${dependency}.`);
    process.exit(1);
  }
}

console.log('Avatar runtime regression check passed.');
