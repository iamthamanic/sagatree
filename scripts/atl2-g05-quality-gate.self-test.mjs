#!/usr/bin/env node
/**
 * ATL2-G05 — cross-cutting quality gate wiring (#1233).
 * Location: scripts/atl2-g05-quality-gate.self-test.mjs
 *
 * Structural + domain fail-closed proofs. Real GPU/frame PASS lives in HOST
 * Browser E2E evidence — missing evidence stays NOT_RUN, never auto-PASS.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g05.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g05.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const g05Src = readFileSync(join(root, 'src/domains/world/atlas/atlas-gate-g05.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const e2ePath = join(root, 'e2e/atl2-g05-quality-gate.spec.ts');

assert.ok(existsSync(e2ePath), 'missing e2e/atl2-g05-quality-gate.spec.ts');
const e2eSrc = readFileSync(e2ePath, 'utf8');

assert.ok(acceptance.includes('atl2-g05'));
assert.ok(acceptance.includes('#1233'));
assert.ok(acceptance.includes('NOT_RUN'));
assert.ok(acceptance.includes('AU-01') || acceptance.includes('AU-CONTENT-WIDTH'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('custom-webgl') || acceptance.includes('Custom-WebGL'));
assert.ok(composition.includes('CLEAR'));
assert.ok(composition.includes('atl2-g05'));
assert.ok(gate.includes('atl2-g05-quality-gate.self-test.mjs'));
assert.ok(indexSrc.includes('rollupAtlasG05Checks'));
assert.ok(g05Src.includes('ATLAS_G05_REQUIRED_CHECK_IDS'));
assert.ok(!g05Src.includes(' as any'));
assert.ok(!g05Src.includes('@ts-ignore'));
assert.ok(!g05Src.includes('@ts-expect-error'));
assert.ok(runtimeSrc.includes('ATL2-G05'));
assert.ok(runtimeSrc.includes('sampleFrameTimes'));
assert.ok(runtimeSrc.includes('forceContextLoss'));
assert.ok(e2eSrc.includes('SAGATREE_BROWSER_E2E_HOST'));
assert.ok(e2eSrc.includes('sampleFrameTimes'));
assert.ok(e2eSrc.includes('playerView'));
assert.ok(e2eSrc.includes('quality-evidence.json'));
assert.ok(!e2eSrc.includes('status: \'PASS\'') || e2eSrc.includes('rollupAtlasG05Checks'));

const g05 = jiti(join(root, 'src/domains/world/atlas/atlas-gate-g05.ts'));
const perf = jiti(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'));

assert.equal(g05.ATLAS_G05_EVIDENCE_FORMAT, 'atl2-g05-evidence-v1');
assert.equal(g05.ATLAS_G05_REQUIRED_CHECK_IDS.length, 13);
assert.equal(g05.atlasG05SceneFixturesCoverHierarchy(), true);
assert.equal(g05.ATLAS_G05_DEVICE_VIEWPORTS.length, 3);

const empty = g05.emptyAtlasG05Checks();
assert.equal(g05.rollupAtlasG05Checks(empty), 'NOT_RUN');

const samples = [8, 10, 12, 14, 16, 18, 20, 22, 24, 40];
assert.equal(g05.atlasG05PercentileMs(samples, 50), 16);
assert.ok(g05.atlasG05PercentileMs(samples, 95) >= 24);
assert.equal(g05.atlasG05FrameBudgetMs('webgl'), perf.ATLAS_PERF_BUDGET_THRESHOLDS.frameP95MsSoft);
assert.equal(g05.atlasG05FrameBudgetMs('software'), g05.ATLAS_G05_FRAME_P95_MS_CI_SOFTWARE);

const goodFrames = ['small', 'medium', 'large'].map((id) =>
  g05.summarizeAtlasG05FrameSample(id, Array.from({ length: 30 }, () => 12), 'software'),
);
assert.ok(goodFrames.every((f) => f.withinBudget));

const built = g05.buildAtlasG05ChecksFromEvidence({
  frames: goodFrames,
  devices: [
    { band: 'desktop', width: 1280, height: 800, atlasReady: true, webglMode: 'ok' },
    { band: 'tablet', width: 834, height: 1112, atlasReady: true, webglMode: 'ok' },
    { band: 'phone', width: 390, height: 844, atlasReady: true, webglMode: 'ok' },
  ],
  mapSwitchCycles: perf.ATLAS_PERF_BUDGET_THRESHOLDS.mapSwitchCycles,
  liveMeshesAfterTeardown: 24,
  contextLossObserved: true,
  contextRestored: true,
  jsHeapUsedMbBefore: 40,
  jsHeapUsedMbAfter: 48,
  cameraZoomPickEditOk: true,
  ownerSeesSecrets: true,
  playerSecretsAbsent: true,
  screenshotPaths: ['desktop.png'],
});
assert.equal(g05.rollupAtlasG05Checks(built), 'PASS');

const leak = g05.buildAtlasG05ChecksFromEvidence({
  frames: goodFrames,
  devices: [
    { band: 'desktop', width: 1280, height: 800, atlasReady: true, webglMode: 'ok' },
    { band: 'tablet', width: 834, height: 1112, atlasReady: true, webglMode: 'ok' },
    { band: 'phone', width: 390, height: 844, atlasReady: true, webglMode: 'ok' },
  ],
  mapSwitchCycles: perf.ATLAS_PERF_BUDGET_THRESHOLDS.mapSwitchCycles,
  liveMeshesAfterTeardown: 0,
  contextLossObserved: true,
  contextRestored: true,
  jsHeapUsedMbBefore: 40,
  jsHeapUsedMbAfter: 48,
  cameraZoomPickEditOk: true,
  ownerSeesSecrets: true,
  playerSecretsAbsent: false,
  screenshotPaths: ['desktop.png'],
});
assert.equal(g05.rollupAtlasG05Checks(leak), 'FAIL');

// FAIL wins over NOT_RUN (optional context-loss missing must not mask a FAIL row).
const mixed = built.map((c) =>
  c.id === 'webgl-context-loss'
    ? { ...c, status: 'NOT_RUN', detail: 'unavailable' }
    : c.id === 'player-secret-negative'
      ? { ...c, status: 'FAIL', detail: 'leak' }
      : c,
);
assert.equal(g05.rollupAtlasG05Checks(mixed), 'FAIL');

const evidencePath = join(root, '.qa/evidence/atl2-g05/quality-evidence.json');
if (existsSync(evidencePath)) {
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.format, 'atl2-g05-evidence-v1');
  assert.equal(evidence.issue, 1233);
  const rollup = g05.rollupAtlasG05Checks(evidence.checks ?? []);
  assert.ok(rollup === 'PASS' || rollup === 'FAIL' || rollup === 'NOT_RUN');
  // Host CI must not leave a PASS claim without executing required rows.
  if (rollup === 'PASS') {
    assert.ok((evidence.checks ?? []).every((c) => c.status === 'PASS'));
  }
}

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-g05',
    issue: 1233,
    requiredChecks: g05.ATLAS_G05_REQUIRED_CHECK_IDS.length,
    emptyRollup: 'NOT_RUN',
    note: 'GPU/frame PASS requires HOST Browser E2E evidence',
  }),
);
