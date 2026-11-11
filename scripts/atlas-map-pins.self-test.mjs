#!/usr/bin/env node
/**
 * Self-test: product atlas map pins, LOD visibility and span-based tool sizes.
 * Location: scripts/atlas-map-pins.self-test.mjs
 *
 * Bundles src/domains/world/atlas/atlas-map-pins.ts and checks it against the
 * import-free 3D runtime constants so 2D Draufsicht and 3D stay in parity.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-map-pins self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const srcPath = path.join(root, 'src/domains/world/atlas/atlas-map-pins.ts');
const runtimePath = path.join(
  root,
  'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs',
);
const runtime = fs.readFileSync(runtimePath, 'utf8');

const esbuildBin = path.join(root, 'node_modules/.bin/esbuild');
assert(fs.existsSync(esbuildBin), 'esbuild available');
const out = path.join(root, '.qa/tmp/atlas-map-pins-bundle.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(
  esbuildBin,
  [srcPath, '--bundle', '--format=esm', '--platform=neutral', `--outfile=${out}`],
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href);

// Map scale follows the owning hierarchy node.
assert(mod.atlasMapScaleForKind(null) === 'world', 'root map = world');
assert(mod.atlasMapScaleForKind('continent') === 'world', 'continent = world');
assert(mod.atlasMapScaleForKind('country') === 'world', 'country = world');
assert(mod.atlasMapScaleForKind('place') === 'settlement', 'place = settlement');
assert(mod.atlasMapScaleForKind('building') === 'interior', 'building = interior');
assert(mod.atlasMapScaleForKind('room') === 'interior', 'room = interior');

// Pins: grounded anchors only, owner skipped, archived skipped, one pin per place.
const place = (id, name, kind, status = 'canonical') => ({ id, name, kind, status });
const link = (placeId, mapId, usage, anchor) => ({ placeId, mapId, usage, anchor });
const places = [
  place('p-town', 'Dornhain', 'settlement'),
  place('p-tavern', 'Taverne', 'building'),
  place('p-crypt', 'Krypta', 'building'),
  place('p-road', 'Whisper Road', 'region'),
  place('p-old', 'Ruine', 'settlement', 'archived'),
  place('p-owner', 'Donalu', 'continent'),
];
const links = [
  link('p-owner', 'm-root', 'primary', {}),
  link('p-town', 'm-root', 'overview', { x: 360, y: 510 }),
  link('p-town', 'm-root', 'overview', { x: 1, y: 1 }),
  link('p-tavern', 'm-root', 'overview', { x: 328, y: 528 }),
  link('p-crypt', 'm-root', 'overview', { x: 406, y: 462 }),
  link('p-road', 'm-root', 'overview', {}),
  link('p-old', 'm-root', 'overview', { x: 10, y: 10 }),
  link('p-tavern', 'm-town', 'overview', { x: 50, y: 50 }),
];
assert(mod.atlasMapOwnerPlace('m-root', places, links)?.id === 'p-owner', 'primary link = owner');
assert(mod.atlasMapOwnerPlace(null, places, links) === null, 'no owner without map');
const pins = mod.buildAtlasMapPins({ mapId: 'm-root', places, links });
assert(
  JSON.stringify(pins.map((p) => p.id)) === JSON.stringify(['p-town', 'p-crypt', 'p-tavern']),
  `pins sorted by kind then label: ${JSON.stringify(pins.map((p) => p.id))}`,
);
assert(pins[0].x === 360 && pins[0].y === 510, 'first anchor wins');
assert(pins[0].kind === 'place' && pins[1].kind === 'building', 'node kinds mapped');
assert(mod.buildAtlasMapPins({ mapId: null, places, links }).length === 0, 'no map, no pins');

// LOD: world maps hide building pins until span < 140, room pins until span < 45.
const building = { kind: 'building' };
const room = { kind: 'room' };
assert(mod.atlasMapPinVisible(building, 'world', 530) === false, 'building hidden at world fit');
assert(mod.atlasMapPinVisible(building, 'world', 110) === true, 'building visible at place zoom');
assert(mod.atlasMapPinVisible(room, 'world', 60) === false, 'room hidden above 45');
assert(mod.atlasMapPinVisible(room, 'world', 30) === true, 'room visible below 45');
assert(mod.atlasMapPinVisible(room, 'interior', 530) === true, 'interior shows every pin');
assert(mod.atlasMapPinVisible({ kind: 'place' }, 'world', 530) === true, 'places always visible');

// Focus span: fixed per kind on world maps, zoom-in only elsewhere.
assert(mod.atlasMapPinFocusSpan(building, 'world', 530) === 34, 'building focus span');
assert(mod.atlasMapPinFocusSpan({ kind: null }, 'world', 530) === 110, 'unknown kind = place');
assert(mod.atlasMapPinFocusSpan(room, 'interior', 300) === 60, 'interior caps at 60');
assert(mod.atlasMapPinFocusSpan(room, 'interior', 20) === 20, 'interior never zooms out');
assert(mod.atlasMapPinFocusSpan(building, 'settlement', 500) === 160, 'settlement caps at 160');

// Span-based tool sizes (clamped like the 3D runtime).
assert(Math.abs(mod.atlasProductBrushWidth(100, 35) - 6) < 1e-9, 'brush = span * 0.06 at 35');
assert(mod.atlasProductBrushWidth(1, 35) === 0.2, 'brush min clamp');
assert(mod.atlasProductBrushWidth(9000, 70) === 200, 'brush max clamp');
assert(mod.atlasProductStampSize(295.6, 1) === 0.296, 'stamp = round(span * scale) / 1000');
assert(mod.atlasProductStampSize(5, 1) === 0.02, 'stamp min clamp');
assert(mod.atlasProductStampSize(9000, 1) === 4, 'stamp max clamp');

// Parity with the import-free 3D runtime (PRODUCT_PIN_SPAN, productPinVisible, tool sizes).
const spanMatch = runtime.match(/PRODUCT_PIN_SPAN=\{([^}]+)\}/);
assert(spanMatch, '3D runtime declares PRODUCT_PIN_SPAN');
const runtimeSpans = Object.fromEntries(
  spanMatch[1].split(',').map((pair) => {
    const [k, v] = pair.split(':');
    return [k.trim(), Number(v)];
  }),
);
assert(
  JSON.stringify(runtimeSpans) === JSON.stringify(mod.ATLAS_MAP_PIN_FOCUS_SPAN),
  'focus spans match 3D runtime',
);
assert(runtime.includes("if(pin.kind==='building')return s<140;"), '3D building pin LOD');
assert(runtime.includes("if(pin.kind==='room')return s<45;"), '3D room pin LOD');
assert(
  runtime.includes('clamp(cameraState.span*.06*productToolScale(),.2,200)'),
  '3D brush width formula',
);
assert(
  runtime.includes('clamp(Math.round(cameraState.span*productToolScale())/1000,.02,4)'),
  '3D stamp size formula',
);

console.log('atlas-map-pins self-test: PASS');
