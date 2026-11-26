#!/usr/bin/env node
/**
 * scm-cascade-prefs.self-test — SCM-05 (downward soft-cascade + restore + FLOWING capping),
 * SCM-06 (persistent spatial edit preferences + atomic undo with prompts off),
 * SCM-07 (pure zoom-driven layer indicator state across all 6 levels).
 * Location: scripts/scm-cascade-prefs.self-test.mjs
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const prop = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-propagation.ts'));
const hist = jiti(join(root, 'src/domains/world/atlas/atlas-world-operation-history.ts'));
const prefs = jiti(join(root, 'src/domains/world/atlas/atlas-spatial-edit-prefs.ts'));
const zoomLayer = jiti(join(root, 'src/domains/world/atlas/atlas-zoom-layer-state.ts'));

function makeCascadeWorld() {
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
        labelDe: 'Westmark',
        role: 'continent',
        carrierId: 'world',
        boundsWorld: { minX: 100, minY: 100, maxX: 600, maxY: 600 },
        status: 'active',
      },
      landmass: {
        id: 'landmass',
        mapId: 'm.landmass',
        featureId: 'rm.land',
        labelDe: 'Nord-Halbinsel',
        role: 'landmass',
        carrierId: 'continent',
        boundsWorld: { minX: 200, minY: 200, maxX: 450, maxY: 450 },
        status: 'active',
      },
      country: {
        id: 'country',
        mapId: 'm.country',
        featureId: '__map_frame__',
        labelDe: 'Nordreich',
        role: 'country',
        carrierId: 'landmass',
        boundsWorld: { minX: 220, minY: 220, maxX: 430, maxY: 430 },
        status: 'active',
      },
      city: {
        id: 'city',
        mapId: 'm.city',
        featureId: '__map_frame__',
        labelDe: 'Dornhain',
        role: 'settlement',
        carrierId: 'country',
        boundsWorld: { minX: 260, minY: 260, maxX: 340, maxY: 340 },
        status: 'active',
      },
      h1: { id: 'h1', mapId: 'm.city', featureId: 'o.h1', labelDe: 'Haus 1', role: 'building', carrierId: 'city', boundsWorld: { minX: 270, minY: 270, maxX: 280, maxY: 280 }, status: 'active' },
      h2: { id: 'h2', mapId: 'm.city', featureId: 'o.h2', labelDe: 'Haus 2', role: 'building', carrierId: 'city', boundsWorld: { minX: 285, minY: 270, maxX: 295, maxY: 280 }, status: 'active' },
      h3: { id: 'h3', mapId: 'm.city', featureId: 'o.h3', labelDe: 'Haus 3', role: 'building', carrierId: 'city', boundsWorld: { minX: 300, minY: 270, maxX: 310, maxY: 280 }, status: 'active' },
      h4: { id: 'h4', mapId: 'm.city', featureId: 'o.h4', labelDe: 'Haus 4', role: 'building', carrierId: 'city', boundsWorld: { minX: 315, minY: 270, maxX: 325, maxY: 280 }, status: 'active' },
      // River crossing the landmass from continent (x=120) through landmass (200..450) to x=560
      river: {
        id: 'river',
        mapId: 'm.continent',
        featureId: 'st.river',
        labelDe: 'Grenzfluss',
        role: 'river',
        carrierId: 'continent',
        boundsWorld: { minX: 120, minY: 300, maxX: 560, maxY: 300 },
        polylineWorld: [
          [120, 300],
          [560, 300],
        ],
        status: 'active',
      },
    },
  };
}

let passed = 0;

// SCM-05: Remove landmass → confirm lists "1 Land, 1 Stadt und 4 Häuser"; soft-cascade archives (recoverable); river capped; 1 Undo restores all
{
  const w0 = makeCascadeWorld();
  const h0 = hist.emptySpatialWorldHistory();

  // Root removal rejected (INV-1/INV-5)
  const rootDel = prop.planPropagation(w0, { kind: 'remove', entityId: 'world' });
  assert.equal(rootDel.ok, false);
  assert.equal(rootDel.code, 'cannot-remove-root');

  const planRes = prop.planPropagation(w0, { kind: 'remove', entityId: 'landmass' });
  assert.equal(planRes.ok, true);
  assert.equal(planRes.plan.requiresConfirmation, 'cascade');
  assert.equal(planRes.plan.cascadeCounts.countries, 1);
  assert.equal(planRes.plan.cascadeCounts.settlements, 1);
  assert.equal(planRes.plan.cascadeCounts.buildings, 4);
  assert.equal(planRes.plan.archivedDescendantIds.length, 6);
  assert.ok(planRes.plan.summaryDe.includes('1 Land, 1 Stadt und 4 Häuser'), `summary: ${planRes.plan.summaryDe}`);
  assert.deepEqual(planRes.plan.reroutedFlowingIds, ['river']);

  const exec = hist.executeSpatialWorldOperation(w0, h0, planRes.plan);
  assert.equal(exec.ok, true);
  for (const id of ['landmass', 'country', 'city', 'h1', 'h2', 'h3', 'h4']) {
    assert.equal(exec.world.entities[id].status, 'archived', `${id} soft-archived (not hard-deleted)`);
    assert.equal(exec.world.entities[id].archivedByEntityId, 'landmass');
  }
  assert.equal(exec.world.entities.river.status, 'active', 'river stays active (capped, not deleted)');
  assert.equal(exec.world.entities.river.clippedSegmentsWorld.length, 2, 'river cleanly split around removed landmass');

  // Recoverable via explicit `restore` intent!
  const restorePlan = prop.planPropagation(exec.world, { kind: 'restore', entityId: 'landmass' });
  assert.equal(restorePlan.ok, true);
  const restored = prop.applyWorldOperation(exec.world, restorePlan.plan);
  assert.equal(restored.ok, true);
  for (const id of ['landmass', 'country', 'city', 'h1', 'h2', 'h3', 'h4']) {
    assert.equal(restored.world.entities[id].status, 'active', `${id} recovered via restore`);
  }

  // Also 100% atomic via 1× Undo!
  const undone = hist.undoSpatialWorldOperation(exec.world, exec.history);
  assert.ok(undone);
  assert.equal(undone.world.entities.landmass.status, 'active');
  assert.equal(undone.world.entities.h4.status, 'active');
  assert.deepEqual(undone.world.entities.river.polylineWorld, [
    [120, 300],
    [560, 300],
  ]);
  passed += 1;
}

// SCM-06: Preferences defaults, „Nicht mehr nachfragen“, persistence parse/serialize & 100-cycle undo atomicity when prompts=false
{
  assert.equal(prefs.SPATIAL_EDIT_PREFS_STORAGE_KEY, 'sagatree.atlas.spatialEditPrefs.v1');
  assert.deepEqual(prefs.DEFAULT_SPATIAL_EDIT_PREFERENCES, {
    confirmGrow: true,
    confirmCascade: true,
  });
  assert.deepEqual(prefs.parseSpatialEditPreferences('invalid-json'), {
    confirmGrow: true,
    confirmCascade: true,
  });
  assert.equal(prefs.shouldPromptSpatialOperation({ requiresConfirmation: 'grow' }, prefs.DEFAULT_SPATIAL_EDIT_PREFERENCES), true);
  assert.equal(prefs.shouldPromptSpatialOperation({ requiresConfirmation: 'cascade' }, prefs.DEFAULT_SPATIAL_EDIT_PREFERENCES), true);
  assert.equal(prefs.shouldPromptSpatialOperation({ requiresConfirmation: 'none' }, prefs.DEFAULT_SPATIAL_EDIT_PREFERENCES), false);

  const afterGrowDismiss = prefs.applyDontAskAgainPreference(prefs.DEFAULT_SPATIAL_EDIT_PREFERENCES, 'grow');
  assert.deepEqual(afterGrowDismiss, { confirmGrow: false, confirmCascade: true });
  const roundtrip = prefs.parseSpatialEditPreferences(prefs.serializeSpatialEditPreferences(afterGrowDismiss));
  assert.deepEqual(roundtrip, afterGrowDismiss);
  assert.equal(prefs.shouldPromptSpatialOperation({ requiresConfirmation: 'grow' }, roundtrip), false);
  assert.equal(prefs.shouldPromptSpatialOperation({ requiresConfirmation: 'cascade' }, roundtrip), true);

  // Even with prompts disabled, 100 consecutive world operations remain atomic + undoable (INV-6)
  let curWorld = makeCascadeWorld();
  let curHist = hist.emptySpatialWorldHistory();
  for (let i = 1; i <= 105; i += 1) {
    const planRes = prop.planPropagation(curWorld, {
      kind: 'resize_or_move',
      entityId: 'h4',
      nextBoundsWorld: { minX: 315, minY: 270, maxX: 325 + i * 0.2, maxY: 280 },
    });
    assert.equal(planRes.ok, true);
    const exec = hist.executeSpatialWorldOperation(curWorld, curHist, planRes.plan);
    assert.equal(exec.ok, true);
    curWorld = exec.world;
    curHist = exec.history;
  }
  assert.equal(curHist.past.length, 100, 'bounded to ATLAS_EDIT_HISTORY_LIMIT (100)');
  let undoCount = 0;
  while (hist.canUndoSpatialWorld(curHist)) {
    const u = hist.undoSpatialWorldOperation(curWorld, curHist);
    assert.ok(u);
    curWorld = u.world;
    curHist = u.history;
    undoCount += 1;
  }
  assert.equal(undoCount, 100, 'all 100 transactions cleanly undoable');
  passed += 1;
}

// SCM-07: Pure zoom-driven layer indicator across all 6 hierarchy levels
{
  const nodes = [
    { id: 'p.westmark', label: 'Kontinent Westmark', parentId: null, primaryMapId: 'm.westmark' },
    { id: 'p.nordreich', label: 'Nordreich', parentId: 'p.westmark', primaryMapId: 'm.nordreich' },
    { id: 'p.dornhain', label: 'Dornhain', parentId: 'p.nordreich', primaryMapId: 'm.dornhain' },
    { id: 'p.tavern', label: 'Taverne Zum Flüstern', parentId: 'p.dornhain', primaryMapId: 'm.tavern' },
    { id: 'p.taproom', label: 'Schankraum', parentId: 'p.tavern', primaryMapId: 'm.taproom' },
  ];
  const sWorld = zoomLayer.deriveZoomLayerHierarchyState({
    activeEditorMapId: 'm.world',
    worldRootMapId: 'm.world',
    worldLabelDe: 'Welt Donalu',
    nodes,
  });
  assert.equal(sWorld.isWorldRoot, true);
  assert.equal(sWorld.activeDepth, 1);

  const sRoom = zoomLayer.deriveZoomLayerHierarchyState({
    activeEditorMapId: 'm.taproom',
    worldRootMapId: 'm.world',
    worldLabelDe: 'Welt Donalu',
    nodes,
  });
  assert.equal(sRoom.isWorldRoot, false);
  assert.equal(sRoom.activePlaceId, 'p.taproom');
  assert.equal(sRoom.activeLabelDe, 'Schankraum');
  assert.equal(sRoom.activeDepth, 6);
  assert.deepEqual(sRoom.activeBreadcrumbPlaceIds, [
    'p.westmark',
    'p.nordreich',
    'p.dornhain',
    'p.tavern',
    'p.taproom',
  ]);
  passed += 1;
}

console.log(`✓ scm-cascade-prefs.self-test: ${passed}/3 (SCM-05 soft-cascade+restore, SCM-06 prefs+100-cycle undo, SCM-07 zoom layer state)`);
