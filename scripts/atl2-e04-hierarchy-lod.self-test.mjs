#!/usr/bin/env node
/**
 * ATL2-E04 — hierarchy LOD / lazy child loads / transitions (#1222).
 * Location: scripts/atl2-e04-hierarchy-lod.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const lod = jiti(join(root, 'src/domains/world/atlas/atlas-hierarchy-lod.ts'));
const mf = jiti(join(root, 'src/domains/world/atlas/map-frame.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e04.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e04-hierarchy-lod.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorHook = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
const workbench = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const unified = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-e04'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(design.includes('beginAtlasMapLoad'));
assert.ok(gate.includes('atl2-e04-hierarchy-lod.self-test.mjs'), 'wired in test-gate');
assert.ok(barrel.includes('beginAtlasMapLoad'));
assert.ok(barrel.includes('atlasHierarchyLodLayerFlags'));
assert.ok(editorHook.includes('beginAtlasMapLoad'));
assert.ok(editorHook.includes('shouldApplyAtlasMapLoad'));
assert.ok(editorHook.includes('lodSession'));
assert.ok(editorHook.includes('prefetchChildMap'));
assert.ok(editorHook.includes('finishLodTransition'));
assert.ok(editorHook.includes('atlasLodFallbackActiveMapId'));
assert.ok(editorHook.includes('completeAtlasMapLoad'));
assert.ok(
  !editorHook.includes('finishAtlasMapTransition(transitioned'),
  'must not finish transition before fade',
);
assert.ok(workbench.includes('hierarchyLodBand'));
assert.ok(workbench.includes('data-world-atlas-lod-band'));
assert.ok(workbench.includes('prefetchChildMap'));
assert.ok(workbench.includes('finishLodTransition'));
assert.ok(unified.includes('hierarchyLodBand'));
assert.ok(unified.includes('atlasHierarchyLodLayerFlags'));
assert.ok(unified.includes('lodAwareDisplayDoc'));
assert.ok(
  unified.includes('lodAwareDisplayDoc'),
  '3D controlledSeed must consume LOD-aware doc',
);

assert.equal(lod.lodBandFromBreadcrumbDepth(1), 'world');
assert.equal(lod.lodBandFromBreadcrumbDepth(6), 'room');
assert.equal(lod.lodBandFromBreadcrumbDepth(99), 'room');

const layersOn = {
  terrain: true,
  region: true,
  city: true,
  interior: true,
  objects: true,
  grid: true,
};
const worldFlags = lod.atlasHierarchyLodLayerFlags('world', layersOn);
assert.equal(worldFlags.terrain, true);
assert.equal(worldFlags.region, true);
assert.equal(worldFlags.city, false);
assert.equal(worldFlags.interior, false);
assert.equal(worldFlags.grid, false);

const roomFlags = lod.atlasHierarchyLodLayerFlags('room', layersOn);
assert.equal(roomFlags.terrain, false);
assert.equal(roomFlags.interior, true);
assert.equal(roomFlags.grid, true);
assert.equal(roomFlags.objects, true);

// Editor can only hide further
const hidden = lod.atlasHierarchyLodLayerFlags('room', { ...layersOn, interior: false });
assert.equal(hidden.interior, false);

assert.equal(lod.atlasParentGeoSuppressed('world'), false);
assert.equal(lod.atlasParentGeoSuppressed('building'), true);
assert.equal(lod.atlasParentGeoSuppressed('room'), true);

let session = lod.createAtlasMapLoadSession('m-parent');
assert.equal(session.phase, 'ready');
assert.equal(session.activeMapId, 'm-parent');

session = lod.beginAtlasMapLoad(session, 'm-child', 'loading');
const gen1 = session.generation;
assert.equal(session.phase, 'loading');
assert.equal(session.targetMapId, 'm-child');

const stale = lod.beginAtlasMapLoad(session, 'm-other', 'loading');
const gen2 = stale.generation;
assert.ok(gen2 > gen1);
assert.equal(lod.shouldApplyAtlasMapLoad(stale, gen1, 'm-child'), false);
assert.equal(lod.shouldApplyAtlasMapLoad(stale, gen2, 'm-other'), true);

session = lod.completeAtlasMapLoad(stale, gen2, 'm-other');
assert.equal(session.phase, 'transitioning');
const fadeMid = lod.atlasLodTransitionOpacity('transitioning', 0.5);
assert.ok(Math.abs(fadeMid.child - 0.5) < 1e-9);
assert.ok(Math.abs(fadeMid.parent - 0.5) < 1e-9);
session = lod.finishAtlasMapTransition(session, gen2);
assert.equal(session.phase, 'ready');
assert.equal(session.activeMapId, 'm-other');
assert.deepEqual(lod.atlasLodTransitionOpacity('ready', 0), { child: 1, parent: 0 });

session = lod.beginAtlasMapLoad(session, 'm-fail', 'loading');
const genFail = session.generation;
session = lod.failAtlasMapLoad(session, genFail, lod.LOD_LOAD_FAILED_DE);
assert.equal(session.phase, 'error');
assert.equal(session.errorDe, lod.LOD_LOAD_FAILED_DE);
assert.equal(lod.atlasLodFallbackActiveMapId(session), 'm-other');

session = lod.beginAtlasMapLoad(session, 'm-cancel', 'loading');
session = lod.cancelAtlasMapLoad(session);
assert.equal(session.phase, 'cancelled');
assert.equal(lod.atlasLodFallbackActiveMapId(session), 'm-other');

const locatedFrame = {
  status: 'ready',
  parentAnchor: {
    parentMapId: 'm-parent',
    centerX: 100,
    centerY: 100,
    extentX: 20,
    extentY: 20,
    rotationRad: 0,
    metersPerUnit: null,
  },
};
assert.equal(mf.canLodEnterChildMap(locatedFrame), true);

let cache = {};
const prefetchMiss = lod.decidePrefetchChildMap({
  childMapId: 'm-child',
  childFrame: locatedFrame,
  cache,
  contentFingerprint: 'fp1',
  cacheEpoch: 0,
});
assert.deepEqual(prefetchMiss, { ok: true, reason: 'prefetch' });

cache = lod.putAtlasMapCacheEntry(cache, {
  mapId: 'm-child',
  contentFingerprint: 'fp1',
  cachedAtEpoch: 0,
});
assert.equal(lod.isAtlasMapCacheFresh(cache, 'm-child', 'fp1', 0), true);
const prefetchHit = lod.decidePrefetchChildMap({
  childMapId: 'm-child',
  childFrame: locatedFrame,
  cache,
  contentFingerprint: 'fp1',
  cacheEpoch: 0,
});
assert.deepEqual(prefetchHit, { ok: true, reason: 'cache-hit' });

const unlocated = lod.decidePrefetchChildMap({
  childMapId: 'm-u',
  childFrame: { status: 'unlocated', parentAnchor: null },
  cache: {},
  contentFingerprint: 'x',
  cacheEpoch: 0,
});
assert.equal(unlocated.ok, false);
assert.equal(unlocated.reasonDe, lod.LOD_PREFETCH_SKIP_UNLOCATED_DE);

cache = lod.invalidateAtlasMapCache(cache, 'm-child');
assert.equal(lod.isAtlasMapCacheFresh(cache, 'm-child', 'fp1', 0), false);

session = lod.bumpAtlasMapCacheEpoch(session);
assert.ok(session.cacheEpoch >= 1);

assert.ok(lod.atlasMapCacheKey('a', 'b').includes('a::b'));

const evidenceDir = join(root, '.qa/runs');
mkdirSync(evidenceDir, { recursive: true });
const stamp = new Date().toISOString();
writeFileSync(
  join(evidenceDir, 'atl2-e04-hierarchy-lod.json'),
  `${JSON.stringify(
    {
      slug: 'atl2-e04',
      issue: 1222,
      verdict: 'CLEAR',
      generatedAt: stamp,
      checks: [
        'semantic-lod-bands',
        'load-generation-cancel',
        'prefetch-unlocated-skip',
        'cache-invalidate',
        'transition-opacity',
      ],
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(evidenceDir, 'atl2-e04-hierarchy-lod.md'),
  `# ATL2-E04 hierarchy LOD — CLEAR\n\nGenerated: ${stamp}\n\nSelf-test PASS.\n`,
);

console.log('atl2-e04-hierarchy-lod self-test: PASS (CLEAR)');
console.log('report: .qa/runs/atl2-e04-hierarchy-lod.md');
