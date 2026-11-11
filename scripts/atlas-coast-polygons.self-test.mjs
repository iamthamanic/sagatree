#!/usr/bin/env node
/**
 * atlas-coast-polygons.self-test — polygon rooms + area tool wiring (Step 2).
 * Location: scripts/atlas-coast-polygons.self-test.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-coast-polygons self-test failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${JSON.stringify(n)} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-coast-polygons-area-tool.md', [
  'Fläche zeichnen',
  'points',
]);
mustInclude('src/domains/world/atlas/unified-canvas-doc.ts', [
  " | 'area'",
  'points?:',
  'roomFromPolygon',
]);
mustInclude('src/domains/world/atlas/canvas-polygon.ts', [
  'sanitizePolygonPoints',
  'pointInPolygon',
  'triangulatePolygon',
]);
mustInclude('src/domains/world/atlas/atlas-tool-registry.ts', [
  "id: 'area'",
  "labelDe: 'Fläche'",
  'area: true',
]);
mustInclude('src/domains/world/atlas/webgl-runtime-bridge.ts', [
  'raw.points',
  'points: r.points',
]);
mustInclude('src/domains/world/atlas/dornhain-unified-starter.ts', [
  'landPoly',
  'w.west-core',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'roomFromPolygon',
  "tool === 'area'",
  'areaDraft',
]);
mustInclude(
  'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs',
  [
    'productAreaDraft',
    "tool==='area'",
    'productPolyFill',
    // Codex P2 (#1195): concave coasts use ear-clip triangulation, not a centroid fan.
    'productPolyTriangulate',
  ],
);
mustInclude('server/src/bootstrap/ensure-dornhain-default.ts', [
  'points:',
  'w.west-core',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-coast-polygons-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/index.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);

const poly = mod.roomFromPolygon('t1', 'gras', [
  [0, 0],
  [10, 0],
  [10, 8],
  [0, 8],
]);
if (!poly || !poly.points || poly.points.length !== 4) fail('roomFromPolygon failed');
if (poly.w !== 10 || poly.h !== 8) fail(`bbox wrong ${poly.w}x${poly.h}`);

const bad = mod.roomFromPolygon('t2', 'gras', [
  [0, 0],
  [1, 1],
]);
if (bad !== null) fail('roomFromPolygon must reject <3 points');

const doc = {
  format: mod.UNIFIED_CANVAS_FORMAT,
  layers: mod.defaultUnifiedCanvasLayers(),
  strokes: [],
  objects: [],
  rooms: [poly],
  walls: [],
  demoSeed: false,
};
const ser = mod.serializeUnifiedCanvasDoc(doc);
const parsed = mod.parseUnifiedCanvasDoc(ser);
if (!parsed || !parsed.rooms[0]?.points || parsed.rooms[0].points.length !== 4) {
  fail('parse/serialize round-trip lost points');
}

const reject = mod.parseUnifiedCanvasDoc({
  format: mod.UNIFIED_CANVAS_FORMAT,
  layers: mod.defaultUnifiedCanvasLayers(),
  strokes: [],
  objects: [],
  rooms: [{ id: 'bad', material: 'gras', points: [[0, 0], [1, 1]] }],
  walls: [],
  demoSeed: false,
});
if (reject !== null) fail('parse must reject rooms with <3 points');

if (!mod.pointInPolygon(5, 4, poly.points)) fail('pointInPolygon inside failed');
if (mod.pointInPolygon(50, 50, poly.points)) fail('pointInPolygon outside failed');

const tools = mod.atlasToolsForKind(null).map((t) => t.id);
if (!tools.includes('area')) fail('world root must expose area tool');

const chrome = mod.webglToolChromeForKind(null);
const areaChrome = chrome.find((c) => c.atlasId === 'area');
if (!areaChrome || areaChrome.runtimeId !== 'area' || !areaChrome.enabled) {
  fail('webgl chrome must enable area on world root');
}

const golden = mod.buildDornhainUnifiedCanvasDoc();
const west = golden.rooms.find((r) => r.id === 'w.west-core');
if (!west?.points || west.points.length < 3) fail('Golden west-core must be polygon');

const runtime = mod.syncCanvasDocIntoWebglRuntime(mod.emptyWebglRuntime(), {
  ...doc,
  rooms: [poly],
});
const webRoom = (runtime.rooms || [])[0];
if (!webRoom || !Array.isArray(webRoom.points) || webRoom.points.length !== 4) {
  fail('bridge roomsToWebgl must keep points');
}
const back = mod.syncWebglPropsIntoCanvasDoc(doc, runtime);
if (!back.rooms[0]?.points || back.rooms[0].points.length !== 4) {
  fail('bridge projectRoomsToCanvas must keep points');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-coast-polygons.self-test.mjs')) {
  fail('test-gate must invoke atlas-coast-polygons self-test');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-coast-polygons self-test: PASS');
