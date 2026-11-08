#!/usr/bin/env node
/**
 * media-optimizer-golden-qa-check — V1 golden fixtures + gates (#649).
 * Location: scripts/media-optimizer-golden-qa-check.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

section('1 · docs + acceptance');
for (const p of [
  'docs/media-optimizer-golden-qa.md',
  '.qa/acceptance/media-opt-golden-qa.md',
  'e2e/media-optimizer-golden.spec.ts',
]) {
  check(existsSync(join(root, p)), `exists ${p}`);
}

section('2 · product surfaces wired (portrait / map / look / item / provider)');
const surfaces = [
  {
    name: 'portrait',
    path: 'src/app/character/edit/useCharacterAvatarEditor.ts',
    re: /profileId:\s*['"]character-portrait['"]/,
  },
  {
    name: 'map-pin',
    path: 'src/app/world/map/WorldMapPinDialogs.tsx',
    re: /profileId:\s*['"]map-pin['"]/,
  },
  {
    name: 'look-reference',
    path: 'src/app/look/create/look-reference-adaption.ts',
    re: /profileId:\s*['"]look-reference['"]/,
  },
  {
    name: 'item-thumbnail',
    path: 'src/infrastructure/inventory/item-thumbnail-service.ts',
    re: /profileId:\s*['"]item-thumbnail['"]/,
  },
  {
    name: 'provider-output',
    path: 'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts',
    re: /optimizeProviderThumbnailBytes/,
  },
];
for (const s of surfaces) {
  const src = readFileSync(join(root, s.path), 'utf8');
  check(s.re.test(src), `${s.name} wired in ${s.path}`);
}

section('3 · golden domain fixtures (GIF / alpha / abort / over-budget / bytes)');
const outdir = join(root, 'node_modules', '.cache', 'media-optimizer-golden-qa-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
writeFileSync(
  join(outdir, 'policy-entry.ts'),
  `
export {
  evaluateImageAgainstPolicy,
  getImageAssetPolicy,
} from '${join(root, 'src/domains/media/index.ts').replace(/\\/g, '/')}';
`,
);
execFileSync(
  esbuild,
  [
    join(outdir, 'policy-entry.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'policy.mjs')}`,
  ],
  { stdio: 'inherit' },
);
const policy = await import(pathToFileURL(join(outdir, 'policy.mjs')).href);

const portrait = policy.getImageAssetPolicy('character-portrait');
check(portrait.preserveAlpha === true, 'portrait preserveAlpha');
check(portrait.gifAnimation === 'convert-static-required', 'portrait GIF convert-static');
check(portrait.budget.targetBytes === 1 * 1024 * 1024, 'portrait targetBytes 1MiB');

const gifOk = policy.evaluateImageAgainstPolicy({
  kind: 'image',
  profileId: 'character-portrait',
  mimeType: 'image/gif',
  byteSize: 100_000,
  hasAnimation: true,
});
check(gifOk.ok === true, 'portrait accepts GIF mime for convert-static path');

const mapGif = policy.evaluateImageAgainstPolicy({
  kind: 'image',
  profileId: 'map-pin',
  mimeType: 'image/gif',
  byteSize: 100_000,
});
check(mapGif.ok === false, 'map-pin rejects GIF');

const over = policy.evaluateImageAgainstPolicy({
  kind: 'image',
  profileId: 'item-thumbnail',
  mimeType: 'image/png',
  byteSize: 11 * 1024 * 1024,
});
check(over.ok === false && over.reason === 'over-max-upload', 'item over-budget maxUpload');

const alphaPolicy = policy.getImageAssetPolicy('item-thumbnail');
check(alphaPolicy.preserveAlpha === true, 'item preserveAlpha (alpha golden)');

section('4 · facade abort golden (no WASM)');
writeFileSync(
  join(outdir, 'abort-entry.ts'),
  `
export { optimizeMedia } from '${join(root, 'src/infrastructure/media/optimizer/media-optimizer.ts').replace(/\\/g, '/')}';
`,
);
execFileSync(
  esbuild,
  [
    join(outdir, 'abort-entry.ts'),
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    `--outfile=${join(outdir, 'abort.mjs')}`,
    '--packages=external',
  ],
  { stdio: 'inherit' },
);
const facade = await import(pathToFileURL(join(outdir, 'abort.mjs')).href);
const ac = new AbortController();
ac.abort();
const aborted = await facade.optimizeMedia({
  kind: 'image',
  profileId: 'map-pin',
  mimeType: 'image/png',
  byteSize: 1000,
  signal: ac.signal,
});
check(aborted.status === 'aborted', 'optimizeMedia aborted golden');

section('5 · initial bundle does not static-pull WASM');
const mainSrc = readFileSync(join(root, 'src/main.tsx'), 'utf8');
const facadeSrc = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/media-optimizer.ts'),
  'utf8',
);
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
check(!/@jsquash\/webp/.test(mainSrc), 'main.tsx no jsquash');
check(!/from ['"]@jsquash\/webp['"]/.test(facadeSrc), 'facade no static jsquash');
check(/await import\('\.\/engines\/image/.test(facadeSrc), 'image engine lazy');
check(/jsquash-webp|manualChunks/.test(vite), 'vite isolates jsquash chunk');

// Metafile: bundling only the facade entry must not include wasm binary paths
const metaPath = join(outdir, 'facade.meta.json');
execFileSync(
  esbuild,
  [
    join(root, 'src/infrastructure/media/optimizer/media-optimizer.ts'),
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    '--packages=external',
    `--outfile=${join(outdir, 'facade-only.mjs')}`,
    `--metafile=${metaPath}`,
  ],
  { stdio: 'pipe' },
);
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const inputs = Object.keys(meta.inputs ?? {});
check(!inputs.some((p) => /\.wasm$/i.test(p)), 'facade metafile has no .wasm inputs');
check(
  !inputs.some((p) => /@jsquash\/webp/.test(p)),
  'facade metafile has no @jsquash/webp (lazy)',
);

section('6 · prior media-opt checks still present');
for (const script of [
  'scripts/media-optimizer-contracts-check.mjs',
  'scripts/media-optimizer-image-engine-check.mjs',
  'scripts/media-optimizer-lazy-worker-check.mjs',
  'scripts/media-optimizer-provider-output-check.mjs',
  'scripts/media-optimizer-server-proof-check.mjs',
]) {
  check(existsSync(join(root, script)), script);
}

section('7 · Deno provider proof still green');
const denoAvailable = spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
if (!denoAvailable) {
  console.log('SKIP: Deno binary absent — archive provider unit tests not executed (CUT-21)');
} else {
  const deno = spawnSync(
    'deno',
    [
      'test',
      '--no-lock',
      '--node-modules-dir=auto',
      '--allow-read',
      '--allow-net',
      '--allow-env',
      'archive/supabase-legacy/supabase/functions/_shared/media-server-raster-optimize_test.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  check(deno.status === 0, 'provider optimize unit tests');
}
if (failures > 0) {
  console.error(`\nmedia-optimizer-golden-qa-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('media-optimizer-golden-qa-check: OK');
