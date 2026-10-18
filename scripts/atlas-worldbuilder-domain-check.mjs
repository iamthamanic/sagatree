#!/usr/bin/env node
/**
 * atlas-worldbuilder-domain-check — WorldNodeKind hierarchy + legacy map (#714).
 * Location: scripts/atlas-worldbuilder-domain-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-domain-check failed: ${msg}`);
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

mustInclude('.qa/design/atlas-worldbuilder-contract.md', ['WorldNodeKind', 'continent', 'country']);
mustInclude('.qa/acceptance/atlas-worldbuilder-domain.md', ['#714', 'WorldNodeKind']);
mustInclude('src/domains/world/hierarchy/world-node.types.ts', [
  'WORLD_NODE_KINDS',
  'continent',
  'country',
  'place',
  'building',
  'room',
]);
mustInclude('src/domains/world/hierarchy/world-hierarchy.ts', [
  'isAllowedParent',
  'requiredParentKind',
  'missingAncestorKinds',
]);
mustInclude('src/domains/world/hierarchy/legacy-kind-map.ts', [
  'needs-review',
  'compat-alias',
  'mappingForPlaceKind',
  'mappingForPrototypeNavKind',
]);
mustInclude('src/domains/world/index.ts', ["'./hierarchy'"]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'world-hierarchy-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuildNative = join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const esbuild = existsSync(esbuildBin) ? esbuildBin : esbuildNative;
if (!existsSync(esbuild)) fail('esbuild missing');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/hierarchy/index.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);

const kinds = mod.WORLD_NODE_KINDS;
if (!Array.isArray(kinds) || kinds.length !== 5) fail('expected 5 WorldNodeKinds');

// Parent matrix — all five child kinds
const edges = [
  ['continent', null, true],
  ['country', 'continent', true],
  ['place', 'country', true],
  ['building', 'place', true],
  ['room', 'building', true],
];
for (const [child, parent, ok] of edges) {
  if (mod.isAllowedParent(child, parent) !== ok) {
    fail(`isAllowedParent(${child}, ${parent}) expected ${ok}`);
  }
}

const rejected = [
  ['place', 'continent'],
  ['place', null],
  ['building', 'country'],
  ['room', 'place'],
  ['country', 'country'],
  ['continent', 'continent'],
  ['country', null],
];
for (const [child, parent] of rejected) {
  if (mod.isAllowedParent(child, parent)) {
    fail(`isAllowedParent(${child}, ${parent}) should reject`);
  }
  const edge = mod.assertHierarchyEdge(child, parent);
  if (edge.ok) fail(`assertHierarchyEdge(${child}, ${parent}) should fail`);
}

// Legacy coverage — every known WorldPlaceKind / map kind / prototype nav
const placeKinds = [
  'continent',
  'realm',
  'region',
  'settlement',
  'district',
  'site',
  'building',
  'interior',
  'dungeon',
  'area',
];
for (const k of placeKinds) {
  const row = mod.mappingForPlaceKind(k);
  if (!row || row.legacy !== k) fail(`place mapping missing for ${k}`);
  if (k === 'region' || k === 'site' || k === 'interior' || k === 'dungeon' || k === 'district') {
    if (row.status !== 'needs-review') fail(`${k} must be needs-review`);
  }
  if (k === 'settlement' || k === 'area' || k === 'realm') {
    if (row.status !== 'compat-alias' || !row.nodeKind) fail(`${k} must be compat-alias`);
  }
}

const mapKinds = ['world', 'region', 'settlement', 'scene', 'legacy_tiles'];
for (const k of mapKinds) {
  const row = mod.mappingForMapKind(k);
  if (!row) fail(`map mapping missing for ${k}`);
}

const nav = ['world', 'kontinent', 'land', 'ort', 'gebaeude', 'raum'];
for (const k of nav) {
  const row = mod.mappingForPrototypeNavKind(k);
  if (!row) fail(`prototype mapping missing for ${k}`);
}

const missing = mod.missingAncestorKinds('room', null);
if (missing.join(',') !== 'continent,country,place,building') {
  fail(`missing ancestors for room: ${missing.join(',')}`);
}

if (mod.statusAfterRename('placeholder') !== 'draft') fail('placeholder rename → draft');
if (mod.tryNodeKindFromPlaceKind('region') !== null) fail('region must not auto-map');
if (mod.tryNodeKindFromPlaceKind('settlement') !== 'place') fail('settlement → place');

if (!String(mod.labelDeForKind('country').singular).includes('Land')) {
  fail('DE label for country');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-domain-check.mjs')) {
  fail('test-gate must invoke atlas-worldbuilder-domain-check.mjs');
}

console.log('atlas-worldbuilder-domain-check: OK');
