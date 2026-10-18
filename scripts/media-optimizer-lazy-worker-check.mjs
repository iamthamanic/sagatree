#!/usr/bin/env node
/**
 * media-optimizer-lazy-worker-check — worker isolation + resource limits (#632).
 * Location: scripts/media-optimizer-lazy-worker-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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

section('1 · files');

const paths = [
  'src/infrastructure/media/optimizer/engines/image/image.worker.ts',
  'src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts',
  'src/infrastructure/media/optimizer/engines/image/resource-limits.ts',
];
for (const p of paths) {
  check(existsSync(join(root, p)), `exists ${p}`);
}

const client = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts'),
  'utf8',
);
const optimize = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/engines/image/optimize-image.ts'),
  'utf8',
);
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
const facade = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/media-optimizer.ts'),
  'utf8',
);

check(/new Worker\(new URL\('\.\/image\.worker\.ts'/.test(client), 'Vite worker URL pattern');
check(/encodeOnMainThread|encodeWebpUnderBudget/.test(client), 'browser/main-thread fallback');
check(/terminate\(\)/.test(client), 'abort terminates worker');
check(/encodeWebpWithWorkerFallback/.test(optimize), 'optimize uses worker fallback');
check(/assertImageInputByteLimit/.test(optimize) && /assertImagePixelLimit/.test(optimize), 'resource limits');
check(/jsquash-webp/.test(vite), 'vite manualChunks jsquash');
check(
  /optimizeDeps[\s\S]*exclude[\s\S]*@jsquash\/webp/.test(vite),
  'vite optimizeDeps excludes @jsquash/webp (WASM sibling path)',
);
check(!/from ['"]@jsquash\/webp['"]/.test(facade), 'facade no static jsquash');
check(!/ffmpeg/i.test(client + optimize), 'no ffmpeg');

section('2 · resource limit helpers');

const outdir = join(root, 'node_modules', '.cache', 'media-optimizer-lazy-worker-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
const entry = join(outdir, 'limits-entry.ts');
writeFileSync(
  entry,
  `export {
  IMAGE_ENGINE_MAX_INPUT_BYTES,
  IMAGE_ENGINE_MAX_PIXELS,
  assertImageInputByteLimit,
  assertImagePixelLimit,
  computeImageDownscaleFactor,
} from '${join(root, 'src/infrastructure/media/optimizer/engines/image/resource-limits.ts').replace(/\\/g, '/')}';
`,
);
execFileSync(
  esbuild,
  [entry, '--bundle', '--format=esm', `--outfile=${join(outdir, 'limits.mjs')}`],
  { stdio: 'inherit' },
);
const limits = await import(pathToFileURL(join(outdir, 'limits.mjs')).href);

check(limits.assertImageInputByteLimit(100).ok === true, 'small input ok');
check(
  limits.assertImageInputByteLimit(limits.IMAGE_ENGINE_MAX_INPUT_BYTES + 1).ok === false,
  'over input bytes',
);
check(limits.assertImagePixelLimit(100, 100).ok === true, 'pixels ok');
check(limits.assertImagePixelLimit(9000, 9000).ok === false, 'edge too large');
check(
  limits.assertImagePixelLimit(5000, 5000).ok === false,
  'pixel count over max',
);
check(
  typeof limits.computeImageDownscaleFactor === 'function',
  'downscale factor helper exported',
);
{
  // ~6610×4180 ≈ 27.6M px → must scale below 4096²
  const factor = limits.computeImageDownscaleFactor(6610, 4180, 768, limits.IMAGE_ENGINE_MAX_PIXELS);
  check(factor < 1, 'oversized photo gets scale < 1');
  const outPx = Math.floor(6610 * factor) * Math.floor(4180 * factor);
  check(outPx <= limits.IMAGE_ENGINE_MAX_PIXELS, 'scaled pixels within engine ceiling');
  check(Math.max(Math.floor(6610 * factor), Math.floor(4180 * factor)) <= 768, 'respects maxEdge');
}
check(
  /blobToImageDataFittingLimits/.test(optimize),
  'optimize-image uses fitting decode (auto-downscale)',
);

section('3 · app entry graph does not statically pull jsquash');

const mainSrc = readFileSync(join(root, 'src/main.tsx'), 'utf8');
check(!/@jsquash\/webp/.test(mainSrc), 'main.tsx no jsquash');
check(!/media\/optimizer/.test(mainSrc), 'main.tsx no optimizer import');

if (failures > 0) {
  console.error(`media-optimizer-lazy-worker-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('media-optimizer-lazy-worker-check: ok');
