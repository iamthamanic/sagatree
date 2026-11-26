#!/usr/bin/env node
/**
 * atlas-world-terrain-chunks.self-test — Shared Chunked World Terrain (Phase 1),
 * Continuous-LOD detailWeight Crossfade & Keep-Coarse (Phase 2), and
 * Camera-Coupled Zoom Layer Indicator (Phase 3) verification.
 *
 * Location: scripts/atlas-world-terrain-chunks.self-test.mjs
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import * as THREE from 'three';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const atlas = jiti(join(root, 'src/domains/world/atlas/index.ts'));
const mm = jiti(join(root, 'src/infrastructure/world/atlas-three/atlas-three-multimap.ts'));

const bundle = atlas.buildCalibratedDefaultWorld();
let passed = 0;

// 1) Phase 1.1 + 1.2: World root owns the ONE shared heightfield; zero separate island landmasses on child maps
{
  const hf = bundle.rootDoc.heightfield;
  assert.ok(hf, 'World root owns canonical AtlasHeightfield');
  assert.equal(hf.originX, 0);
  assert.equal(hf.originZ, 0);
  assert.equal(hf.waterLevel, 0);
  const aboveWater = hf.heights.filter((h) => h > hf.waterLevel).length;
  const belowWater = hf.heights.filter((h) => h < hf.waterLevel).length;
  assert.ok(aboveWater > 500, `continents rise above waterLevel (got ${aboveWater} land cells)`);
  assert.ok(belowWater > 1000, `ocean floor sits below waterLevel (got ${belowWater} water cells)`);

  // Verify zero continent/country/place maps have legacy separate landmass island polygons
  for (const m of bundle.maps) {
    const doc = m.buildCanvas();
    for (const rm of doc.rooms) {
      assert.ok(!rm.id.startsWith('g.land.'), `${m.seedKey} must not carry separate continent island ${rm.id}`);
      assert.ok(!rm.id.endsWith('.realm'), `${m.seedKey} must not carry separate country island ${rm.id}`);
      assert.ok(!rm.id.endsWith('.ground'), `${m.seedKey} must not carry separate place island ${rm.id}`);
    }
  }
  // Countries carry political border overlay strokes on the shared ground
  const countries = bundle.maps.filter((m) => m.placeSeedKey.startsWith('country.'));
  for (const c of countries) {
    const cdoc = c.buildCanvas();
    assert.ok(
      cdoc.strokes.some((s) => s.id.endsWith('.border')),
      `${c.title} carries political border overlay stroke`,
    );
  }
  // Chunk-subset triangulation helper works cleanly
  const chunkTris = atlas.buildAtlasTerrainChunkMeshTriangles(
    hf,
    { minCol: 10, maxCol: 26, minRow: 10, maxRow: 26 },
    'mid',
  );
  assert.ok(chunkTris.length > 0, 'chunk-subset LOD triangulation emits triangles');
  passed += 1;
}

// 2) Phase 1.1 + Visumaxx Contract: Quadtree chunk planner refines smoothly with keep-coarse base
{
  const source = atlas.createAtlasWorldHeightfieldSource({
    rootHeightfield: bundle.rootDoc.heightfield,
    revisionKey: 'test-v1',
  });
  const dornWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', { x: 500, y: 500 });
  assert.equal(dornWorld.ok, true);

  // Dornhain sits on dry land above waterLevel in the ONE shared heightfield
  const dornElev = atlas.sampleWorldHeight(source, dornWorld.value.x, dornWorld.value.y);
  assert.ok(dornElev > source.waterLevel + 1, `Dornhain elevation (${dornElev}) > waterLevel`);
  // Open ocean at (500, 500) sits below waterLevel
  const oceanElev = atlas.sampleWorldHeight(source, 500, 500);
  assert.ok(oceanElev < source.waterLevel, `Open ocean elevation (${oceanElev}) < waterLevel`);

  const planFar = atlas.planWorldTerrainChunks({
    source,
    camera: atlas.createAtlasWorldCameraState({ focusWorld: { x: 500, y: 500, z: 0 }, span: 530 }),
    viewportPx: { width: 1280, height: 800 },
  });
  const planNear = atlas.planWorldTerrainChunks({
    source,
    camera: atlas.createAtlasWorldCameraState({
      focusWorld: { x: dornWorld.value.x, y: dornWorld.value.y, z: 0 },
      span: 4,
    }),
    viewportPx: { width: 1280, height: 800 },
  });
  assert.ok(planNear.maxActiveLod > planFar.maxActiveLod, 'near zoom refines to higher terrain LOD');
  assert.ok(planNear.chunks.some((c) => c.chunkId === 'L0:0:0' && c.isCoarseBase), 'keep-coarse L0:0:0 always kept');
  for (const ch of planNear.chunks) {
    assert.match(ch.chunkId, /^L\d+:\d+:\d+$/, 'Visumaxx chunkId format L<lod>:<gx>:<gz>');
    assert.equal(ch.logicalCells, 64, 'Visumaxx 64x64 logical cell contract');
    assert.ok(ch.boundsWorld.maxX > ch.boundsWorld.minX && ch.boundsWorld.maxZ > ch.boundsWorld.minZ);
  }
  passed += 1;
}

// 3) Phase 1.3 + Phase 2.1/2.2: Shared terrain in MultiMap, ZERO per-map terrain, per-group cloned materials & damped crossfade
{
  const mapInputs = Object.values(bundle.worldNodes).map((n) => ({ ...n, status: 'ready' }));
  const sources = new Map();
  sources.set(bundle.rootSeedKey, {
    mapId: bundle.rootSeedKey,
    doc: bundle.rootDoc,
    mapScale: 'world',
    look: 'outdoor',
    revisionKey: 'r1',
  });
  for (const m of bundle.maps) {
    sources.set(m.seedKey, {
      mapId: m.seedKey,
      doc: m.buildCanvas(),
      mapScale: m.kind === 'scene' ? 'interior' : m.kind === 'settlement' ? 'settlement' : 'world',
      look: m.kind === 'scene' ? 'indoor' : 'outdoor',
      revisionKey: 'r1',
    });
  }

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x88aa77 });
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1.0 } },
  });
  const graph = new mm.AtlasThreeMultiMapGraph(() => baseMat, waterMat);

  const dornWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', { x: 500, y: 500 }).value;

  // Step continuously from span 530 → 25 → 2.5 with frame dt = 1/60s to verify smooth opacity ramp!
  const spans = [530, 320, 220, 160, 120, 80, 40, 25, 14, 9, 5, 2.5];
  let prevPlan = null;
  let sawIntermediateOpacity = false;

  for (const span of spans) {
    const cam = atlas.createAtlasWorldCameraState({
      focusWorld: { x: dornWorld.x, y: dornWorld.y, z: 0 },
      span,
      yawRad: 0.42,
    });
    const plan = atlas.buildAtlasWorldScenePlan({
      maps: mapInputs,
      camera: cam,
      viewportPx: { width: 1280, height: 800 },
      previousPlan: prevPlan,
    });
    // Phase 2.2 keep-coarse: focus-path carrier Westmark MUST stay present at span 120 & 25!
    if (span <= 260) {
      assert.ok(
        plan.entries.some((e) => e.mapId === 'dornhain.map.continent.westmark'),
        `keep-coarse: Westmark carrier kept at span=${span}`,
      );
      assert.ok(
        plan.entries.some((e) => e.mapId === 'dornhain.map.country.westmark'),
        `keep-coarse: Nordreich carrier kept at span=${span}`,
      );
    }

    graph.sync({
      scenePlan: plan,
      sources,
      presetId: 'balanced',
      hideRoofs: false,
      viewSpan: span,
      camera: cam,
      viewportPx: { width: 1280, height: 800 },
      dtSec: 1 / 60,
    });

    const stats = graph.getStats();
    assert.equal(stats.clearRootCount, 0, 'clearRootCount === 0');
    assert.equal(stats.ownPerMapTerrainCount, 0, `zero per-map terrain meshes at span=${span}`);
    assert.ok(stats.terrain.enabled && stats.terrain.chunkCount >= 1, 'shared chunked world terrain active');

    for (const [id, info] of Object.entries(stats.groupOpacities)) {
      if (id !== bundle.rootSeedKey && info.opacity > 0.01 && info.opacity < 0.99) {
        sawIntermediateOpacity = true;
      }
    }
    prevPlan = plan;
  }

  assert.equal(sawIntermediateOpacity, true, 'Phase 2.1: smooth intermediate opacity (0 < op < 1) observed during zoom');

  // Verify per-group cloned materials (RC-3): distinct material instances per map group!
  const gRoot = graph.getGroup(bundle.rootSeedKey);
  const gDorn = graph.getGroup('dornhain.map.place.dornhain');
  assert.ok(gRoot && gDorn, 'root & Dornhain groups mounted');
  assert.ok(gRoot.materials.length > 0 && gDorn.materials.length > 0);
  assert.notEqual(
    gRoot.materials[0].material,
    gDorn.materials[0].material,
    'RC-3: map groups hold independent cloned materials (no shared opacity mutation)',
  );
  assert.notEqual(gDorn.materials[0].material, baseMat, 'group material is cloned from base');

  // Verify clean disposal
  graph.dispose();
  assert.equal(graph.getStats().liveGeometryCount, 0, 'dispose releases 100% of chunk + overlay geometries');
  baseMat.dispose();
  waterMat.dispose();
  passed += 1;
}

// 4) Phase 3 (RC-4): activeEditorMapId & zoomLayer follow camera focus in AND back out
{
  const mapInputs = Object.values(bundle.worldNodes).map((n) => ({ ...n, status: 'ready' }));
  const dornWorld = atlas.localToWorld(bundle.worldNodes, 'dornhain.map.place.dornhain', { x: 500, y: 500 }).value;
  const navNodes = [
    { id: 'p.westmark', label: 'Kontinent Westmark', parentId: null, primaryMapId: 'dornhain.map.continent.westmark' },
    { id: 'p.nordreich', label: 'Nordreich', parentId: 'p.westmark', primaryMapId: 'dornhain.map.country.westmark' },
    { id: 'p.dornhain', label: 'Dornhain', parentId: 'p.nordreich', primaryMapId: 'dornhain.map.place.dornhain' },
  ];

  const evalZoom = (span, prev = null) => {
    const cam = atlas.createAtlasWorldCameraState({
      focusWorld: { x: dornWorld.x, y: dornWorld.y, z: 0 },
      span,
    });
    const plan = atlas.buildAtlasWorldScenePlan({
      maps: mapInputs,
      camera: cam,
      viewportPx: { width: 1280, height: 800 },
      previousPlan: prev,
    });
    const layer = atlas.deriveZoomLayerHierarchyState({
      activeEditorMapId: plan.activeEditorMapId,
      worldRootMapId: bundle.rootSeedKey,
      worldLabelDe: 'Welt Donalu',
      nodes: navNodes,
    });
    return { plan, layer };
  };

  const zNord = evalZoom(40);
  assert.equal(zNord.layer.activeLabelDe, 'Nordreich', 'span=40 over Dornhain resolves to Nordreich');
  const zDorn = evalZoom(2.5, zNord.plan);
  assert.equal(zDorn.layer.activeLabelDe, 'Dornhain', 'span=2.5 over Dornhain resolves to Dornhain');
  assert.deepEqual(zDorn.layer.activeBreadcrumbPlaceIds, ['p.westmark', 'p.nordreich', 'p.dornhain']);
  const zBackNord = evalZoom(40, zDorn.plan);
  assert.equal(zBackNord.layer.activeLabelDe, 'Nordreich', 'zooming back out to span=40 restores Nordreich');
  passed += 1;
}

console.log(`✓ atlas-world-terrain-chunks.self-test: ${passed}/4 (shared chunked terrain, zero islands, smooth crossfade, keep-coarse, zoom-layer focus)`);
