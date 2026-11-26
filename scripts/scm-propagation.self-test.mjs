#!/usr/bin/env node
/**
 * scm-propagation.self-test — SCM-01 (inland house grow), SCM-02 (coastal grow chain),
 * SCM-03 (CARVED mountain cavity & outer breach), SCM-04 (FLOWING river routing/capping).
 * Location: scripts/scm-propagation.self-test.mjs
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const scm = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-containment.ts'));
const prop = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-propagation.ts'));
const hist = jiti(join(root, 'src/domains/world/atlas/atlas-world-operation-history.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-world-bridge.ts'));

function makePropagationWorld() {
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
      continent: {
        id: 'continent',
        mapId: 'm.continent',
        featureId: '__map_frame__',
        labelDe: 'Kontinent Westmark',
        role: 'continent',
        carrierId: 'world',
        boundsWorld: { minX: 100, minY: 100, maxX: 500, maxY: 500 },
        status: 'active',
      },
      landmass: {
        id: 'landmass',
        mapId: 'm.landmass',
        featureId: '__map_frame__',
        labelDe: 'Nordreich',
        role: 'landmass',
        carrierId: 'continent',
        boundsWorld: { minX: 120, minY: 120, maxX: 500, maxY: 460 },
        status: 'active',
      },
      // City in the middle of Nordreich (plenty of room on all sides)
      inlandCity: {
        id: 'inlandCity',
        mapId: 'm.dornhain',
        featureId: '__map_frame__',
        labelDe: 'Dornhain',
        role: 'settlement',
        carrierId: 'landmass',
        boundsWorld: { minX: 250, minY: 250, maxX: 300, maxY: 300 },
        status: 'active',
      },
      house: {
        id: 'house',
        mapId: 'm.dornhain',
        featureId: 'obj.house1',
        labelDe: 'Taverne',
        role: 'building',
        carrierId: 'inlandCity',
        boundsWorld: { minX: 280, minY: 260, maxX: 298, maxY: 280 },
        status: 'active',
      },
      // Coastal city touching east border of landmass (x=500) & continent (x=500)
      coastalCity: {
        id: 'coastalCity',
        mapId: 'm.kueste',
        featureId: '__map_frame__',
        labelDe: 'Hafenstadt',
        role: 'settlement',
        carrierId: 'landmass',
        boundsWorld: { minX: 460, minY: 200, maxX: 500, maxY: 250 },
        status: 'active',
      },
      // Mountain containing a CARVED house
      mountain: {
        id: 'mountain',
        mapId: 'm.landmass',
        featureId: 'obj.berg',
        labelDe: 'Eisengrat-Berg',
        role: 'mountain',
        carrierId: 'landmass',
        boundsWorld: { minX: 150, minY: 340, maxX: 230, maxY: 420 },
        status: 'active',
      },
      mountainHouse: {
        id: 'mountainHouse',
        mapId: 'm.landmass',
        featureId: 'obj.berghaus',
        labelDe: 'Haus im Berg',
        role: 'building',
        carrierId: 'mountain',
        boundsWorld: { minX: 180, minY: 370, maxX: 200, maxY: 390 },
        status: 'active',
      },
      // River flowing across landmass to east coast (x=500)
      river: {
        id: 'river',
        mapId: 'm.landmass',
        featureId: 'st.nordfluss',
        labelDe: 'Nordfluss',
        role: 'river',
        carrierId: 'landmass',
        boundsWorld: { minX: 140, minY: 220, maxX: 500, maxY: 220 },
        polylineWorld: [
          [140, 220],
          [320, 220],
          [500, 220],
        ],
        status: 'active',
      },
    },
  };
}

let passed = 0;

// SCM-01: House grows past inland city border → ONLY city grows; landmass/continent untouched; 1 Undo restores all
{
  const w0 = makePropagationWorld();
  const h0 = hist.emptySpatialWorldHistory();
  const planRes = prop.planPropagation(w0, {
    kind: 'resize_or_move',
    entityId: 'house',
    nextBoundsWorld: { minX: 280, minY: 260, maxX: 325, maxY: 280 },
  });
  assert.equal(planRes.ok, true);
  assert.equal(planRes.plan.requiresConfirmation, 'grow');
  assert.deepEqual(planRes.plan.grownCarrierIds, ['inlandCity']);
  assert.ok(planRes.plan.summaryDe.includes('Dornhain'));

  const exec = hist.executeSpatialWorldOperation(w0, h0, planRes.plan);
  assert.equal(exec.ok, true);
  assert.equal(exec.world.entities.inlandCity.boundsWorld.maxX, 325, 'city expanded to 325');
  assert.equal(exec.world.entities.landmass.boundsWorld.maxX, 500, 'landmass unchanged (INV-3 stop)');
  assert.equal(exec.world.entities.continent.boundsWorld.maxX, 500, 'continent unchanged');
  assert.equal(exec.history.past.length, 1, 'exactly ONE undo step (INV-6)');

  const undone = hist.undoSpatialWorldOperation(exec.world, exec.history);
  assert.ok(undone);
  assert.equal(undone.world.entities.house.boundsWorld.maxX, 298);
  assert.equal(undone.world.entities.inlandCity.boundsWorld.maxX, 300);
  passed += 1;
}

// SCM-02: Coastal city expands into ocean → chain landmass + continent grow atomically; world root untouched; 1 Undo restores all
{
  const w0 = makePropagationWorld();
  const h0 = hist.emptySpatialWorldHistory();
  const planRes = prop.planPropagation(w0, {
    kind: 'resize_or_move',
    entityId: 'coastalCity',
    nextBoundsWorld: { minX: 460, minY: 200, maxX: 540, maxY: 250 },
  });
  assert.equal(planRes.ok, true);
  assert.equal(planRes.plan.requiresConfirmation, 'grow');
  assert.deepEqual(planRes.plan.grownCarrierIds, ['landmass', 'continent']);
  assert.ok(planRes.plan.summaryDe.includes('Nordreich') && planRes.plan.summaryDe.includes('Kontinent Westmark'));

  const exec = hist.executeSpatialWorldOperation(w0, h0, planRes.plan);
  assert.equal(exec.ok, true);
  assert.equal(exec.world.entities.coastalCity.boundsWorld.maxX, 540);
  assert.equal(exec.world.entities.landmass.boundsWorld.maxX, 540);
  assert.equal(exec.world.entities.continent.boundsWorld.maxX, 540);
  assert.equal(exec.world.entities.world.boundsWorld.maxX, 1000, 'world root accommodated without growing');
  // SCM-04 bonus: river endpoint at old coast (500) automatically extended to new coast (540)!
  assert.ok(planRes.plan.reroutedFlowingIds.includes('river'));
  assert.equal(exec.world.entities.river.boundsWorld.maxX, 540);
  assert.equal(exec.history.past.length, 1, 'entire chain is ONE undo entry');

  const undone = hist.undoSpatialWorldOperation(exec.world, exec.history);
  assert.ok(undone);
  assert.equal(undone.world.entities.coastalCity.boundsWorld.maxX, 500);
  assert.equal(undone.world.entities.landmass.boundsWorld.maxX, 500);
  assert.equal(undone.world.entities.continent.boundsWorld.maxX, 500);
  assert.equal(undone.world.entities.river.boundsWorld.maxX, 500);

  const redone = hist.redoSpatialWorldOperation(undone.world, undone.history);
  assert.ok(redone);
  assert.equal(redone.world.entities.continent.boundsWorld.maxX, 540);
  passed += 1;
}

// SCM-03: CARVED house in mountain → inner growth hollows cavity WITHOUT changing outer contour; outer breach grows mountain
{
  const w0 = makePropagationWorld();
  const h0 = hist.emptySpatialWorldHistory();
  assert.equal(scm.resolveRelation(w0, 'mountainHouse'), 'CARVED');

  // 3a) Inner growth inside mountain (150..230): cavity grows, outer contour unchanged, no prompt!
  const innerPlan = prop.planPropagation(w0, {
    kind: 'resize_or_move',
    entityId: 'mountainHouse',
    nextBoundsWorld: { minX: 165, minY: 360, maxX: 215, maxY: 405 },
  });
  assert.equal(innerPlan.ok, true);
  assert.equal(innerPlan.plan.requiresConfirmation, 'none');
  assert.deepEqual(innerPlan.plan.grownCarrierIds, []);
  assert.ok(innerPlan.plan.changes.some((c) => c.entityId === 'mountain' && c.kind === 'carve_cavity'));

  const execInner = hist.executeSpatialWorldOperation(w0, h0, innerPlan.plan);
  assert.equal(execInner.ok, true);
  assert.deepEqual(execInner.world.entities.mountain.boundsWorld, w0.entities.mountain.boundsWorld, 'outer mountain contour unchanged');
  assert.equal(execInner.world.entities.mountain.cavityBoundsWorld.maxX, 215);

  // 3b) Outer breach past mountain wall (x=245 > 230): outer mountain grows, landmass still accommodates!
  const breachPlan = prop.planPropagation(execInner.world, {
    kind: 'resize_or_move',
    entityId: 'mountainHouse',
    nextBoundsWorld: { minX: 165, minY: 360, maxX: 245, maxY: 405 },
  });
  assert.equal(breachPlan.ok, true);
  assert.equal(breachPlan.plan.requiresConfirmation, 'grow');
  assert.deepEqual(breachPlan.plan.grownCarrierIds, ['mountain']);

  const execBreach = hist.executeSpatialWorldOperation(execInner.world, execInner.history, breachPlan.plan);
  assert.equal(execBreach.ok, true);
  assert.equal(execBreach.world.entities.mountain.boundsWorld.maxX, 245);
  assert.equal(execBreach.world.entities.landmass.boundsWorld.maxX, 500, 'landmass unchanged');
  passed += 1;
}

// SCM-04: FLOWING river reroutes/caps on topography change & NEVER grows topography (INV-5)
{
  const w0 = makePropagationWorld();
  // Shrink landmass east border from 500 → 400 (removing coastalCity first so landmass can shrink)
  const wWithoutCoast = {
    ...w0,
    entities: {
      ...w0.entities,
      coastalCity: { ...w0.entities.coastalCity, status: 'archived', archivedByEntityId: 'coastalCity' },
    },
  };
  const shrinkPlan = prop.planPropagation(wWithoutCoast, {
    kind: 'resize_or_move',
    entityId: 'landmass',
    nextBoundsWorld: { minX: 120, minY: 120, maxX: 400, maxY: 460 },
  });
  assert.equal(shrinkPlan.ok, true);
  assert.ok(shrinkPlan.plan.reroutedFlowingIds.includes('river'));
  const execShrink = prop.applyWorldOperation(wWithoutCoast, shrinkPlan.plan);
  assert.equal(execShrink.ok, true);
  assert.equal(execShrink.world.entities.river.status, 'active', 'river capped, NOT deleted');
  assert.equal(execShrink.world.entities.river.boundsWorld.maxX, 400, 'river capped at new coast x=400');

  // Moving river beyond landmass caps river; landmass NEVER grows (INV-5)
  const riverMovePlan = prop.planPropagation(w0, {
    kind: 'resize_or_move',
    entityId: 'river',
    nextBoundsWorld: { minX: 140, minY: 220, maxX: 620, maxY: 220 },
    nextPolylineWorld: [
      [140, 220],
      [620, 220],
    ],
  });
  assert.equal(riverMovePlan.ok, true);
  assert.deepEqual(riverMovePlan.plan.grownCarrierIds, [], 'FLOWING edit never grows topography (INV-5)');
  const execRiver = prop.applyWorldOperation(w0, riverMovePlan.plan);
  assert.equal(execRiver.ok, true);
  assert.equal(execRiver.world.entities.landmass.boundsWorld.maxX, 500);
  assert.equal(execRiver.world.entities.river.boundsWorld.maxX, 500, 'river capped to landmass');
  passed += 1;
}

// 5. Bridge projection to per-map UnifiedCanvasDoc + ParentSpatialAnchor
{
  const defaultWorld = bridge.buildSpatialWorldFromDefaultWorld();
  const dornhainFrameId = 'map:dornhain.map.place.dornhain';
  const targetObj = Object.values(defaultWorld.entities).find(
    (e) => e.carrierId === dornhainFrameId && e.role === 'building',
  );
  assert.ok(targetObj, 'building inside Dornhain exists in default world');
  const dornhainBounds = defaultWorld.entities[dornhainFrameId].boundsWorld;
  const planRes = prop.planPropagation(defaultWorld, {
    kind: 'resize_or_move',
    entityId: targetObj.id,
    nextBoundsWorld: {
      minX: targetObj.boundsWorld.minX,
      minY: targetObj.boundsWorld.minY,
      maxX: dornhainBounds.maxX + 0.5,
      maxY: targetObj.boundsWorld.maxY,
    },
  });
  assert.equal(planRes.ok, true);
  assert.ok(planRes.plan.grownCarrierIds.includes(dornhainFrameId), 'Dornhain map frame grows');
  const applied = prop.applyWorldOperation(defaultWorld, planRes.plan);
  assert.equal(applied.ok, true);
  const mutations = bridge.projectSpatialOperationToMapUpdates({
    world: applied.world,
    plan: planRes.plan,
    docsByMapId: {},
    mapNodes: defaultWorld.mapNodes,
  });
  const dornhainMut = mutations.find((m) => m.mapId === 'dornhain.map.place.dornhain');
  assert.ok(dornhainMut?.nextParentAnchor, 'Dornhain ParentSpatialAnchor updated in parent local space');
  assert.ok(dornhainMut.nextParentAnchor.extentX > 20, 'anchor extentX expanded cleanly');

  // Regression (M-2 reload): growing a CHILD MAP FRAME (e.g. Tavern/Krypta) past Dornhain must
  // project the child anchor into Dornhain's NEW expanded anchor frame (never exceeding 0..1000)!
  const tavernFrameId = 'map:dornhain.map.loc.tavern';
  const tavern = defaultWorld.entities[tavernFrameId];
  assert.ok(tavern, 'Tavern child map frame exists in default world');
  const childFramePlan = prop.planPropagation(defaultWorld, {
    kind: 'resize_or_move',
    entityId: tavernFrameId,
    nextBoundsWorld: {
      minX: tavern.boundsWorld.minX,
      minY: tavern.boundsWorld.minY,
      maxX: dornhainBounds.maxX + 0.4,
      maxY: tavern.boundsWorld.maxY,
    },
  });
  assert.equal(childFramePlan.ok, true);
  const childApplied = prop.applyWorldOperation(defaultWorld, childFramePlan.plan);
  assert.equal(childApplied.ok, true);
  const childMuts = bridge.projectSpatialOperationToMapUpdates({
    world: childApplied.world,
    plan: childFramePlan.plan,
    docsByMapId: {},
    mapNodes: defaultWorld.mapNodes,
  });
  const tavernMut = childMuts.find((m) => m.mapId === 'dornhain.map.loc.tavern');
  assert.ok(tavernMut?.nextParentAnchor, 'Tavern child anchor updated');
  assert.ok(
    tavernMut.nextParentAnchor.centerX + tavernMut.nextParentAnchor.extentX <= 1000,
    `child map frame must stay <= 1000 inside grown parent (got ${tavernMut.nextParentAnchor.centerX + tavernMut.nextParentAnchor.extentX})`,
  );
  passed += 1;
}

console.log(`✓ scm-propagation.self-test: ${passed}/5 (SCM-01 inland grow, SCM-02 coastal chain, SCM-03 CARVED, SCM-04 FLOWING, Bridge projection)`);
