#!/usr/bin/env node
/**
 * world-map-scriptony-port-check — #580 world tile map port structure.
 * Location: scripts/world-map-scriptony-port-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`World map Scriptony port check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migration = 'archive/supabase-legacy/supabase/migrations/068_world_maps.sql';
if (!existsSync(join(root, migration))) fail(`missing ${migration}`);
const mig = read(migration);
requireMatch(mig, /world_maps/i, 'world_maps table');
requireMatch(mig, /get_world_map/i, 'get_world_map');
requireMatch(mig, /save_world_map/i, 'save_world_map');
requireMatch(mig, /world-map-pins/i, 'storage bucket');
requireMatch(mig, /1 und 60/i, 'size soft-cap');
requireMatch(mig, /Base64|data:%/i, 'reject Base64 pins');

const registry = read('src/domains/world/worldModuleRegistry.ts');
requireMatch(registry, /id:\s*'map'/i, 'map module registry');
requireMatch(registry, /customEditor:\s*true/i, 'customEditor');

const components = [
  'src/app/world/map/WorldMapEditorScreen.tsx',
  'src/app/world/map/WorldMapToolbar.tsx',
  'src/app/world/map/WorldMapCanvas.tsx',
  'src/app/world/map/WorldMapSidebar.tsx',
  'src/app/world/map/WorldMapPinDialogs.tsx',
  'src/app/world/map/WorldMapPlayerView.tsx',
  'src/app/world/map/useWorldMapEditor.ts',
];
for (const file of components) {
  if (!existsSync(join(root, file))) fail(`missing ${file}`);
  const content = read(file);
  if (/\bas any\b|from ['\"]motion|framer-motion|unsplash/i.test(content)) {
    fail(`${file} must not use as any / motion / unsplash`);
  }
  if (!/min-h-11|data-au-surface|touch-none|pointer/i.test(content) && file.includes('Canvas')) {
    fail(`${file} needs pointer/touch handling`);
  }
}

requireMatch(read('src/app/world/map/WorldMapCanvas.tsx'), /onPointerDown/i, 'pointer events');
requireMatch(read('src/app/world/map/WorldMapCanvas.tsx'), /PIN_COLOR_CYAN|PIN_COLOR_GOLD/i, 'brand pins');
requireMatch(read('src/app/world/profile-editor/WorldProfileEditorDialog.tsx'), /WorldMapEditorScreen/i, 'editor mount');
requireMatch(read('scripts/apply-migrations.sh'), /068_world_maps\.sql/, 'apply-migrations');
requireMatch(read('scripts/test-gate.mjs'), /world-map-scriptony-port-check\.mjs/, 'test-gate');

const hook = read('src/app/world/map/useWorldMapEditor.ts');
requireMatch(hook, /export function useWorldMapEditor/i, 'hook export');
requireMatch(hook, /useState|useRef|useEffect/i, 'allowed hooks');
if (/\buseCallback\b|\buseMemo\b/.test(hook)) fail('hook must not use useCallback/useMemo');

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/world-map-scriptony-port-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'map.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/world/map/index.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
});
const mod = await import(pathToFileURL(out).href);
if (mod.MAX_MAP_SIZE !== 60) fail('MAX_MAP_SIZE must be 60');
const parsed = mod.parseWorldMapData({
  size: 100,
  tiles: { '0,0': { type: 'grass' } },
  pins: [{ id: 'p', x: 0, y: 0, title: 'T', imagePath: 'data:image/png;base64,xxx', discovered: true }],
});
if (parsed.size !== 60) fail('size must clamp to 60');
if (parsed.pins.length !== 0) fail('data-URL pins must be rejected');

console.log('World map Scriptony port check OK');
