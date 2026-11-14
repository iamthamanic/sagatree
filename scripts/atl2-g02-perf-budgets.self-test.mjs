#!/usr/bin/env node
/**
 * ATL2-G02 — atlas perf fixtures / budgets / GPU teardown (#1230).
 * Location: scripts/atl2-g02-perf-budgets.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g02.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g02.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const perfSrc = readFileSync(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-g02'));
assert.ok(acceptance.includes('#1230'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('custom-webgl') || acceptance.includes('Custom-WebGL'));
assert.ok(composition.includes('CLEAR'));
assert.ok(gate.includes('atl2-g02-perf-budgets.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_PERF_BUDGET_THRESHOLDS'));
assert.ok(perfSrc.includes('ATLAS_PERF_SCENE_FIXTURES'));
assert.ok(!perfSrc.includes(' as any'));
assert.ok(!perfSrc.includes('@ts-ignore'));
assert.ok(!perfSrc.includes('@ts-expect-error'));
assert.ok(!perfSrc.includes("from 'three'") && !perfSrc.includes('from "three"'));
assert.ok(runtimeSrc.includes('ATL2-G02'));
assert.ok(runtimeSrc.includes('webglcontextlost'));
assert.ok(runtimeSrc.includes('webglcontextrestored'));
assert.ok(runtimeSrc.includes('data-atlas-webgl-lost'));
assert.ok(runtimeSrc.includes('dispose(){const gl=this.gl'));
assert.ok(runtimeSrc.includes('deleteProgram'));
assert.ok(runtimeSrc.includes('deleteShader'));
assert.ok(runtimeSrc.includes('this.shaders='));
assert.ok(perfSrc.includes('resolveAtlasPerfBudgetMaxInstances'));

const perf = jiti(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'));
const gen = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));
const grid = jiti(join(root, 'src/domains/world/atlas/dungeon-grid.ts'));
const wf = jiti(join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'));
const look = jiti(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'));
const { emptyUnifiedCanvasDoc } = jiti(
  join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'),
);
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(perf.ATLAS_PERF_SCENE_FIXTURES.length, 3);
assert.equal(perf.ATLAS_PERF_BUDGET_THRESHOLDS.format, 'atl2-perf-budget-v1');

const measurements = [];
for (const fixture of perf.ATLAS_PERF_SCENE_FIXTURES) {
  const result = gen.generateDungeon({
    seed: fixture.dungeonSeed,
    roomCount: fixture.dungeonRoomCount,
    loopChance: 0.2,
    themeKey: fixture.themeKey,
    originX: 0,
    originY: 0,
    unitScale: 1,
  });
  assert.equal(result.valid, true, `${fixture.id}: ${result.error}`);
  const raster = grid.rasterizeDungeonGenerateResult(result);
  assert.equal(raster.valid && raster.passable, true, `${fixture.id} raster`);
  const payload = wf.dungeonCommitPayloadFromResults(result, raster);
  const doc = wf.commitDungeonFeaturesToDoc(emptyUnifiedCanvasDoc(false), payload, true);
  const m = perf.measureAtlasPerfPlan(doc, fixture);
  const expectedMax = perf.resolveAtlasPerfBudgetMaxInstances(fixture.graphicsPresetId);
  assert.equal(m.budgetMaxInstances, expectedMax, `${fixture.id} budgetMaxInstances`);
  assert.equal(m.withinBudget, true, `${fixture.id} budget: ${JSON.stringify(m)}`);
  assert.ok(m.lookInstances <= m.budgetMaxInstances, fixture.id);
  assert.ok(m.coldPlanMs <= perf.ATLAS_PERF_BUDGET_THRESHOLDS.coldPlanMsMax, fixture.id);
  const plan = look.buildAtlasDungeonLookPlan(doc, {
    themeKey: fixture.themeKey,
    graphicsPresetId: fixture.graphicsPresetId,
  });
  const summary = perf.summarizeAtlasLookAgainstBudget(plan);
  assert.equal(summary.ok, true, summary.reason);
  measurements.push(m);
}

const large = measurements.find((m) => m.sceneId === 'large');
assert.ok(large);
assert.ok(large.lookBatches <= perf.ATLAS_PERF_BUDGET_THRESHOLDS.maxDrawBatchesLarge);

/* GPU session: map switches + context loss must not leave live handles. */
let session = perf.createAtlasGpuResourceSession();
for (let i = 0; i < perf.ATLAS_PERF_BUDGET_THRESHOLDS.mapSwitchCycles; i += 1) {
  session = perf.atlasGpuMapSwitch(session, 12 + i);
}
assert.ok(session.liveHandles > 0);
session = perf.atlasGpuReleaseAll(session);
assert.equal(session.liveHandles, 0);
assert.equal(perf.atlasGpuSessionWithinTeardownBudget(session), true);

session = perf.atlasGpuAcquire(session, 32);
session = perf.atlasGpuContextLost(session);
assert.equal(session.liveHandles, 0);
assert.equal(session.lostCount, 1);
session = perf.atlasGpuContextRestored(session, 16);
assert.equal(session.liveHandles, 16);
session = perf.atlasGpuReleaseAll(session);
assert.equal(session.liveHandles, 0);

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-g02',
    issue: 1230,
    measurements: measurements.map((m) => ({
      id: m.sceneId,
      ms: +m.coldPlanMs.toFixed(2),
      instances: m.lookInstances,
      batches: m.lookBatches,
      truncated: m.lookTruncated,
    })),
    target: target.ATLAS_PRODUCT_3D_TARGET,
  }),
);
