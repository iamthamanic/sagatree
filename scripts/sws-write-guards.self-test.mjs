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

  db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('✓ sws-write-guards.self-test: 10/10 (cycles + shear + uniform rot + dangling/cross-world anchor parent reject)');
