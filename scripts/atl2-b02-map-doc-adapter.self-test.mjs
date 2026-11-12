#!/usr/bin/env node
/**
 * ATL2-B02 — lossless V1↔V2 map document adapter.
 * Location: scripts/atl2-b02-map-doc-adapter.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const adapter = jiti(join(root, 'src/domains/world/atlas/atlas-map-doc-adapter.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));
const canvasMod = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-b02.md'), 'utf8');

assert.ok(indexSrc.includes('atlas-map-doc-adapter'), 'barrel export');
assert.ok(acceptance.includes('atl2-b02'), 'acceptance');

const empty = canvasMod.emptyUnifiedCanvasDoc(false);
const emptyAdapt = adapter.adaptGeneratorMetaToV2({
  engine: 'unified_canvas',
  unifiedCanvas: canvasMod.serializeUnifiedCanvasDoc(empty),
});
assert.equal(emptyAdapt.ok, true);
assert.equal(emptyAdapt.doc.scale, 'unknown');
assert.equal(emptyAdapt.doc.classification.counts.terrain_area, 0);

const missing = adapter.adaptGeneratorMetaToV2(null);
assert.equal(missing.ok, false);
assert.equal(missing.reason, 'missing_canvas');

const bad = adapter.adaptGeneratorMetaToV2({ format: 'totally-unknown-v9' });
assert.equal(bad.ok, false);

const golden = starter.buildDornhainUnifiedCanvasDoc();
const hints = adapter.goldenStrokeHintsFromCanvas(golden);
assert.ok(Object.keys(hints).length >= 2, 'golden stroke hints');

const v2 = adapter.buildAtlasMapDocV2(golden, { scale: 'world', strokeHints: hints });
assert.equal(v2.format, 'sagatree-atlas-map-doc-v2');
assert.equal(v2.wireFormat, 'sagatree-unified-atlas-v1');
assert.ok(v2.classification.counts.path_river >= 1);
assert.ok(v2.classification.counts.path_way >= 1);
assert.equal(v2.classification.counts.political_area, 0);
assert.equal(adapter.adapterRespectsAmbiguity(v2), true);

const wire = adapter.projectAtlasMapDocV2ToV1Wire(v2);
assert.equal(adapter.unifiedCanvasRoundtripEqual(golden, wire), true, 'V1→V2→V1 equal');

const priorMeta = {
  engine: 'unified_canvas',
  seed: starter.DORNHAIN_UNIFIED_SEED,
  webglRuntimeV3: { props: [{ id: 'keep-me' }], strokes: [], walls: [], layers: {} },
  unifiedCanvas: canvasMod.serializeUnifiedCanvasDoc(golden),
};
const merged = adapter.mergeAtlasMapDocV2IntoGeneratorMeta(priorMeta, v2, {
  writeBackup: true,
  nowIso: '2026-11-12T00:00:00.000Z',
});
assert.ok(merged.unifiedCanvas, 'wire persisted');
assert.ok(merged.atlasMapDocV2, 'sidecar persisted');
assert.ok(merged.atlasMapDocBackup, 'backup persisted');
assert.deepEqual(merged.webglRuntimeV3, priorMeta.webglRuntimeV3, 'webgl sidecar preserved');

const reloaded = adapter.adaptGeneratorMetaToV2(merged, {
  scale: 'world',
  preferStoredHints: true,
});
assert.equal(reloaded.ok, true);
assert.equal(
  adapter.unifiedCanvasRoundtripEqual(golden, reloaded.doc.canvas),
  true,
  'save→reload equal',
);
assert.ok(reloaded.doc.strokeHints['w.river-w'] === 'river');

// Interrupted write simulation: reject invalid candidate, keep prior meta.
const interrupted = adapter.adaptGeneratorMetaToV2({
  ...priorMeta,
  unifiedCanvas: { format: 'sagatree-unified-atlas-v1', strokes: 'nope' },
});
assert.equal(interrupted.ok, false);
assert.ok(priorMeta.unifiedCanvas.rooms.length > 0, 'prior revision intact');

const restored = adapter.restoreAtlasMapDocBackup(merged);
assert.equal(restored.ok, true);
assert.equal(adapter.unifiedCanvasRoundtripEqual(golden, restored.doc.canvas), true);

// Ambiguous: unhinted golden must not invent paths/terrain.
const ambiguous = adapter.buildAtlasMapDocV2(golden, { scale: 'unknown', strokeHints: {} });
assert.ok(ambiguous.classification.counts.legacy_stroke_ambiguous >= 1);
assert.equal(ambiguous.classification.counts.terrain_area, 0);

console.log('atl2-b02-map-doc-adapter self-test: PASS');
