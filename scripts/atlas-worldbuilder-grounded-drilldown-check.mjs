#!/usr/bin/env node
/**
 * atlas-worldbuilder-grounded-drilldown-check — anchored 3D drill (#752).
 * Location: scripts/atlas-worldbuilder-grounded-drilldown-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evid = join(root, '.qa/evidence/atlas-followup-grounded-drilldown');

function fail(msg) {
  console.error(`atlas-worldbuilder-grounded-drilldown-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-followup-grounded-drilldown.md', [
  '#752',
  'canWebglDrillSelect',
  'assertParentSpatialAnchor',
  'located',
]);

mustInclude('src/domains/world/atlas/map-frame.ts', [
  'assertParentSpatialAnchor',
  'canWebglDrillSelect',
  'canLodEnterChildMap',
  'ATLAS_FEATURE_OWNERS',
]);

mustInclude('src/domains/world/places/atlas-webgl-nav-tree.ts', [
  'located',
  'isGroundedLinkAnchor',
]);

mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  'isUnlocatedProductMap',
  'productNavActive()',
  'Ausschnitt noch nicht festgelegt',
  'Zoom-Einstieg nur über verortete Primärkarten',
  'mapSketchStatus',
]);

mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', ['mapSketchStatus=']);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
mkdirSync(evid, { recursive: true });

const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const frameBundle = join(outDir, 'atlas-grounded-frame-bundle.mjs');
const buildFrame = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/map-frame.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${frameBundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (buildFrame.status !== 0) fail(`esbuild frame: ${buildFrame.stderr || buildFrame.stdout}`);
const frame = await import(pathToFileURL(frameBundle).href);

const bad = frame.assertParentSpatialAnchor({ parentMapId: 'm', centerX: 1, centerY: 2, extentX: 0, extentY: 1 });
if (bad.ok) fail('zero extent must fail');

const good = frame.assertParentSpatialAnchor({
  parentMapId: 'parent-map',
  centerX: 100,
  centerY: 200,
  extentX: 20,
  extentY: 15,
  rotationRad: 0,
  metersPerUnit: null,
});
if (!good.ok) fail('valid anchor must pass');

if (frame.canWebglDrillSelect({ worldRoot: true, located: false, mapId: null }) !== true) {
  fail('world root drill must allow');
}
if (frame.canWebglDrillSelect({ worldRoot: false, located: false, mapId: 'm1' }) !== false) {
  fail('unlocated child must block drill');
}
if (frame.canWebglDrillSelect({ worldRoot: false, located: true, mapId: 'm1' }) !== true) {
  fail('located child must allow drill');
}

if (!frame.ATLAS_FEATURE_OWNERS.political || !frame.ATLAS_FEATURE_OWNERS.terrain) {
  fail('feature owners missing');
}

const treeBundle = join(outDir, 'atlas-grounded-tree-bundle.mjs');
const buildTree = spawnSync(
  esbuild,
  [
    'src/domains/world/places/atlas-webgl-nav-tree.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${treeBundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (buildTree.status !== 0) fail(`esbuild tree: ${buildTree.stderr || buildTree.stdout}`);
const treeMod = await import(pathToFileURL(treeBundle).href);

const tree = treeMod.buildAtlasWebglNavTree({
  worldProfileId: 'w1',
  worldLabel: 'Donalu',
  worldPrimaryMapId: 'map-world',
  places: [
    {
      id: 'p-city',
      worldProfileId: 'w1',
      parentPlaceId: null,
      kind: 'settlement',
      name: 'Dornhain',
      status: 'canonical',
      sortOrder: 0,
    },
    {
      id: 'p-cave',
      worldProfileId: 'w1',
      parentPlaceId: 'p-city',
      kind: 'building',
      name: 'Höhle',
      status: 'draft',
      sortOrder: 1,
    },
  ],
  links: [
    {
      id: 'l1',
      placeId: 'p-city',
      mapId: 'map-country',
      usage: 'overview',
      anchor: { x: 120, y: 340 },
    },
    {
      id: 'l2',
      placeId: 'p-cave',
      mapId: 'map-cave',
      usage: 'primary',
      anchor: {},
    },
  ],
});

const city = tree.nodes.find((n) => n.id === 'p-city');
const cave = tree.nodes.find((n) => n.id === 'p-cave');
if (!city?.located) fail('city with numeric anchor must be located');
if (cave?.located) fail('cave without numeric anchor must be unlocated');

writeFileSync(
  join(evid, 'drill-matrix.json'),
  JSON.stringify(
    {
      cityLocated: city.located,
      caveLocated: cave.located,
      assertZeroExtentRejected: !bad.ok,
      assertValidOk: good.ok,
      featureOwners: Object.keys(frame.ATLAS_FEATURE_OWNERS),
    },
    null,
    2,
  ) + '\n',
);

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-grounded-drilldown-check.mjs')) {
  fail('test-gate must invoke grounded drilldown check');
}

for (const b of [frameBundle, treeBundle]) {
  try {
    unlinkSync(b);
  } catch {
    /* ignore */
  }
}

console.log('atlas-worldbuilder-grounded-drilldown-check: OK');
