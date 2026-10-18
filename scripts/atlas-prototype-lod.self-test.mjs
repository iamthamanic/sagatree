#!/usr/bin/env node
/**
 * Self-test: HTML prototype LOD/level model ported into domain.
 * Location: scripts/atlas-prototype-lod.self-test.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-prototype-lod self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const srcPath = path.join(root, 'src/domains/world/atlas/atlas-prototype-lod.ts');
const src = fs.readFileSync(srcPath, 'utf8');

assert(src.includes("id: 'world'"), 'world level');
assert(src.includes("id: 'region'"), 'region level');
assert(src.includes("id: 'city'"), 'city level');
assert(src.includes("id: 'dungeon'"), 'dungeon level');
assert(src.includes("id: 'room'"), 'room level');
assert(src.includes('atlasPrototypeLevelFromView'), 'levelFromView port');
assert(src.includes('atlasPrototypeApplyLod'), 'applyLod port');
assert(src.includes('ATLAS_PROTOTYPE_HOTSPOTS'), 'hotspots');
assert(src.includes("label: 'Welt'"), 'Welt root label');
assert(!src.includes("label: 'Eldoria'"), 'no Eldoria as stage label');

const editorPath = path.join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx');
const editor = fs.readFileSync(editorPath, 'utf8');
assert(editor.includes('ATLAS_PROTOTYPE_LEVELS'), 'editor uses prototype levels');
assert(editor.includes('ATLAS_PROTOTYPE_LAYER_LABELS'), 'editor uses prototype layers');
assert(editor.includes('data-atlas-hotspot'), 'hotspot chrome');
assert(editor.includes('Zur Weltkarte'), 'home action copy');

const esbuildBin = path.join(root, 'node_modules/.bin/esbuild');
assert(fs.existsSync(esbuildBin), 'esbuild available');
const out = path.join(root, '.qa/tmp/atlas-prototype-lod-bundle.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(
  esbuildBin,
  [srcPath, '--bundle', '--format=esm', '--platform=neutral', `--outfile=${out}`],
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href);
assert(mod.ATLAS_PROTOTYPE_LEVELS.length === 5, 'five stages');
assert(
  mod.atlasPrototypeLevelFromView({ x: 500, y: 500 }, 0.4, 500) === 'world',
  'zoomed-out = world',
);
assert(mod.atlasPrototypeNextLevel('world') === 'region', 'next from world');
assert(mod.atlasPrototypeNextLevel('room') === 'room', 'room is finest');
const lod = mod.atlasPrototypeApplyLod(2, 500, {
  terrain: true,
  region: true,
  city: true,
  interior: true,
  objects: true,
  grid: false,
});
assert(typeof lod.mapWorld === 'boolean', 'lod mapWorld');

console.log('atlas-prototype-lod self-test: PASS');
