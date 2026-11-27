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

// 1. Relation defaults (CONTAINED | CARVED | freeland, plus deprecated FLOWING alias)
{
  const w = makeBaseWorld();
  assert.equal(scm.resolveRelation(w, 'country'), 'CONTAINED');
  assert.equal(scm.resolveRelation(w, 'caveRoom'), 'CARVED', 'room inside mountain resolves to CARVED');
  assert.equal(scm.resolveRelation(w, 'river'), 'freeland', 'river resolves to canonical freeland');
  assert.equal(scm.isFreelandRelation('freeland'), true);
  assert.equal(scm.isFreelandRelation('FLOWING'), true, 'deprecated FLOWING alias stays compatible');
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

// 10. Kody #4719499790: planRestore requires grow confirmation when restoring expands a shrunk carrier
{
  const w = makeBaseWorld();
  const rem = prop.planPropagation(w, { kind: 'remove', entityId: 'mountain' });
  assert.equal(rem.ok, true);
  const removed = prop.applyWorldOperation(w, rem.plan);
  assert.equal(removed.ok, true);
  // Shrink country so restoring mountain (200..260) requires growing country
  const shrunk = {
    ...removed.world,
    entities: {
      ...removed.world.entities,
      country: {
        ...removed.world.entities.country,
        boundsWorld: { minX: 210, minY: 210, maxX: 230, maxY: 230 },
      },
    },
  };
  const rest = prop.planPropagation(shrunk, { kind: 'restore', entityId: 'mountain' });
  assert.equal(rest.ok, true);
  assert.ok(rest.plan.grownCarrierIds.includes('country'), 'restore must grow shrunk carrier');
  assert.equal(rest.plan.requiresConfirmation, 'grow', 'restore expanding carrier requires grow confirmation');
  passed += 1;
}

// 11. Kody #4719500232 & #4719500726: Soft-archive persists spatialArchive & freeland persists all clipped segments
{
  const rootDoc = {
    format: 'sagatree-unified-atlas-v1',
    layers: { terrain: true, roads: true, region: true, city: true, interior: true, drawings: true, objects: true, grid: false },
    rooms: [],
    walls: [],
    objects: [{ id: 'o.hut', type: 'haus', x: 300, y: 300, size: 1 }],
    strokes: [
      {
        id: 'st.river',
        material: 'wasser',
        width: 12,
        points: [
          [100, 500],
          [900, 500],
        ],
      },
    ],
  };
  const worldModel = bridge.buildSpatialWorldFromMapSources([
    {
      mapId: 'm.root',
      title: 'Root',
      role: 'world',
      parentMapId: null,
      parentAnchor: null,
      doc: rootDoc,
    },
  ]);
  assert.ok(worldModel);
  const objEntityId = 'obj:m.root:o.hut';
  const strokeEntityId = 'stroke:m.root:st.river';
  // Simulate archiving object + splitting freeland stroke into 2 clipped segments
  const nextModel = {
    ...worldModel,
    entities: {
      ...worldModel.entities,
      [objEntityId]: {
        ...worldModel.entities[objEntityId],
        status: 'archived',
        archivedByEntityId: 'map:m.root',
      },
      [strokeEntityId]: {
        ...worldModel.entities[strokeEntityId],
        clippedSegmentsWorld: [
          [[100, 500], [350, 500]],
          [[650, 500], [900, 500]],
        ],
      },
    },
  };
  const mutations = bridge.projectSpatialOperationToMapUpdates({
    world: nextModel,
    plan: {
      intent: { kind: 'remove', entityId: objEntityId },
      targetEntityId: objEntityId,
      targetRelation: 'CONTAINED',
      requiresConfirmation: 'none',
      grownCarrierIds: [],
      archivedDescendantIds: [objEntityId],
      reroutedFlowingIds: [strokeEntityId],
      cascadeCounts: { continents: 0, countries: 0, settlements: 0, buildings: 1, rooms: 0, other: 0, total: 1, flowingAffected: 1 },
      changes: [
        { entityId: objEntityId, mapId: 'm.root', featureId: 'o.hut', labelDe: 'haus', role: 'building', relation: 'CONTAINED', kind: 'archive_descendant' },
        { entityId: strokeEntityId, mapId: 'm.root', featureId: 'st.river', labelDe: 'Fluss', role: 'river', relation: 'freeland', kind: 'reroute_flowing' },
      ],
      affectedMapIds: ['m.root'],
      summaryDe: 'test',
    },
    docsByMapId: { 'm.root': rootDoc },
    mapNodes: worldModel.mapNodes,
  });
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].nextDoc.objects.length, 0, 'archived object hidden from active doc.objects');
  assert.equal(mutations[0].nextSpatialArchive?.length, 1, 'archived object persisted in spatialArchive');
  assert.equal(mutations[0].nextSpatialArchive?.[0].featureId, 'o.hut');
  assert.equal(mutations[0].nextDoc.strokes.length, 2, 'both clipped freeland segments persisted');
  assert.equal(mutations[0].nextDoc.strokes[0].id, 'st.river');
  assert.equal(mutations[0].nextDoc.strokes[1].id, 'st.river#clip1');

  // Rehydrate after reload — archived object & both clipped stroke segments survive!
  const reloaded = bridge.buildSpatialWorldFromMapSources([
    {
      mapId: 'm.root',
      title: 'Root',
      role: 'world',
      parentMapId: null,
      parentAnchor: null,
      doc: mutations[0].nextDoc,
      spatialArchive: mutations[0].nextSpatialArchive,
    },
  ]);
  assert.ok(reloaded);
  assert.equal(reloaded.entities[objEntityId]?.status, 'archived', 'archived object rehydrated after reload');
  assert.equal(reloaded.entities[strokeEntityId]?.clippedSegmentsWorld?.length, 2, 'clipped segments rehydrated after reload');
  passed += 1;
}

console.log(`✓ scm-invariants.self-test: ${passed}/11 (INV-1..6, SCM-08, Default World, M-2 clipping, restore grow-confirm, archive+freeland persistence)`);
