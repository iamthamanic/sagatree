#!/usr/bin/env node
/**
 * ATL2-C02 — room / wall / door / building footprint contracts.
 * Location: scripts/atl2-c02-room-wall-door.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const catalog = jiti(join(root, 'src/domains/world/atlas/atlas-canonical-features.ts'));
const registry = jiti(join(root, 'src/domains/world/atlas/atlas-tool-registry.ts'));
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-c02.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');

assert.ok(acceptance.includes('atl2-c02'));
assert.ok(gate.includes('atl2-c02-room-wall-door.self-test.mjs'));
assert.ok(editorSrc.includes("tool === 'door'"));
assert.ok(editorSrc.includes('add_door'));
assert.ok(editorSrc.includes('remove_wall'));
assert.ok(editorSrc.includes('rotate_room'));
assert.ok(editorSrc.includes('snapStructurePoint'));
assert.ok(editorSrc.includes('kein automatischer WorldNode'));

assert.ok(catalog.ATLAS_REQUIRED_EDIT_OPS.includes('add_door'));
assert.ok(catalog.ATLAS_REQUIRED_EDIT_OPS.includes('rotate_room'));
assert.ok(!catalog.ATLAS_DEFERRED_EDIT_OPS.includes('add_door'));
assert.ok(registry.ATLAS_TOOL_REGISTRY.some((t) => t.id === 'door' && t.labelDe === 'Tür'));

let doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, {
  op: 'add_room',
  room: { id: 'r1', x: 0, y: 0, w: 10, h: 8, material: 'stein' },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_wall',
  wall: { id: 'w1', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.4 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_door',
  door: { id: 'd1', wallId: 'w1', t: 0.5, width: 1.2 },
});
assert.equal(doc.doors.length, 1);
assert.equal(ops.pickWallAt(doc, 5, 0, 0.5)?.id, 'w1');
assert.equal(ops.pickDoorAt(doc, 5, 0, 0.8)?.id, 'd1');

doc = ops.applyMapEdit(doc, { op: 'move_door', id: 'd1', t: 0.25 });
assert.equal(doc.doors[0].t, 0.25);

const snapped = ops.snapStructurePoint(doc, [0.2, 0.1], 1);
assert.deepEqual(snapped, [0, 0]);

doc = ops.applyMapEdit(doc, { op: 'rotate_room', id: 'r1', angleRad: Math.PI / 2 });
assert.ok(doc.rooms[0].points && doc.rooms[0].points.length === 4);

// Polygon rooms preserve vertex count under rotate
let polyDoc = canvas.emptyUnifiedCanvasDoc(false);
polyDoc = ops.applyMapEdit(polyDoc, {
  op: 'add_room',
  room: {
    id: 'rp',
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    material: 'stein',
    points: [
      [0, 0],
      [4, 0],
      [3, 4],
      [1, 4],
      [0, 2],
    ],
  },
});
polyDoc = ops.applyMapEdit(polyDoc, { op: 'rotate_room', id: 'rp', angleRad: Math.PI / 2 });
assert.equal(polyDoc.rooms[0].points.length, 5);

// WebGL wall sync prunes orphan doors
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const withDoor = {
  ...canvas.emptyUnifiedCanvasDoc(false),
  walls: [{ id: 'wX', x1: 0, y1: 0, x2: 5, y2: 0, width: 0.3 }],
  doors: [{ id: 'dX', wallId: 'wX', t: 0.5, width: 1 }],
};
const synced = bridge.syncWebglPropsIntoCanvasDoc(withDoor, {
  props: [],
  walls: [],
  strokes: [],
  rooms: [],
  layers: {},
});
assert.equal(synced.walls.length, 0);
assert.equal(synced.doors.length, 0);

doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'b1', type: 'haus', x: 20, y: 20, size: 2, angle: 0 },
});
doc = ops.applyMapEdit(doc, {
  op: 'transform_object',
  id: 'b1',
  patch: { angle: Math.PI / 2, size: 3 },
});
assert.equal(doc.objects[0].angle, Math.PI / 2);
assert.equal(doc.objects[0].size, 3);

const classified = catalog.classifyUnifiedCanvasDoc(doc, 'interior');
assert.ok(classified.counts.door >= 1);
assert.ok(classified.counts.wall >= 1);
assert.ok(classified.counts.building_footprint >= 1);

doc = ops.applyMapEdit(doc, { op: 'remove_wall', id: 'w1' });
assert.equal(doc.walls.length, 0);
assert.equal(doc.doors.length, 0);

const legacy = canvas.parseUnifiedCanvasDoc({
  format: canvas.UNIFIED_CANVAS_FORMAT,
  layers: canvas.defaultUnifiedCanvasLayers(),
  strokes: [],
  objects: [],
  rooms: [],
  walls: [],
});
assert.ok(legacy);
assert.deepEqual(legacy.doors, []);

const roundTrip = canvas.parseUnifiedCanvasDoc(
  canvas.serializeUnifiedCanvasDoc({
    ...canvas.emptyUnifiedCanvasDoc(false),
    walls: [{ id: 'w2', x1: 0, y1: 0, x2: 4, y2: 0, width: 0.3 }],
    doors: [{ id: 'd2', wallId: 'w2', t: 0.5, width: 1 }],
  }),
);
assert.equal(roundTrip.doors.length, 1);

console.log('atl2-c02-room-wall-door self-test: PASS');
