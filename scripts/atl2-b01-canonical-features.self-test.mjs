#!/usr/bin/env node
/**
 * ATL2-B01 — canonical feature catalog + Golden classification.
 * Location: scripts/atl2-b01-canonical-features.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const catalog = jiti(join(root, 'src/domains/world/atlas/atlas-canonical-features.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));
const editOpsSrc = readFileSync(join(root, 'src/domains/world/atlas/map-edit-ops.ts'), 'utf8');
const designSrc = readFileSync(join(root, '.qa/design/atl2-b01-canonical-features.md'), 'utf8');
const acceptanceSrc = readFileSync(join(root, '.qa/acceptance/atl2-b01.md'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.equal(catalog.ATLAS_WIRE_FORMAT_DECISION, 'retain-sagatree-unified-atlas-v1');
assert.equal(catalog.ATLAS_CANONICAL_CATALOG_VERSION, 'atl2-b01-catalog-v1');
assert.equal(catalog.DRAWN_ROOM_VS_WORLD_NODE.autoCreateWorldNodeFromDrawnRoom, false);
assert.ok(catalog.ATLAS_MIGRATION_MATRIX.length >= 8, 'migration matrix rows');
assert.ok(designSrc.includes('Drawn room ≠ WorldNode'), 'design separates room vs node');
assert.ok(acceptanceSrc.includes('atl2-b01'), 'acceptance present');
assert.ok(indexSrc.includes('atlas-canonical-features'), 'barrel export');

for (const op of catalog.ATLAS_REQUIRED_EDIT_OPS) {
  assert.ok(editOpsSrc.includes(`'${op}'`) || editOpsSrc.includes(`"${op}"`), `edit op ${op}`);
}

const doc = starter.buildDornhainUnifiedCanvasDoc();
assert.ok(doc.rooms.length > 0, 'golden rooms');
assert.ok(doc.strokes.length > 0, 'golden strokes');
assert.ok(doc.objects.some((o) => o.secret === true), 'crypt secret stamp');

const classified = catalog.classifyUnifiedCanvasDoc(doc, 'world');
assert.equal(classified.catalogVersion, 'atl2-b01-catalog-v1');
assert.equal(classified.counts.political_area, 0, 'no invented political areas');
assert.ok(classified.counts.terrain_area >= 1, 'terrain coasts/ocean');
assert.ok(classified.counts.path_river >= 1, 'rivers');
assert.ok(classified.counts.path_way >= 1, 'roads');
assert.ok(classified.counts.building_footprint >= 1, 'haus/turm stamps');
assert.ok(classified.counts.prop_object >= 1, 'props');
assert.ok(classified.counts.layer_toggle >= 1, 'layer toggles');
assert.equal(
  catalog.classificationRespectsLegacySafety(classified, doc),
  true,
  'legacy safety',
);

const secret = classified.features.find((f) => f.id === 's.obj.crypt');
assert.ok(secret, 'crypt classified');
assert.equal(secret.secret, true, 'crypt secret preserved');

const ambiguous = catalog.classifyRoom(
  { id: 'legacy.blob', x: 0, y: 0, w: 10, h: 10, material: 'gras' },
  null,
);
assert.equal(ambiguous.kind, 'legacy_area_ambiguous');

const political = catalog.classifyRoom(
  { id: 'realm.a', x: 0, y: 0, w: 10, h: 10, material: 'gras' },
  'political',
);
assert.equal(political.kind, 'political_area');

const { emptyUnifiedCanvasDoc } = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const emptyClassified = catalog.classifyUnifiedCanvasDoc(emptyUnifiedCanvasDoc(false), 'unknown');
assert.equal(emptyClassified.counts.terrain_area, 0);
assert.equal(emptyClassified.counts.political_area, 0);

console.log('atl2-b01-canonical-features self-test: PASS');
console.log(
  JSON.stringify(
    {
      terrain_area: classified.counts.terrain_area,
      path_river: classified.counts.path_river,
      path_way: classified.counts.path_way,
      building_footprint: classified.counts.building_footprint,
      prop_object: classified.counts.prop_object,
      political_area: classified.counts.political_area,
    },
    null,
    0,
  ),
);
