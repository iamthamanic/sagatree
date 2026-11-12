#!/usr/bin/env node
/**
 * ATL2-B04 — webglRuntimeV3 geometry write-retire + ghost regression.
 * Location: scripts/atl2-b04-webgl-write-retire.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const retire = jiti(join(root, 'src/domains/world/atlas/atlas-webgl-write-retire.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const canvasMod = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-b04.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-b04-webgl-write-retire.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');

assert.ok(indexSrc.includes('atlas-webgl-write-retire'), 'barrel export');
assert.ok(acceptance.includes('atl2-b04'), 'acceptance');
assert.ok(design.includes('Sole persisted geometry SoT'), 'design inventory');
assert.ok(editorSrc.includes('mergeCanonicalAtlasGeometryForPersist'), 'editor persist');
assert.ok(editorSrc.includes('hydrateCanvasFromLegacyWebgl'), 'editor hydrate');
assert.ok(gate.includes('atl2-b04-webgl-write-retire.self-test.mjs'), 'wired in test-gate');
assert.ok(!editorSrc.includes('mergeWebglRuntimeIntoGeneratorMeta(generatorMeta, webglRuntime)'), 'no dual-write');

const empty = canvasMod.emptyUnifiedCanvasDoc(false);
const table = {
  id: 'obj-table',
  type: 'tisch',
  x: 10,
  y: 20,
  size: 1,
};
const withTable = { ...empty, objects: [table], demoSeed: false };

// Parity: canvas → ephemeral runtime → canvas
const runtimeFromDoc = bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), withTable);
assert.equal(runtimeFromDoc.props.length, 1);
const roundTrip = bridge.syncWebglPropsIntoCanvasDoc(empty, runtimeFromDoc);
assert.equal(roundTrip.objects.length, 1);
assert.equal(roundTrip.objects[0].id, 'obj-table');

// Persist strips geometry shadow; canvas remains
const priorMeta = {
  engine: 'unified_canvas',
  unifiedCanvas: canvasMod.serializeUnifiedCanvasDoc(withTable),
  webglRuntimeV3: {
    props: [
      { id: 'ghost', type: 'house', stamp: 'haus', x: 1, z: 2, size: 1, rotation: 0, level: 'world' },
      { id: 'obj-table', type: 'table', stamp: 'tisch', x: 10, z: 20, size: 1, rotation: 0, level: 'world' },
    ],
    strokes: [],
    walls: [],
    rooms: [],
    layers: { world: true, stamps: true },
    placeNames: { keep: true },
  },
};
const deletedDoc = { ...withTable, objects: [] };
const persisted = retire.mergeCanonicalAtlasGeometryForPersist(
  priorMeta,
  deletedDoc,
  runtimeFromDoc,
  { capturedAt: '2026-11-12T00:00:00.000Z' },
);
assert.ok(retire.persistedMetaHasNoWebglGeometryShadow(persisted), 'no geometry shadow');
const persistedCanvas = canvasMod.extractUnifiedCanvasFromGeneratorMeta(persisted);
assert.equal(persistedCanvas.objects.length, 0, 'delete sticks in canvas');
const sidecar = bridge.extractWebglRuntimeFromGeneratorMeta(persisted);
assert.equal(sidecar.props.length, 0);
assert.equal(sidecar.layers.world, true, 'layers kept');
assert.equal(sidecar.placeNames.keep, true, 'extras kept');
const backup = retire.parseWebglGeometryBackup(persisted.webglRuntimeV3GeometryBackup);
assert.ok(backup, 'backup captured');
assert.ok(backup.props.some((p) => p && p.id === 'ghost'), 'ghost was in backup');

// Remount projection must not resurrect ghosts from stripped sidecar
const remountSeed = bridge.syncCanvasDocIntoWebglRuntime(sidecar, persistedCanvas);
assert.equal(remountSeed.props.length, 0, 'remount ghost-free');

// Rollback restores sidecar geometry
const rolled = retire.restoreWebglGeometryBackup(persisted);
assert.ok(rolled);
assert.ok(bridge.extractWebglRuntimeFromGeneratorMeta(rolled).props.length >= 1);
assert.equal(rolled.webglRuntimeV3GeometryBackup, undefined);

// Legacy import: only when unifiedCanvas key is absent
const legacyOnly = {
  webglRuntimeV3: {
    props: [{ id: 'legacy-house', type: 'house', stamp: 'haus', x: 3, z: 4, size: 1, rotation: 0, level: 'world' }],
    strokes: [],
    walls: [],
    rooms: [],
    layers: { world: true },
  },
};
const hydrated = retire.hydrateCanvasFromLegacyWebgl(legacyOnly, false);
assert.equal(hydrated.migrated, true);
assert.equal(hydrated.canvas.objects.length, 1);
assert.equal(hydrated.canvas.objects[0].id, 'legacy-house');
const afterLegacySave = retire.mergeCanonicalAtlasGeometryForPersist(
  hydrated.meta,
  hydrated.canvas,
  hydrated.runtime,
  { capturedAt: '2026-11-12T00:00:01.000Z' },
);
assert.ok(retire.persistedMetaHasNoWebglGeometryShadow(afterLegacySave));
const kept = canvasMod.extractUnifiedCanvasFromGeneratorMeta(afterLegacySave);
assert.equal(kept.objects[0].id, 'legacy-house');

// Present empty canvas is authoritative — do not resurrect stale sidecar (Codex P1)
const emptyAuthoritative = {
  unifiedCanvas: canvasMod.serializeUnifiedCanvasDoc(empty),
  webglRuntimeV3: legacyOnly.webglRuntimeV3,
};
const noResurrect = retire.hydrateCanvasFromLegacyWebgl(emptyAuthoritative, false);
assert.equal(noResurrect.migrated, false);
assert.equal(noResurrect.canvas.objects.length, 0, 'empty canvas wins over stale sidecar');

// Empty stays empty
const emptyHydrate = retire.hydrateCanvasFromLegacyWebgl({}, false);
assert.equal(emptyHydrate.migrated, false);
assert.equal(emptyHydrate.canvas.objects.length, 0);

// Rollback preserves non-geometry extras (Codex P2)
const withExtras = retire.mergeCanonicalAtlasGeometryForPersist(
  {
    ...priorMeta,
    webglRuntimeV3: { ...priorMeta.webglRuntimeV3, placeNames: { keep: true } },
  },
  deletedDoc,
  null,
  { capturedAt: '2026-11-12T00:00:02.000Z' },
);
const rolledExtras = retire.restoreWebglGeometryBackup(withExtras);
assert.ok(rolledExtras);
assert.equal(
  bridge.extractWebglRuntimeFromGeneratorMeta(rolledExtras).placeNames.keep,
  true,
  'placeNames survive restore',
);

console.log('atl2-b04-webgl-write-retire self-test: PASS');
