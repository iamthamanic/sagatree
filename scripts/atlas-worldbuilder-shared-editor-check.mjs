#!/usr/bin/env node
/**
 * atlas-worldbuilder-shared-editor-check — controlled WebGL store (#721).
 * Location: scripts/atlas-worldbuilder-shared-editor-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-shared-editor-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-shared-editor.md', ['#721', 'webglRuntimeV3']);
mustInclude('src/domains/world/atlas/webgl-runtime-bridge.ts', [
  'WEBGL_RUNTIME_META_KEY',
  'webglRuntimeV3',
  'parseWebglRuntimeState',
  'readLegacyWebglLocalStorage',
  'syncWebglPropsIntoCanvasDoc',
]);
mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  'controlled',
  'onExternalPersist',
  'seedState',
  'persist({bootstrap:true})',
]);
mustInclude('supabase/migrations/106_atlas_get_map_overload_fix.sql', [
  'DROP FUNCTION IF EXISTS public.get_world_atlas_map(UUID, BOOLEAN)',
  '#721',
]);
mustInclude('src/app/world/atlas/unified/AtlasNative3dEditor.tsx', [
  'controlled',
  'seedState',
  'onPersist',
  'data-atlas-controlled',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'webglRuntime',
  'onWebglRuntimeChange',
  'surfaceMode',
  'handleWebglPersist',
]);
mustInclude('src/app/world/atlas/useWorldAtlasEditor.ts', [
  'webglRuntime',
  'mergeWebglRuntimeIntoGeneratorMeta',
  'extractWebglRuntimeFromGeneratorMeta',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'onWebglRuntimeChange',
  'data-atlas-controlled-store',
  '1400',
]);

const runtime = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
if (!runtime.includes('if(controlled){')) {
  fail('runtime must skip localStorage SoT when controlled');
}
if (!/controlled&&seedState/.test(runtime) && !/controlled&&seedState/.test(runtime.replace(/\s/g, ''))) {
  // allow spaced form
}
if (!runtime.includes('controlled&&seedState') && !runtime.includes('controlled && seedState')) {
  fail('controlled seed path missing');
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-shared-editor-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/webgl-runtime-bridge.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const sample = {
  props: [{ id: 'o1', type: 'house', x: 10, z: 20, size: 1, rotation: 0 }],
  strokes: [],
  walls: [],
  layers: { world: true },
};
const parsed = mod.parseWebglRuntimeState(sample);
if (!parsed) fail('parseWebglRuntimeState rejected valid sample');
const meta = mod.mergeWebglRuntimeIntoGeneratorMeta({}, parsed);
if (!meta.webglRuntimeV3) fail('merge missing webglRuntimeV3');
const back = mod.extractWebglRuntimeFromGeneratorMeta(meta);
if (!back || back.props.length !== 1) fail('round-trip extract failed');

const emptyDoc = {
  format: 'sagatree-unified-canvas-v1',
  layers: {
    terrain: true,
    roads: true,
    rooms: true,
    walls: true,
    objects: true,
    labels: true,
    grid: false,
  },
  strokes: [],
  objects: [],
  rooms: [],
  walls: [],
  demoSeed: false,
};
const synced = mod.syncWebglPropsIntoCanvasDoc(emptyDoc, parsed);
if (!synced.objects.some((o) => o.id === 'o1' && o.type === 'haus')) {
  fail('syncWebglPropsIntoCanvasDoc did not map house→haus with stable id');
}

const fakeStorage = {
  getItem: (k) => (k === mod.LEGACY_WEBGL_LOCAL_STORAGE_KEY ? JSON.stringify(sample) : null),
};
const legacy = mod.readLegacyWebglLocalStorage(fakeStorage);
if (!legacy || legacy.props.length !== 1) fail('legacy localStorage import failed');

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-shared-editor-check.mjs')) {
  fail('test-gate must invoke shared-editor check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-shared-editor-check: OK');
