#!/usr/bin/env node
/**
 * ATL2-C01 — 2D area/path/road/river/terrain tool contracts.
 * Location: scripts/atl2-c01-2d-tools.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const poly = jiti(join(root, 'src/domains/world/atlas/canvas-polygon.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const registry = jiti(join(root, 'src/domains/world/atlas/atlas-tool-registry.ts'));
const catalog = jiti(join(root, 'src/domains/world/atlas/atlas-canonical-features.ts'));
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-c01.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-c01'));
assert.ok(gate.includes('atl2-c01-2d-tools.self-test.mjs'));
assert.ok(indexSrc.includes('validateClosedPolygon'));
assert.ok(indexSrc.includes('roomFromValidatedPolygon'));
assert.ok(editorSrc.includes('roomFromValidatedPolygon'));
assert.ok(editorSrc.includes('move_room_vertex'));
assert.ok(editorSrc.includes('append_stroke_point'));
assert.ok(editorSrc.includes('snapPointToCandidates'));

// Concave U-notch: (3,5) sits in the dent (outside); (1,1) inside
const concave = [
  [0, 0],
  [8, 0],
  [8, 8],
  [4, 8],
  [4, 3],
  [2, 3],
  [2, 8],
  [0, 8],
];
assert.equal(poly.pointInPolygon(3, 5, concave), false);
assert.equal(poly.pointInPolygon(1, 1, concave), true);

// Self-intersect (bowtie)
const bowtie = [
  [0, 0],
  [10, 10],
  [0, 10],
  [10, 0],
];
assert.equal(poly.polygonSelfIntersects(bowtie), true);
const bad = poly.validateClosedPolygon(bowtie);
assert.equal(bad.ok, false);
assert.equal(bad.reason, 'self_intersecting');
const rejected = canvas.roomFromValidatedPolygon('r1', 'gras', bowtie);
assert.equal(rejected.ok, false);

const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const good = canvas.roomFromValidatedPolygon('r2', 'gras', square);
assert.equal(good.ok, true);

// Snap
assert.deepEqual(poly.snapPointToGrid([3.2, 7.8], 1), [3, 8]);
assert.deepEqual(
  poly.snapPointToCandidates([1.1, 1.1], [[0, 0], [5, 5]], 2),
  [0, 0],
);

assert.equal(ops.clampAtlasBrushUi(3), 8);
assert.equal(ops.clampAtlasBrushUi(200), 120);

let doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, { op: 'add_room', room: good.room });
doc = ops.applyMapEdit(doc, {
  op: 'add_stroke',
  stroke: {
    id: 's1',
    material: 'wasser',
    width: 4,
    points: [
      [0, 0],
      [5, 0],
    ],
  },
});
doc = ops.applyMapEdit(doc, { op: 'append_stroke_point', id: 's1', x: 10, y: 0 });
assert.equal(doc.strokes[0].points.length, 3);
doc = ops.applyMapEdit(doc, { op: 'move_stroke_point', id: 's1', index: 1, x: 5, y: 2 });
assert.equal(doc.strokes[0].points[1][1], 2);
doc = ops.applyMapEdit(doc, {
  op: 'move_room_vertex',
  id: 'r2',
  index: 2,
  x: 12,
  y: 12,
});
assert.equal(doc.rooms[0].points[2][0], 12);

const picked = ops.pickStrokeAt(doc, 5, 2, 0.5);
assert.equal(picked?.id, 's1');
doc = ops.applyMapEdit(doc, { op: 'remove_stroke', id: 's1' });
assert.equal(doc.strokes.length, 0);
doc = ops.applyMapEdit(doc, { op: 'remove_room', id: 'r2' });
assert.equal(doc.rooms.length, 0);

// Tool registry: world + continent expose area/road/brush
const worldTools = registry.atlasToolsForKind(null).map((t) => t.id);
assert.ok(worldTools.includes('area'));
assert.ok(worldTools.includes('road'));
assert.ok(worldTools.includes('brush'));
const continentTools = registry.atlasToolsForKind('continent').map((t) => t.id);
assert.ok(continentTools.includes('road'));
assert.ok(registry.ATLAS_TOOL_REGISTRY.some((t) => t.labelDe === 'Weg / Fluss'));

for (const op of [
  'add_stroke',
  'append_stroke_point',
  'move_stroke_point',
  'remove_stroke',
  'set_room_points',
  'move_room_vertex',
]) {
  assert.ok(catalog.ATLAS_REQUIRED_EDIT_OPS.includes(op), op);
}

console.log('atl2-c01-2d-tools self-test: PASS');
