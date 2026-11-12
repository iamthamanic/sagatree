#!/usr/bin/env node
/**
 * ATL2-C03 — multi-select / layer visibility / locks.
 * Location: scripts/atl2-c03-layers-multiselect.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const sel = jiti(join(root, 'src/domains/world/atlas/atlas-selection.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-c03.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');

assert.ok(acceptance.includes('atl2-c03'));
assert.ok(gate.includes('atl2-c03-layers-multiselect.self-test.mjs'));
assert.ok(editorSrc.includes('toggleSelection'));
assert.ok(editorSrc.includes('data-atlas-layer-lock'));
assert.ok(editorSrc.includes('data-atlas-selection-inspector'));
assert.ok(editorSrc.includes('translateSelected'));
assert.ok(editorSrc.includes('featuresInRect'));

assert.deepEqual(sel.toggleSelection([], 'a', false), ['a']);
assert.deepEqual(sel.toggleSelection(['a'], 'b', true), ['a', 'b']);
assert.deepEqual(sel.toggleSelection(['a', 'b'], 'a', true), ['b']);

assert.equal(sel.canHitFeature({ objects: false }, {}, 'object'), false);
assert.equal(
  sel.canHitFeature({ objects: true, interior: true, drawings: true }, { objects: true }, 'object', {
    forEdit: true,
  }),
  false,
);
assert.equal(
  sel.canHitFeature({ objects: true, interior: true, drawings: true }, { objects: true }, 'object', {
    forEdit: false,
  }),
  true,
);

let doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'o1', type: 'haus', x: 1, y: 1, size: 2, angle: 0 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'o2', type: 'haus', x: 5, y: 5, size: 2, angle: 0 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_room',
  room: { id: 'r1', x: 10, y: 10, w: 4, h: 4, material: 'stein' },
});

const hits = sel.featuresInRect(doc, { x: 0, y: 0, w: 6, h: 6 }, doc.layers);
assert.ok(hits.some((h) => h.id === 'o1'));
assert.ok(hits.some((h) => h.id === 'o2'));
assert.ok(!hits.some((h) => h.id === 'r1'));

doc = sel.translateSelected(doc, ['o1', 'o2'], 2, 3);
assert.equal(doc.objects.find((o) => o.id === 'o1').x, 3);
assert.equal(doc.objects.find((o) => o.id === 'o2').y, 8);

const locked = { ...doc, layerLocks: sel.setLayerLock({}, 'objects', true) };
const ser = canvas.serializeUnifiedCanvasDoc(locked);
const round = canvas.parseUnifiedCanvasDoc(ser);
assert.equal(round.layerLocks.objects, true);

const legacy = canvas.parseUnifiedCanvasDoc({
  format: canvas.UNIFIED_CANVAS_FORMAT,
  layers: canvas.defaultUnifiedCanvasLayers(),
  strokes: [],
  objects: [],
  rooms: [],
  walls: [],
});
assert.deepEqual(legacy.layerLocks, {});

console.log('atl2-c03-layers-multiselect self-test: PASS');
