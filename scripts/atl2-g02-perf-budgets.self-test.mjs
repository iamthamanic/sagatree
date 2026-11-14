#!/usr/bin/env node
/**
 * ATL2-G02 — atlas perf budgets / map-switch / context-loss resource accounting.
 * Location: scripts/atl2-g02-perf-budgets.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const perf = jiti(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'));

assert.equal(perf.ATLAS_PERF_SCENE_FIXTURES.length, 3);
assert.ok(String(perf.ATLAS_PERF_REFERENCE_HARDWARE_DE).includes('Referenzklasse'));

const large = perf.atlasPerfSceneFixture('large');
assert.equal(large.scenario, 'world');
assert.ok(large.instanceCount >= 2048);
assert.ok(large.featureCount >= 1400);

const budgetHigh = perf.atlasPerfBudgetFor('large', 'high');
const budgetLite = perf.atlasPerfBudgetFor('large', 'lite');
assert.ok(budgetLite.drawCallsMax <= budgetHigh.drawCallsMax);
assert.ok(budgetHigh.frameP95MsMax > 0);
assert.ok(budgetHigh.coldLoadMsMax > 0);
assert.equal(budgetHigh.retainedHandlesMax, 0);

const drawHigh = perf.estimateAtlasPerfDrawCalls(large, 'high');
const drawLite = perf.estimateAtlasPerfDrawCalls(large, 'lite');
assert.ok(drawLite <= drawHigh);

const okObs = {
  frameP95Ms: budgetHigh.frameP95MsMax - 1,
  coldLoadMs: budgetHigh.coldLoadMsMax - 1,
  drawCalls: Math.min(drawHigh, budgetHigh.drawCallsMax),
  heapDeltaBytes: budgetHigh.heapDeltaBytesMax - 1,
  retainedHandles: 0,
};
const okVerdict = perf.evaluateAtlasPerfBudget(budgetHigh, okObs);
assert.equal(okVerdict.ok, true);
assert.equal(okVerdict.violations.length, 0);

const badObs = { ...okObs, frameP95Ms: budgetHigh.frameP95MsMax + 50 };
const badVerdict = perf.evaluateAtlasPerfBudget(budgetHigh, badObs);
assert.equal(badVerdict.ok, false);
assert.ok(badVerdict.violations.some((v) => v.includes('frameP95Ms')));
assert.equal(perf.suggestAtlasPerfDegrade('high', badVerdict), 'balanced');
assert.equal(perf.suggestAtlasPerfDegrade('balanced', badVerdict), 'lite');
assert.equal(perf.suggestAtlasPerfDegrade('lite', badVerdict), 'lite');
assert.equal(perf.suggestAtlasPerfDegrade('high', okVerdict), 'high');

const stress = perf.atlasPerfMapSwitchStress(64, 25);
assert.equal(stress.unbounded, false);
assert.equal(stress.session.liveHandles, 0);
assert.equal(stress.session.mapSwitchCount, 25);
assert.equal(stress.peakLive, 64);
assert.equal(stress.session.allocatedHandles, 64 * 25);

let session = perf.createAtlasPerfResourceSession();
session = perf.atlasPerfAllocateHandles(session, 40);
assert.equal(session.liveHandles, 40);
session = perf.atlasPerfSimulateContextLoss(session);
assert.equal(session.liveHandles, 0);
assert.equal(session.contextLossCount, 1);
session = perf.atlasPerfAllocateHandles(session, 40);
session = perf.atlasPerfDisposeAll(session);
assert.equal(session.liveHandles, 0);

const releaseBudget = perf.atlasPerfBudgetFor('large', 'lite');
const releaseDraws = perf.estimateAtlasPerfDrawCalls(large, 'lite');
const releaseVerdict = perf.evaluateAtlasPerfBudget(releaseBudget, {
  frameP95Ms: releaseBudget.frameP95MsMax,
  coldLoadMs: releaseBudget.coldLoadMsMax,
  drawCalls: releaseDraws,
  heapDeltaBytes: 0,
  retainedHandles: 0,
});
assert.equal(
  releaseVerdict.ok,
  true,
  `large/lite drawCalls ${releaseDraws} vs max ${releaseBudget.drawCallsMax}: ${releaseVerdict.violations.join('; ')}`,
);

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g02.md'), 'utf8');
assert.ok(acceptance.includes('ATL2-G02'));
assert.ok(acceptance.includes('Frame-P95') || acceptance.includes('frameP95'));
const design = readFileSync(join(root, '.qa/design/atl2-g02-perf-budgets.md'), 'utf8');
assert.ok(design.includes('atlas-perf-budgets'));
const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
assert.ok(barrel.includes('atlas-perf-budgets'));
assert.ok(barrel.includes('evaluateAtlasPerfBudget'));
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
assert.ok(gate.includes('atl2-g02-perf-budgets.self-test.mjs'));

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      checks: [
        'fixtures small/medium/large',
        'budgets scale by scene+preset',
        'evaluate + degrade ladder',
        'map-switch reclaim (25 cycles)',
        'context-loss clears live handles',
        'large/lite release cell under draw budget',
      ],
      largeLiteDrawCalls: releaseDraws,
      largeLiteDrawMax: releaseBudget.drawCallsMax,
    },
    null,
    2,
  ),
);
console.log('atl2-g02-perf-budgets.self-test: OK');
