#!/usr/bin/env node
/**
 * scm-invariants.self-test — SCM-01 / INV-1..6 / SCM-08 / Liang-Barsky M-2 verification.
 * Location: scripts/scm-invariants.self-test.mjs
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const scm = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-containment.ts'));
const prop = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-propagation.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-world-bridge.ts'));
const multimap = jiti(join(root, 'src/infrastructure/world/atlas-three/atlas-three-multimap.ts'));

function makeBaseWorld() {
  return {
    rootTopographyId: 'world',
    entities: {
      world: {
        id: 'world',
        mapId: 'm.world',
        featureId: '__map_frame__',
        labelDe: 'Welt Donalu',
        role: 'world',
        carrierId: null,
        boundsWorld: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        status: 'active',
      },
      cont: {
        id: 'cont',
        mapId: 'm.cont',
        featureId: '__map_frame__',
        labelDe: 'Westmark',
        role: 'continent',
        carrierId: 'world',
        boundsWorld: { minX: 100, minY: 100, maxX: 500, maxY: 500 },
        status: 'active',
      },
      country: {
        id: 'country',
        mapId: 'm.country',
        featureId: '__map_frame__',
        labelDe: 'Nordreich',
        role: 'country',
        carrierId: 'cont',
        boundsWorld: { minX: 150, minY: 150, maxX: 400, maxY: 400 },
        status: 'active',
      },
      mountain: {
        id: 'mountain',
        mapId: 'm.country',
        featureId: 'f.mount',
        labelDe: 'Eisengrat',
        role: 'mountain',
        carrierId: 'country',
        boundsWorld: { minX: 200, minY: 200, maxX: 260, maxY: 260 },
        status: 'active',
      },
      caveRoom: {
        id: 'caveRoom',
        mapId: 'm.country',
        featureId: 'f.cave',
        labelDe: 'Bergkammer',
        role: 'room',
        carrierId: 'mountain',
        boundsWorld: { minX: 220, minY: 220, maxX: 240, maxY: 240 },
        status: 'active',
      },
      river: {
        id: 'river',
        mapId: 'm.country',
        featureId: 'f.river',
        labelDe: 'Nordfluss',
        role: 'river',
        carrierId: 'country',
        boundsWorld: { minX: 150, minY: 250, maxX: 400, maxY: 250 },
        polylineWorld: [
          [150, 250],
          [400, 250],
        ],
        status: 'active',
      },
    },
  };
}

let passed = 0;

// 1. Relation defaults (CONTAINED | CARVED | FLOWING)
{
  const w = makeBaseWorld();
  assert.equal(scm.resolveRelation(w, 'country'), 'CONTAINED');
  assert.equal(scm.resolveRelation(w, 'caveRoom'), 'CARVED', 'room inside mountain resolves to CARVED');
  assert.equal(scm.resolveRelation(w, 'river'), 'FLOWING', 'river resolves to FLOWING');
  const val = scm.validateSpatialInvariants(w);
  assert.equal(val.ok, true, `base world must be valid: ${JSON.stringify(val.violations)}`);
  passed += 1;
}

// 2. Calibrated Default World bridge passes INV-1..6
{
  const defaultWorld = bridge.buildSpatialWorldFromDefaultWorld();
  const val = scm.validateSpatialInvariants(defaultWorld);
  assert.equal(val.ok, true, `default world must satisfy INV-1..6: ${JSON.stringify(val.violations)}`);
  assert.ok(Object.keys(defaultWorld.entities).length > 25, 'default world hydrates maps + objects + strokes');
  passed += 1;
}

// 3. INV-1: missing root & multiple roots rejected fail-closed
{
  const w = makeBaseWorld();
  const noRoot = { ...w, rootTopographyId: 'missing' };
  const r1 = scm.validateSpatialInvariants(noRoot);
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.some((v) => v.invariant === 'INV-1' && v.code === 'missing-root-topography'));

  const twoRoots = {
    ...w,
    entities: {
      ...w.entities,
      secondWorld: {
        id: 'secondWorld',
        mapId: 'm.world2',
        featureId: '__map_frame__',
        labelDe: 'Zweitwelt',
        role: 'world',
        carrierId: null,
        boundsWorld: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
        status: 'active',
      },
    },
  };
  const r2 = scm.validateSpatialInvariants(twoRoots);
  assert.equal(r2.ok, false);
  assert.ok(r2.violations.some((v) => v.invariant === 'INV-1' && v.code === 'multiple-roots'));
  passed += 1;
}

// 4. INV-2: Containment overflow & carved breach rejected fail-closed
{
  const w = makeBaseWorld();
  const overflowed = {
    ...w,
    entities: {
      ...w.entities,
      country: {
        ...w.entities.country,
        boundsWorld: { minX: 50, minY: 150, maxX: 600, maxY: 400 },
      },
    },
  };
  const r = scm.validateSpatialInvariants(overflowed);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.invariant === 'INV-2' && v.code === 'containment-overflow'));

  const check = scm.checkContainment(w, 'caveRoom', { minX: 190, minY: 220, maxX: 240, maxY: 240 });
  assert.equal(check.fits, false);
  assert.equal(check.relation, 'CARVED');
  assert.ok(check.violations.some((v) => v.code === 'carved-breach'));
  passed += 1;
}

// 5. SCM-08: Carrier cycle, reparent cycle & SWS-01 map-anchor shear rejected fail-closed
{
  const w = makeBaseWorld();
  // Self-cycle reparent rejected
  const selfCycle = prop.planPropagation(w, {
    kind: 'reparent',
    entityId: 'cont',
    nextCarrierId: 'cont',
  });
  assert.equal(selfCycle.ok, false);
  assert.equal(selfCycle.code, 'cycle-rejected');

  // Descendant-cycle reparent rejected (cont -> country -> cont)
  const descCycle = prop.planPropagation(w, {
    kind: 'reparent',
    entityId: 'cont',
    nextCarrierId: 'country',
  });
  assert.equal(descCycle.ok, false);
  assert.equal(descCycle.code, 'cycle-rejected');

  // Direct cycle in model rejected by validateSpatialInvariants
  const cyclicWorld = {
    ...w,
    entities: {
      ...w.entities,
      cont: { ...w.entities.cont, carrierId: 'country' },
    },
  };
  const cv = scm.validateSpatialInvariants(cyclicWorld);
  assert.equal(cv.ok, false);
  assert.ok(cv.violations.some((v) => v.code === 'carrier-cycle'));

  // SWS-01 rotated non-uniform anchor shear rejected jointly
  const shearedWorld = {
    ...w,
    mapNodes: {
      'm.world': { id: 'm.world', parentAnchor: null },
      'm.cont': {
        id: 'm.cont',
        parentAnchor: {
          parentMapId: 'm.world',
          centerX: 300,
          centerY: 300,
          extentX: 100,
          extentY: 160,
          rotationRad: 0.4,
          metersPerUnit: 100,
        },
      },
    },
  };
  const sv = scm.validateSpatialInvariants(shearedWorld);
  assert.equal(sv.ok, false);
  assert.ok(sv.violations.some((v) => v.code === 'map-anchor-shear'));
  passed += 1;
}

// 6. INV-4: Active child inside archived carrier rejected fail-closed
{
  const w = makeBaseWorld();
  const broken = {
    ...w,
    entities: {
      ...w.entities,
      cont: { ...w.entities.cont, status: 'archived' },
    },
  };
  const r = scm.validateSpatialInvariants(broken);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.invariant === 'INV-4' && v.code === 'active-child-in-archived-carrier'));
  passed += 1;
}

// 7. INV-5: Topography cannot depend on river/building & root must be topography
{
  const w = makeBaseWorld();
  const invReparent = prop.planPropagation(w, {
    kind: 'reparent',
    entityId: 'mountain',
    nextCarrierId: 'river',
  });
  assert.equal(invReparent.ok, false);
  assert.equal(invReparent.code, 'topography-inversion-rejected');

  const badRoot = {
    ...w,
    entities: {
      ...w.entities,
      world: { ...w.entities.world, role: 'river' },
    },
  };
  const br = scm.validateSpatialInvariants(badRoot);
  assert.equal(br.ok, false);
  assert.ok(br.violations.some((v) => v.invariant === 'INV-5' && v.code === 'invalid-root-role'));
  passed += 1;
}

// 8. INV-6: applyWorldOperation rolls back cleanly if a plan violates post-invariants
{
  const w = makeBaseWorld();
  const forgedBadPlan = {
    intent: {
      kind: 'resize_or_move',
      entityId: 'country',
      nextBoundsWorld: { minX: 10, minY: 10, maxX: 900, maxY: 900 },
    },
    targetEntityId: 'country',
    targetRelation: 'CONTAINED',
    requiresConfirmation: 'none',
    grownCarrierIds: [],
    archivedDescendantIds: [],
    reroutedFlowingIds: [],
    cascadeCounts: {
      continents: 0,
      countries: 0,
      settlements: 0,
      buildings: 0,
      rooms: 0,
      other: 0,
      total: 0,
      flowingAffected: 0,
    },
    changes: [
      {
        entityId: 'country',
        mapId: 'm.country',
        featureId: '__map_frame__',
        labelDe: 'Nordreich',
        role: 'country',
        relation: 'CONTAINED',
        kind: 'update_target',
        prevBoundsWorld: w.entities.country.boundsWorld,
        // Intentionally overflows cont without growing cont!
        nextBoundsWorld: { minX: 10, minY: 10, maxX: 900, maxY: 900 },
      },
    ],
    affectedMapIds: ['m.country'],
    summaryDe: 'forged invalid plan',
  };
  const applied = prop.applyWorldOperation(w, forgedBadPlan);
  assert.equal(applied.ok, false);
  assert.equal(applied.code, 'post-invariant-failed');
  assert.equal(applied.world, w, 'rollback must return untouched input world');
  passed += 1;
}

// 9. Finding M-2: Liang-Barsky cutout clipping removes interior road/river overlap cleanly
{
  const doc = {
    format: 'sagatree-unified-atlas-v1',
    layers: { terrain: true, roads: true, region: true, city: true, interior: true, drawings: true, objects: true, grid: false },
    rooms: [],
    walls: [],
    objects: [],
    strokes: [
      {
        id: 'road.main',
        material: 'pflaster',
        width: 12,
        points: [
          [100, 500],
          [500, 500],
        ],
      },
    ],
  };
  const cutouts = [{ childMapId: 'dornhain', minX: 250, minY: 450, maxX: 350, maxY: 550 }];
  const filtered = multimap.applyLocalCutoutFilter(doc, cutouts);
  assert.equal(filtered.strokes.length, 2, 'road crossing cutout splits cleanly into 2 outer segments');
  assert.deepEqual(filtered.strokes[0].points, [
    [100, 500],
    [250, 500],
  ]);
  assert.deepEqual(filtered.strokes[1].points, [
    [350, 500],
    [500, 500],
  ]);
  passed += 1;
}

console.log(`✓ scm-invariants.self-test: ${passed}/9 (INV-1..6, SCM-08 fail-closed, Default World, M-2 Liang-Barsky clipping)`);
