#!/usr/bin/env node
/**
 * atlas-worldbuilder-geometry-check — map frames / LOD anchors (#722).
 * Location: scripts/atlas-worldbuilder-geometry-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-geometry-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-worldbuilder-geometry.md', ['#722', 'independentPrimaryBounds']);
mustInclude('src/domains/world/atlas/map-frame.ts', [
  'independentPrimaryBounds',
  'canLodEnterChildMap',
  'UNLOCATED_MAP_HINT_DE',
  'ATLAS_FEATURE_OWNERS',
  'unlocatedChildMapGeneratorMeta',
]);
mustInclude('src/app/world/atlas/useWorldAtlasEditor.ts', [
  'independentPrimaryBounds',
  'unlocatedChildMapGeneratorMeta',
  'never clone parent bounds',
]);
mustInclude('src/domains/world/places/atlas-place-nav.ts', [
  'located',
  'item.located',
  '#722',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'data-atlas-unlocated-hint',
  'UNLOCATED_MAP_HINT_DE',
]);

const createChild = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
if (/bounds:\s*map\.bounds/.test(createChild) && createChild.includes('createChildMap')) {
  // Ensure createChildMap block no longer uses map.bounds
  const idx = createChild.indexOf('const createChildMap');
  const slice = createChild.slice(idx, idx + 1200);
  if (slice.includes('bounds: map.bounds')) {
    fail('createChildMap must not clone parent bounds');
  }
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-geometry-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/map-frame.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const bounds = mod.independentPrimaryBounds();
if (bounds.minX !== 0 || bounds.maxX !== 1000) fail('independent bounds unexpected');

const unlocated = mod.extractMapFrameFromGeneratorMeta({ mapStatus: 'unlocated' });
if (mod.canLodEnterChildMap(unlocated)) fail('unlocated must not LOD-enter');

const ready = mod.extractMapFrameFromGeneratorMeta({
  mapStatus: 'ready',
  mapFrame: {
    parentAnchor: {
      parentMapId: 'p1',
      centerX: 100,
      centerY: 200,
      extentX: 10,
      extentY: 10,
      rotationRad: 0,
      metersPerUnit: null,
    },
  },
});
if (!mod.canLodEnterChildMap(ready)) fail('ready+anchor must LOD-enter');

if (mod.atlasZoomCaption(100, null) !== '100%') fail('zoom caption must stay abstract %');
if (!mod.atlasZoomCaption(50, 2).includes('kalibriert')) fail('calibrated caption missing');

const seed = mod.unlocatedChildMapGeneratorMeta({ placeId: 'x' });
if (seed.mapStatus !== 'unlocated') fail('child seed must be unlocated');
if (!mod.ATLAS_FEATURE_OWNERS.political || !mod.ATLAS_FEATURE_OWNERS.terrain) {
  fail('feature owners incomplete');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-geometry-check.mjs')) {
  fail('test-gate must invoke geometry check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-geometry-check: OK');
