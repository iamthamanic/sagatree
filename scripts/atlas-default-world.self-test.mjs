#!/usr/bin/env node
/**
 * atlas-default-world.self-test — Calibrated Bottom-Up Default World (C1–C6, B1–B6).
 *
 * Verifies:
 *  - C1: 2 Continents × 2 Countries × 2–3 Places (10 Places total).
 *  - C2: Exactly one deep reference Place (Dornhain → Taverne → Schankraum → Tisch).
 *  - C3: Procedural Dungeons via Dungeon-Forge (4 committed dungeons, direction=top-down).
 *  - C4: Only existing UnifiedCanvasStampType IDs used across all 23 maps.
 *  - C5: Calibrated from Day 1 (metersPerUnit exact at every level: 250→100→25→1→0.04→0.02 / 0.08).
 *  - B1–B6: 0 geometry ownership conflicts, bottom-up derived fingerprints present,
 *    and child river/road/settlement points match projected coordinates on Land/Kontinent/Welt.
 *  - SWS-01: 6-level roundtrip < 1e-9 (Schankraum Tisch → Welt Donalu → Schankraum), zero shear, zero sibling overlap.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-default-world-'));
const outfile = join(tmp, 'dw.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const atlas = await import(pathToFileURL(outfile).href);
const bundle = atlas.buildCalibratedDefaultWorld();

// 1) Topology C1: 2 Continents × 2 Countries × 2–3 Places (10 Places)
const continents = bundle.maps.filter((m) => m.placeSeedKey.startsWith('continent.'));
const countries = bundle.maps.filter((m) => m.placeSeedKey.startsWith('country.'));
const places = bundle.maps.filter((m) => m.placeSeedKey.startsWith('place.'));
assert.equal(continents.length, 2, '2 continents');
assert.equal(countries.length, 4, '4 countries (2 per continent)');
assert.equal(places.length, 10, '10 places (2–3 per country)');
for (const cont of continents) {
  const kids = countries.filter((c) => c.parentMapSeedKey === cont.seedKey);
  assert.equal(kids.length, 2, `${cont.title} has 2 countries`);
}
for (const ctry of countries) {
  const kids = places.filter((p) => p.parentMapSeedKey === ctry.seedKey);
  assert.ok(kids.length >= 2 && kids.length <= 3, `${ctry.title} has 2–3 places (got ${kids.length})`);
}

// 2) C2: Exactly one deep reference Ort (Dornhain → Taverne → Schankraum → Tisch)
const buildings = bundle.maps.filter((m) => m.placeSeedKey === 'loc.tavern');
const rooms = bundle.maps.filter((m) => m.placeSeedKey.startsWith('room.'));
assert.equal(buildings.length, 1, '1 deep reference building');
assert.equal(rooms.length, 1, '1 deep reference room (Schankraum)');
const taproomDoc = rooms[0].buildCanvas();
assert.ok(taproomDoc.objects.some((o) => o.type === 'tisch'), 'Schankraum contains Tisch');

// 3) C3: 4 procedural Dungeons via Dungeon-Forge (top-down)
const dungeons = bundle.maps.filter((m) => typeof m.buildDungeonMeta === 'function');
assert.equal(dungeons.length, 4, '4 procedural dungeons');
for (const d of dungeons) {
  const meta = d.buildDungeonMeta();
  assert.equal(meta.confirmed, true, `${d.title} forge confirmed`);
  const ddoc = d.buildCanvas();
  assert.ok(ddoc.rooms.length >= 4 && ddoc.walls.length > 0 && (ddoc.doors?.length ?? 0) > 0, `${d.title} forged geometry`);
}

// 4) C4: Existing UnifiedCanvasStampType IDs only
const ALLOWED_STAMPS = new Set([
  'baum', 'tanne', 'fels', 'haus', 'turm',
  'tisch', 'stuhl', 'fass', 'bett', 'kiste', 'lampe', 'teppich',
]);
for (const doc of [bundle.rootDoc, ...bundle.maps.map((m) => m.buildCanvas())]) {
  for (const o of doc.objects) {
    assert.ok(ALLOWED_STAMPS.has(o.type), `unexpected stamp type ${o.type}`);
  }
}

// 5) C5 + SWS-01/02 integrity check (calibration, roundtrip <1e-9, 0 conflicts, 0 sibling overlaps)
const integrity = atlas.verifyDefaultWorldIntegrity();
assert.equal(integrity.ok, true, `integrity failed: ${integrity.errors.join('; ')}`);
assert.equal(bundle.rootMetersPerUnit, 250);

// 6) 6-level roundtrip: Tisch in Schankraum → Taverne → Dornhain → Nordreich → Westmark → Welt
const table = taproomDoc.objects.find((o) => o.type === 'tisch');
const wTable = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.room.taproom', { x: table.x, y: table.y });
assert.equal(wTable.ok, true);
assert.equal(wTable.depth, 6, '6-level chain: Schankraum → Taverne → Dornhain → Nordreich → Westmark → Welt');
const backTable = atlas.worldToLocal(bundle.worldNodes, 'dornhain.map.room.taproom', wTable.value);
assert.equal(backTable.ok, true);
assert.ok(Math.hypot(backTable.value.x - table.x, backTable.value.y - table.y) < 1e-9, '6-level roundtrip <1e-9');

// 7) B2/B3 Bottom-Up proof: Felswacht river point projected into Nordreich matches derived river stroke
const felswacht = bundle.maps.find((m) => m.seedKey === 'dornhain.map.place.felswacht');
const nordreich = bundle.maps.find((m) => m.seedKey === 'dornhain.map.country.westmark');
const fwRiver = felswacht.buildCanvas().strokes.find((s) => s.material === 'wasser');
const nrDerivedRiver = nordreich.buildCanvas().strokes.find((s) => s.id === 'der.place.felswacht.p.felswacht.river');
assert.ok(fwRiver && nrDerivedRiver, 'derived river exists on Nordreich');
const expectedStart = atlas.childLocalToParentPoint(
  { ...felswacht.parentAnchor, parentMapId: nordreich.seedKey },
  { x: fwRiver.points[0][0], y: fwRiver.points[0][1] },
);
assert.ok(
  Math.hypot(nrDerivedRiver.points[0][0] - expectedStart.x, nrDerivedRiver.points[0][1] - expectedStart.y) < 1e-2,
  'derived Nordreich river endpoint matches Felswacht bottom-up projection',
);

// 8) B2/B3 Bottom-Up proof: Dornhain world pin matches exact localToWorld(dornhain, center)
const dornhainWorldCenter = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', { x: 500, y: 500 });
const dornhainPin = bundle.rootDoc.objects.find((o) => o.id === 'w.loc.dornhain');
assert.ok(dornhainPin && dornhainWorldCenter.ok);
assert.ok(
  Math.hypot(dornhainPin.x - dornhainWorldCenter.value.x, dornhainPin.y - dornhainWorldCenter.value.y) < 0.05,
  'world pin matches bottom-up localToWorld',
);

// 9) C6: DORNHAIN_GOLDEN_MAPS / buildDornhainUnifiedCanvasDoc use the new world (no parallel world)
assert.equal(atlas.DORNHAIN_GOLDEN_MAPS.length, bundle.maps.length, 'DORNHAIN_GOLDEN_MAPS replaced');
assert.deepEqual(atlas.buildDornhainUnifiedCanvasDoc(), bundle.rootDoc, 'root canvas replaced');
assert.ok(bundle.derivedRefs.length >= 20, `derived geometry refs tracked (${bundle.derivedRefs.length})`);

rmSync(tmp, { recursive: true, force: true });
console.log(`✓ atlas-default-world.self-test: 9/9 (2 continents, 4 countries, 10 places, 6-level deep ref, 4 procedural dungeons, calibrated bottom-up)`);
