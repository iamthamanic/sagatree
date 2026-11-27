#!/usr/bin/env node
/**
 * sws-write-guards.self-test — SWS-01 Host write-side cycle & shear guards (A3 / A4).
 *
 * Verifies against real Host SQLite `WorldAtlasStore.upsertMap`:
 *  - Self-parent cycle (A.parent = A) rejected fail-closed (`23514`).
 *  - 2-node cycle (A.parent = B, then B.parent = A) rejected fail-closed (`23514`).
 *  - 3-node cycle (A → B → C → A) rejected fail-closed (`23514`).
 *  - `mapFrame.parentAnchor` shear violation (rotationRad ≠ 0 && extentX ≠ extentY) rejected (`23514`).
 *  - `mapFrame.parentAnchor` rotated + uniform extent accepted.
 *  - `mapFrame.parentAnchor.parentMapId` cycle rejected fail-closed (`23514`).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { bootstrapHostPersistence } = await import(
  pathToFileURL(join(root, 'server/src/persistence/index.ts')).href
);
const { WorldAtlasStore } = await import(
  pathToFileURL(join(root, 'server/src/modules/world/internal/world-atlas-store.ts')).href
);

const work = mkdtempSync(join(tmpdir(), 'sws-write-guards-'));
mkdirSync(join(work, 'data'));

try {
  const boot = bootstrapHostPersistence({
    dataDir: join(work, 'data'),
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.equal(boot.ok, true, 'host persistence bootstrap');
  const db = boot.db;
  const owner = `solo-sws-${randomUUID().slice(0, 8)}`;
  const worldId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at, public_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(worldId, owner, 'SWS Guard Test World', now, `WD-${randomUUID().slice(0, 5).toUpperCase()}`);

  const store = new WorldAtlasStore(db, {
    canAccessWorld: () => true,
    resolveSagaProject: () => null,
    isActiveProjectMember: () => false,
    partyRevealedMapIds: () => new Set(),
  });
  const emptyLayers = { type: 'FeatureCollection', features: [] };

  // Create root A
  const resA = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas', mapStatus: 'ready' },
    expectedRevision: null,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(resA.ok, true, 'create Map A');

  // Create child B under A
  const resB = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Map B',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: resA.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 100,
          extentY: 100,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 1,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(resB.ok, true, 'create Map B');

  // Create grandchild C under B
  const resC = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resB.value.id,
    kind: 'settlement',
    title: 'Map C',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas', mapStatus: 'ready' },
    expectedRevision: null,
    sortOrder: 2,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(resC.ok, true, 'create Map C');

  // 1) Self-cycle A.parent = A rejected
  const selfCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resA.value.id,
    parentMapId: resA.value.id,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: resA.value.revision,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(selfCycle.ok, false, 'self-cycle rejected');
  assert.equal(selfCycle.error, '23514');

  // 2) 2-node cycle A.parent = B rejected (since B.parent = A)
  const twoCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resA.value.id,
    parentMapId: resB.value.id,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: resA.value.revision,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(twoCycle.ok, false, '2-node cycle rejected');
  assert.equal(twoCycle.error, '23514');

  // 3) 3-node cycle A.parent = C rejected (C → B → A)
  const threeCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resA.value.id,
    parentMapId: resC.value.id,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: resA.value.revision,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(threeCycle.ok, false, '3-node cycle rejected');
  assert.equal(threeCycle.error, '23514');

  // 4) Anchor cycle in generatorMeta.mapFrame.parentAnchor rejected
  const anchorCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resA.value.id,
    parentMapId: null,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: resC.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: resA.value.revision,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(anchorCycle.ok, false, 'anchor parent cycle rejected');
  assert.equal(anchorCycle.error, '23514');

  // 5) Shear violation on write (rotation != 0 && extentX != extentY) rejected
  const shearWrite = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Sheared Map',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: resA.value.id,
          centerX: 400,
          centerY: 400,
          extentX: 120,
          extentY: 60,
          rotationRad: Math.PI / 6,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 3,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(shearWrite.ok, false, 'sheared anchor write rejected');
  assert.equal(shearWrite.error, '23514');

  // 6) Rotated + uniform anchor accepted
  const uniformRotWrite = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Rotated Uniform Map',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: resA.value.id,
          centerX: 400,
          centerY: 400,
          extentX: 80,
          extentY: 80,
          rotationRad: Math.PI / 4,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 4,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(uniformRotWrite.ok, true, 'rotated uniform anchor accepted');

  // 7) Dangling parentAnchor.parentMapId on create rejected (`22023`)
  const danglingAnchorCreate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Dangling Anchor Create',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: 'non-existent-map-id',
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 5,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(danglingAnchorCreate.ok, false, 'dangling parentAnchor.parentMapId on create rejected');
  assert.equal(danglingAnchorCreate.error, '22023');

  // 8) Dangling parentAnchor.parentMapId on update rejected (`22023`)
  const danglingAnchorUpdate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resB.value.id,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Map B',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: 'non-existent-map-id',
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: resB.value.revision,
    sortOrder: 1,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(danglingAnchorUpdate.ok, false, 'dangling parentAnchor.parentMapId on update rejected');
  assert.equal(danglingAnchorUpdate.error, '22023');

  // 9) Cross-owner / cross-world parentAnchor.parentMapId on create & update rejected (`22023`)
  const foreignOwner = `foreign-sws-${randomUUID().slice(0, 8)}`;
  const foreignWorldId = randomUUID();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at, public_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    foreignWorldId,
    foreignOwner,
    'Foreign SWS World',
    now,
    `WD-${randomUUID().slice(0, 5).toUpperCase()}`,
  );
  const foreignRoot = store.upsertMap([foreignOwner], {
    worldProfileId: foreignWorldId,
    mapId: null,
    parentMapId: null,
    kind: 'world',
    title: 'Foreign Root',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas', mapStatus: 'ready' },
    expectedRevision: null,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(foreignRoot.ok, true, 'create foreign root');

  const crossWorldAnchorCreate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Cross-World Anchor Create',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: foreignRoot.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 6,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(crossWorldAnchorCreate.ok, false, 'cross-world parentAnchor.parentMapId on create rejected');
  assert.equal(crossWorldAnchorCreate.error, '22023');

  const crossWorldAnchorUpdate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resB.value.id,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Map B',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: foreignRoot.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: resB.value.revision,
    sortOrder: 1,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(crossWorldAnchorUpdate.ok, false, 'cross-world parentAnchor.parentMapId on update rejected');
  assert.equal(crossWorldAnchorUpdate.error, '22023');

  // 10) Pure anchor-link cycle (parentAnchor differs from parent_map_id) rejected (`23514`)
  const siblingD = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Sibling D',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas', mapStatus: 'ready' },
    expectedRevision: null,
    sortOrder: 7,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(siblingD.ok, true, 'create Sibling D');
  const siblingE = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Sibling E',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: siblingD.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 8,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(siblingE.ok, true, 'create Sibling E anchored to Sibling D');
  const anchorOnlyCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: siblingD.value.id,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Sibling D',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: siblingE.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 50,
          extentY: 50,
          rotationRad: 0,
          metersPerUnit: 100,
        },
      },
    },
    expectedRevision: siblingD.value.revision,
    sortOrder: 7,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(anchorOnlyCycle.ok, false, 'pure parentAnchor cycle (D -> E -> D) rejected');
  assert.equal(anchorOnlyCycle.error, '23514');

  // 11) Legacy anchors (missing centerX/centerY/parentMapId or rotationRad: null) stay editable,
  //     while non-positive/non-finite extents or non-finite rotationRad are still rejected (`23514`).
  const legacyAnchorNullRot = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Legacy Anchor Null Rotation',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          extentX: 50,
          extentY: 50,
          rotationRad: null,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 9,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(
    legacyAnchorNullRot.ok,
    true,
    'legacy anchor with missing centerX/centerY/parentMapId and rotationRad: null accepted without blocking saves',
  );

  const invalidExtentAnchor = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Invalid Extent Anchor',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      mapFrame: {
        status: 'ready',
        parentAnchor: {
          parentMapId: resA.value.id,
          centerX: 500,
          centerY: 500,
          extentX: 0,
          extentY: 50,
          rotationRad: 0,
        },
      },
    },
    expectedRevision: null,
    sortOrder: 10,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(invalidExtentAnchor.ok, false, 'non-positive extentX rejected');
  assert.equal(invalidExtentAnchor.error, '23514');

  // 12) UPDATE-path legacy top-level parentAnchor cycle detected (`23514`)
  const legacyNodeX = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Legacy Node X',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: null,
    sortOrder: 11,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(legacyNodeX.ok, true, 'create Legacy Node X');

  const legacyNodeY = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Legacy Node Y',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      parentAnchor: {
        parentMapId: legacyNodeX.value.id,
        centerX: 500,
        centerY: 500,
        extentX: 50,
        extentY: 50,
        rotationRad: 0,
      },
    },
    expectedRevision: null,
    sortOrder: 12,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(legacyNodeY.ok, true, 'create Legacy Node Y with top-level legacy parentAnchor -> X');

  const legacyAnchorCycleUpdate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: legacyNodeX.value.id,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Legacy Node X',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      parentAnchor: {
        parentMapId: legacyNodeY.value.id,
        centerX: 500,
        centerY: 500,
        extentX: 50,
        extentY: 50,
        rotationRad: 0,
      },
    },
    expectedRevision: legacyNodeX.value.revision,
    sortOrder: 11,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(
    legacyAnchorCycleUpdate.ok,
    false,
    'UPDATE-path legacy top-level parentAnchor cycle (X -> Y -> X) rejected',
  );
  assert.equal(legacyAnchorCycleUpdate.error, '23514');

  // 13) UPDATE-path canonical mapFrame.parentAnchor: null takes precedence over legacy top-level parentAnchor
  const legacyNodeYNullOverride = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: legacyNodeY.value.id,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Legacy Node Y (Unlocated Override)',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: {
      engine: 'unified_canvas',
      parentAnchor: {
        parentMapId: legacyNodeX.value.id,
        centerX: 500,
        centerY: 500,
        extentX: 50,
        extentY: 50,
        rotationRad: 0,
      },
      mapFrame: {
        status: 'unlocated',
        parentAnchor: null,
      },
    },
    expectedRevision: legacyNodeY.value.revision,
    sortOrder: 12,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(
    legacyNodeYNullOverride.ok,
    true,
    'update Legacy Node Y with canonical mapFrame.parentAnchor: null over legacy top-level link',
  );

  // Now updating X -> Y via UPDATE must NOT falsely detect a cycle through Y's overridden legacy link
  const legacyNullPrecedenceUpdate = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: legacyNodeX.value.id,
    parentMapId: legacyNodeY.value.id,
    kind: 'region',
    title: 'Legacy Node X under Y',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: legacyNodeX.value.revision,
    sortOrder: 11,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(
    legacyNullPrecedenceUpdate.ok,
    true,
    'UPDATE-path cycle check honors canonical mapFrame.parentAnchor: null over stale legacy parentAnchor',
  );

  // 14) Malformed anchor metadata on an ancestor row must NOT drop valid parent_map_id cycle detection
  const malformedChild = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: null,
    parentMapId: resA.value.id,
    kind: 'region',
    title: 'Malformed Anchor Ancestor',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: null,
    sortOrder: 13,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(malformedChild.ok, true, 'create Malformed Anchor Ancestor');
  // Simulate pre-existing legacy row with numeric (malformed) anchor parentMapId in SQLite
  db.prepare(`UPDATE world_atlas_maps SET generator_meta = ? WHERE id = ?`).run(
    JSON.stringify({ engine: 'unified_canvas', parentAnchor: { parentMapId: 12345 } }),
    malformedChild.value.id,
  );
  const malformedAncestorCycle = store.upsertMap([owner], {
    worldProfileId: worldId,
    mapId: resA.value.id,
    parentMapId: malformedChild.value.id,
    kind: 'world',
    title: 'Map A',
    layers: emptyLayers,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    generatorMeta: { engine: 'unified_canvas' },
    expectedRevision: resA.value.revision,
    sortOrder: 0,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
  });
  assert.equal(
    malformedAncestorCycle.ok,
    false,
    'malformed anchor metadata must not suppress valid parent_map_id cycle check',
  );
  assert.equal(malformedAncestorCycle.error, '23514');

  db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('✓ sws-write-guards.self-test: 16/16 (cycles + anchor-only + legacy UPDATE cycle + canonical-null UPDATE + malformed-anchor resilience + shear + legacy null-rot + dangling/cross-world)');
