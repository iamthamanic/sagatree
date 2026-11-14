#!/usr/bin/env node
/**
 * ATL2-F04 — Dungeon theme look / instancing budget / lighting (Custom WebGL).
 * Location: scripts/atl2-f04-dungeon-look.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-f04.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const lookSrc = readFileSync(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const hostSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.ok(acceptance.includes('atl2-f04'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(acceptance.includes('custom-webgl') || acceptance.includes('Custom-WebGL'));
assert.ok(acceptance.includes('NO-GO') || acceptance.includes('Three.js'));
assert.ok(gate.includes('atl2-f04-dungeon-look.self-test.mjs'));
assert.ok(indexSrc.includes('buildAtlasDungeonLookPlan'));
assert.ok(lookSrc.includes('ATLAS_DUNGEON_LOOK_FORMAT'));
assert.ok(!lookSrc.includes(' as any'));
assert.ok(!lookSrc.includes('@ts-ignore'));
assert.ok(!lookSrc.includes('@ts-expect-error'));
assert.ok(!lookSrc.includes('from \'three\'') && !lookSrc.includes('from "three"'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.ok(runtimeSrc.includes('ATL2-F04'));
assert.ok(runtimeSrc.includes('dungeonLook'));
assert.ok(runtimeSrc.includes('data-atlas-dungeon-theme'));
assert.ok(runtimeSrc.includes('envLight'));
assert.ok(hostSrc.includes('buildAtlasDungeonLookPlan'));
assert.ok(hostSrc.includes('dungeonThemeKey'));
assert.ok(hostSrc.includes('plan.counts.instances <= 0'));
assert.ok(hostSrc.includes('floorIds'));
assert.ok(hostSrc.includes('wallIds'));
assert.ok(editorSrc.includes('dungeonLookDoc'));
assert.ok(editorSrc.includes('dungeonThemeKey'));
assert.ok(editorSrc.includes('dungeonPreview.generate.params.themeKey'));
assert.ok(runtimeSrc.includes('dungeonAllow'));
assert.ok(runtimeSrc.includes('particlesEnabled'));
assert.ok(runtimeSrc.includes('bloomEnabled'));

const look = jiti(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'));
const gen = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));
const grid = jiti(join(root, 'src/domains/world/atlas/dungeon-grid.ts'));
const wf = jiti(join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'));
const { emptyUnifiedCanvasDoc } = jiti(
  join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'),
);

const empty = look.buildAtlasDungeonLookPlan(emptyUnifiedCanvasDoc(false), {
  themeKey: 'ancient',
  graphicsPresetId: 'high',
});
assert.equal(empty.format, look.ATLAS_DUNGEON_LOOK_FORMAT);
assert.equal(empty.counts.instances, 0);
assert.equal(empty.batches.length, 0);

const result = gen.generateDungeon({
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 0,
  originY: 0,
  unitScale: 1,
});
assert.equal(result.valid, true, result.error);
const raster = grid.rasterizeDungeonGenerateResult(result);
assert.equal(raster.valid && raster.passable, true, raster.error);
const payload = wf.dungeonCommitPayloadFromResults(result, raster);
assert.ok(payload);
const doc = wf.commitDungeonFeaturesToDoc(emptyUnifiedCanvasDoc(false), payload, true);

const ancient = look.buildAtlasDungeonLookPlan(doc, {
  themeKey: 'ancient',
  graphicsPresetId: 'balanced',
});
const molten = look.buildAtlasDungeonLookPlan(doc, {
  themeKey: 'molten',
  graphicsPresetId: 'balanced',
});
const lite = look.buildAtlasDungeonLookPlan(doc, {
  themeKey: 'frost',
  graphicsPresetId: 'lite',
});

assert.ok(ancient.counts.walls > 0);
assert.ok(ancient.counts.floors > 0);
assert.ok(ancient.counts.doors > 0);
assert.equal(ancient.geometryFingerprint, molten.geometryFingerprint, 'theme must not change geometry IDs');
assert.equal(ancient.geometryFingerprint, lite.geometryFingerprint);
assert.notEqual(ancient.lookFingerprint, molten.lookFingerprint, 'theme must change look fingerprint');
assert.notEqual(ancient.palette.wall, molten.palette.wall);
assert.equal(lite.budget.bloomEnabled, false);
assert.equal(lite.budget.particlesEnabled, false);
assert.ok(lite.budget.maxInstances < ancient.budget.maxInstances);
assert.ok(lite.counts.instances <= lite.budget.maxInstances);

for (const key of look.ATLAS_DUNGEON_THEME_KEYS) {
  const plan = look.buildAtlasDungeonLookPlan(doc, { themeKey: key, graphicsPresetId: 'high' });
  assert.equal(plan.themeKey, key);
  assert.equal(plan.geometryFingerprint, ancient.geometryFingerprint);
  assert.ok(plan.palette.floor);
  assert.ok(plan.light.torchIntensity > 0);
}

assert.equal(look.resolveAtlasDungeonThemeKey('nope'), 'ancient');
assert.equal(look.isAtlasDungeonFeatureId('droom-1'), true);
assert.equal(look.isAtlasDungeonFeatureId('hand-1'), false);

console.log(
  JSON.stringify({
    ok: true,
    walls: ancient.counts.walls,
    doors: ancient.counts.doors,
    instances: ancient.counts.instances,
    liteInstances: lite.counts.instances,
    geomFp: ancient.geometryFingerprint,
    target: target.ATLAS_PRODUCT_3D_TARGET,
  }),
);
