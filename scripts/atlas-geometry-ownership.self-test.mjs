#!/usr/bin/env node
/**
 * atlas-geometry-ownership.self-test — SWS-02 Single Source of Truth + Bottom-Up derivation.
 *
 * Verifies (ADR-SWS-01 §4):
 *  - Authoritative direction table: physical geography = bottom-up, dungeon = top-down.
 *  - Conflict detection: multiple authoritative maps for same bottom-up structure fail-closed.
 *  - Multi-structure worlds: distinct `structureId` values do not falsely conflict;
 *    duplicate claims on the SAME `structureId` DO conflict.
 *  - Direction mismatch & empty mapId fail-closed.
 *  - Material→structure heuristic stops on ambiguous materials (wasser, stein).
 *  - Ownership fingerprint is order-independent and invalidates on owner change.
 *  - Bottom-up projection (room / stroke / object) maps child coords to exact parent coords.
 *  - RDP simplification preserves endpoints and reduces collinear points.
 *  - Calibrated `metersPerUnit` derivation matches parent * (2*extent / childWidth).
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-geometry-ownership-'));
const outfile = join(tmp, 'go.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/atlas-geometry-ownership.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const go = await import(pathToFileURL(outfile).href);

// 1) Direction table: geography = bottom-up, dungeon = top-down
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.landmass, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.river, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.road, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.terrain, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.building, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.room, 'bottom-up');
assert.equal(go.ATLAS_GEOMETRY_STRUCTURE_DIRECTION.dungeon, 'top-down');

// 2) Material heuristic stops on ambiguous materials
assert.equal(go.inferStructureFromMaterial('wasser'), null, 'wasser ambiguous (ocean vs river)');
assert.equal(go.inferStructureFromMaterial('stein'), null, 'stein ambiguous');
assert.equal(go.inferStructureFromMaterial('pflaster'), 'road');
assert.equal(go.inferStructureFromMaterial('gras'), 'landmass');
assert.equal(go.inferStructureFromMaterial('holz'), 'building');

// 3) Single consistent bottom-up chain → 0 conflicts
const cleanOwners = [
  { structure: 'landmass', direction: 'bottom-up', authoritativeMapId: 'map-westmark' },
  { structure: 'river', direction: 'bottom-up', authoritativeMapId: 'map-dornhain' },
  { structure: 'dungeon', direction: 'top-down', authoritativeMapId: 'map-krypta' },
  { structure: 'dungeon', direction: 'top-down', authoritativeMapId: 'map-mine' },
];
assert.deepEqual(go.findGeometryOwnershipConflicts(cleanOwners), [], 'consistent ownership has 0 conflicts');

// 4) Conflict: two maps claiming the same unnamed bottom-up structure
const dupConflicts = go.findGeometryOwnershipConflicts([
  { structure: 'river', direction: 'bottom-up', authoritativeMapId: 'map-land' },
  { structure: 'river', direction: 'bottom-up', authoritativeMapId: 'map-ort' },
]);
assert.equal(dupConflicts.length, 1);
assert.equal(dupConflicts[0].kind, 'multiple-owners');
assert.equal(dupConflicts[0].structure, 'river');
assert.deepEqual(dupConflicts[0].mapIds, ['map-land', 'map-ort']);

// 5) Multi-place world with distinct structureIds → 0 conflicts; same structureId on 2 maps → conflict
const multiPlaceOk = go.findGeometryOwnershipConflicts([
  { structure: 'river', structureId: 'river.dornbach', direction: 'bottom-up', authoritativeMapId: 'ort-dornhain' },
  { structure: 'river', structureId: 'river.silberfluss', direction: 'bottom-up', authoritativeMapId: 'ort-silberfurt' },
]);
assert.deepEqual(multiPlaceOk, [], 'distinct physical rivers do not conflict');

const multiPlaceDup = go.findGeometryOwnershipConflicts([
  { structure: 'river', structureId: 'river.dornbach', direction: 'bottom-up', authoritativeMapId: 'ort-dornhain' },
  { structure: 'river', structureId: 'river.dornbach', direction: 'bottom-up', authoritativeMapId: 'land-nordreich' },
]);
assert.equal(multiPlaceDup.length, 1);
assert.equal(multiPlaceDup[0].structureId, 'river.dornbach');
assert.equal(multiPlaceDup[0].kind, 'multiple-owners');

// 6) Direction mismatch & empty mapId fail-closed
const dirMismatch = go.findGeometryOwnershipConflicts([
  { structure: 'river', direction: 'top-down', authoritativeMapId: 'map-x' },
]);
assert.equal(dirMismatch.length, 1);
assert.equal(dirMismatch[0].kind, 'direction-mismatch');
assert.equal(dirMismatch[0].reasonDe, go.GEOMETRY_OWNERSHIP_DIRECTION_MISMATCH_DE);

const unlocated = go.findGeometryOwnershipConflicts([
  { structure: 'road', direction: 'bottom-up', authoritativeMapId: '   ' },
]);
assert.equal(unlocated.length, 1);
assert.equal(unlocated[0].kind, 'unlocated-owner');
assert.equal(unlocated[0].reasonDe, go.GEOMETRY_OWNERSHIP_UNLOCATED_DE);

// 7) Fingerprint is order-independent and invalidates on owner change
const fpA = go.geometryOwnershipFingerprint([cleanOwners[0], cleanOwners[1]]);
const fpB = go.geometryOwnershipFingerprint([cleanOwners[1], cleanOwners[0]]);
assert.equal(fpA, fpB, 'fingerprint order-independent');
const fpC = go.geometryOwnershipFingerprint([
  cleanOwners[0],
  { ...cleanOwners[1], authoritativeMapId: 'map-other' },
]);
assert.notEqual(fpA, fpC, 'fingerprint invalidates on owner change');

// 8) Bottom-up derivation: child stroke/room/object project accurately to parent
const anchor = {
  parentMapId: 'land-nordreich',
  centerX: 400,
  centerY: 500,
  extentX: 20,
  extentY: 20,
  rotationRad: 0,
  metersPerUnit: 1,
};
const childStroke = {
  id: 'ort.river',
  material: 'wasser',
  width: 20,
  points: [
    [0, 500],
    [500, 500],
    [1000, 500],
  ],
};
const derivedStroke = go.deriveCoarseStrokeFromChild(anchor, childStroke, 'derived.river', {
  simplifyEpsilon: 0.5,
});
assert.ok(derivedStroke, 'derived stroke created');
// Collinear midpoint (400, 500) simplified out; endpoints exact: (380, 500) → (420, 500)
assert.deepEqual(derivedStroke.points, [
  [380, 500],
  [420, 500],
]);
assert.ok(derivedStroke.width >= 2, 'coarse stroke retains readable min width');

const childRoom = { id: 'ort.plaza', material: 'pflaster', x: 250, y: 250, w: 500, h: 500 };
const derivedRoom = go.deriveCoarseRoomFromChild(anchor, childRoom, 'derived.plaza');
assert.ok(derivedRoom, 'derived room created');
assert.equal(derivedRoom.x, 390);
assert.equal(derivedRoom.y, 490);
assert.equal(derivedRoom.w, 20);
assert.equal(derivedRoom.h, 20);

const childObj = { id: 'ort.tavern', type: 'haus', x: 500, y: 500, size: 0.6 };
const derivedObj = go.deriveCoarseObjectFromChild(anchor, childObj, 'derived.tavern');
assert.equal(derivedObj.x, 400);
assert.equal(derivedObj.y, 500);

// 9) Calibrated metersPerUnit derivation
// Parent = 25 m/unit, child extent = 20 (width 40 in parent = 1000 m), child bounds = 1000 → 1 m/unit
assert.equal(go.deriveCalibratedChildMetersPerUnit(25, anchor), 1);
assert.equal(go.deriveCalibratedChildMetersPerUnit(null, anchor), null);

// 10) Derived geometry fingerprint determinism + change detection
const dfp1 = go.computeGeometryDerivedFingerprint('ort-dornhain', derivedStroke);
const dfp2 = go.computeGeometryDerivedFingerprint('ort-dornhain', derivedStroke);
const dfp3 = go.computeGeometryDerivedFingerprint('ort-dornhain', { ...derivedStroke, width: 9 });
assert.equal(dfp1, dfp2);
assert.notEqual(dfp1, dfp3);
assert.equal(dfp1.length, 16);

rmSync(tmp, { recursive: true, force: true });
console.log('✓ atlas-geometry-ownership.self-test: 10/10 (ownership, conflicts, structureId, bottom-up derivation, calibration)');
