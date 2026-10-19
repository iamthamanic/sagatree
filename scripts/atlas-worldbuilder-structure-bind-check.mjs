#!/usr/bin/env node
/**
 * atlas-worldbuilder-structure-bind-check — DB-fed Weltstruktur (#718).
 * Location: scripts/atlas-worldbuilder-structure-bind-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-structure-bind-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-structure-bind.md', ['#718', 'Weltstruktur']);
mustInclude('src/domains/world/places/atlas-place-nav.ts', [
  'usage === \'primary\'',
  'archived',
  'buildAtlasPlaceNav',
]);
mustInclude('src/domains/world/places/parse-world-place.ts', ["'primary'"]);
mustInclude('src/app/world/places/WorldPlacesPanel.tsx', [
  'Weltstruktur',
  'renameNode',
  'Platzhalter',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'data-atlas-weltstruktur',
  'placeNav',
  'Weltstruktur',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-place-nav-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/places/atlas-place-nav.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const places = [
  {
    id: 'p1',
    worldProfileId: 'w',
    parentPlaceId: null,
    kind: 'continent',
    name: 'Nordkontinent',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
    revision: 1,
  },
];
const links = [
  {
    id: 'l1',
    worldProfileId: 'w',
    placeId: 'p1',
    mapId: 'm1',
    usage: 'primary',
    featureId: null,
    anchor: {},
  },
];
const nav = mod.buildAtlasPlaceNav(places, links);
if (nav.length !== 1 || nav[0].mapId !== 'm1') fail('primary-only place must appear in nav');

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-structure-bind-check.mjs')) {
  fail('test-gate must invoke structure-bind check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-structure-bind-check: OK');
