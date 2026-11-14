#!/usr/bin/env node
/**
 * ATL2-G01 — GM/Player/Owner atlas scopes & secrets (#1229).
 * Location: scripts/atl2-g01-scopes.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g01.md'), 'utf8');
assert.ok(acceptance.includes('atl2-g01'));
assert.ok(acceptance.includes('#1229'));
assert.ok(acceptance.includes('SC-01'));
assert.ok(acceptance.includes('party'));

const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g01.md'), 'utf8');
assert.ok(composition.includes('atl2-g01'));
assert.ok(composition.includes('CLEAR'));

const {
  filterPartyLayers,
  redactPartyGeneratorMeta,
  redactUnifiedCanvasForParty,
  partyPayloadLeaksSecrets,
  entityIsSecret,
} = jiti(join(root, 'src/domains/world/atlas/party-map-projection.ts'));

// Layers: secret + undiscovered stripped
const layers = filterPartyLayers({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'ok', secret: false }, geometry: null },
    { type: 'Feature', properties: { id: 'sec', secret: true }, geometry: null },
    { type: 'Feature', properties: { id: 'hid', discovered: false }, geometry: null },
    { type: 'Feature', properties: { id: 'crypt', secret: 'true' }, geometry: null },
  ],
});
assert.equal(layers.features.length, 1);
assert.equal(layers.features[0].properties.id, 'ok');

// Unified canvas: secret rooms/objects/doors + golden crypt ids
const canvas = redactUnifiedCanvasForParty({
  objects: [
    { id: 'chest', secret: false },
    { id: 'trap', secret: true },
    { id: 's.obj.crypt', type: 'prop' },
  ],
  rooms: [
    { id: 'hall' },
    { id: 's.crypt' },
    { id: 'vault', secret: true },
  ],
  doors: [
    { id: 'd1' },
    { id: 'd-secret', secret: true },
  ],
  strokes: [],
  walls: [],
});
assert.deepEqual(
  canvas.objects.map((o) => o.id),
  ['chest'],
);
assert.deepEqual(
  canvas.rooms.map((r) => r.id),
  ['hall'],
);
assert.deepEqual(
  canvas.doors.map((d) => d.id),
  ['d1'],
);
assert.equal(entityIsSecret({ id: 's.crypt' }), true);

// Dungeon meta: theme only
const meta = redactPartyGeneratorMeta({
  engine: 'unified_canvas',
  dungeon: {
    themeKey: 'ancient',
    seed: 42,
    confirmed: true,
    manualDirty: true,
    rooms: [{ id: 'secret-room', secret: true }],
  },
  unifiedCanvas: {
    objects: [{ id: 'trap', secret: true }, { id: 'torch' }],
    rooms: [],
    strokes: [],
    walls: [],
    doors: [],
  },
});
assert.deepEqual(meta.dungeon, { themeKey: 'ancient' });
assert.deepEqual(
  meta.unifiedCanvas.objects.map((o) => o.id),
  ['torch'],
);
assert.equal(
  partyPayloadLeaksSecrets({ layers, generatorMeta: meta }),
  false,
);
assert.equal(
  partyPayloadLeaksSecrets({
    generatorMeta: { dungeon: { themeKey: 'x', seed: 1 } },
  }),
  true,
);

// Host store must wire domain-equivalent projection (no FE src import).
const storeSrc = readFileSync(
  join(root, 'server/src/modules/world/internal/world-atlas-store.ts'),
  'utf8',
);
assert.ok(storeSrc.includes("from './party-map-projection.ts'"));
assert.ok(storeSrc.includes('redactPartyGeneratorMeta'));
assert.ok(storeSrc.includes('filterPartyLayers'));
assert.ok(!storeSrc.includes('src/domains/world/atlas/party-map-projection'));

const serverProj = readFileSync(
  join(root, 'server/src/modules/world/internal/party-map-projection.ts'),
  'utf8',
);
assert.ok(serverProj.includes('redactDungeonMetaForParty'));
assert.ok(serverProj.includes('themeKey'));

// Writes stay owner-scoped
assert.ok(storeSrc.includes('canEditWorld'));
assert.ok(storeSrc.includes("error: '42501'"));

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
assert.ok(gate.includes('atl2-g01-scopes.self-test.mjs'));

const report = {
  schemaVersion: 1,
  kind: 'atl2-g01-scopes',
  result: 'PASS',
  checks: [
    'party layers strip secret/undiscovered',
    'unifiedCanvas strips secret entities + crypt ids + doors',
    'dungeon meta theme-only for party',
    'host store wires internal party-map-projection',
    'owner write path remains 42501-gated',
  ],
};
console.log(JSON.stringify(report, null, 2));
console.log('atl2-g01-scopes.self-test: OK');
