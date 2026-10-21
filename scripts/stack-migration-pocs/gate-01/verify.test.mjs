import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateRecordedExecution, verifyEvidence } from './verify.mjs';

const local = path.dirname(fileURLToPath(import.meta.url));
const repo = process.env.GATE01_REPO_ROOT ?? path.resolve(local, '../../..');
const evidence = process.env.GATE01_EVIDENCE_DIR ?? path.join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-01');
const sourceRoot = process.env.GATE01_SOURCE_ROOT ?? local;
const report = JSON.parse(fs.readFileSync(path.join(evidence, 'report.json'), 'utf8'));
const observation = JSON.parse(fs.readFileSync(path.join(evidence, 'observations.json'), 'utf8'));

test('recorded successful execution has complete source coverage and derived summaries', () => {
  verifyEvidence({ repo, evidence, sourceRoot, report, observation });
});

function rejects(name, mutate) {
  test(name, () => {
    const changedReport = structuredClone(report);
    const changedObservation = structuredClone(observation);
    mutate(changedReport, changedObservation);
    assert.throws(() => validateRecordedExecution(changedReport, changedObservation));
  });
}

rejects('inflated PASS count is rejected even if report rendering is updated', (r) => {
  r.candidateResults[0].passed = 420;
});
rejects('changed report latency is rejected', (r) => {
  r.candidateResults[0].warmWriteLatencyMs.p95 = 0;
});
rejects('coordinated false latency summary still disagrees with measured samples', (r, o) => {
  o.variants[0].writes.p95 = 0;
  o.variants[0].results.find((item) => item.id === 'SEQUENTIAL_100_WRITES').observation.latencyMs.p95 = 0;
  r.candidateResults[0].warmWriteLatencyMs.p95 = 0;
});
rejects('duplicated PASS does not replace the required cross-saga case', (_r, o) => {
  const cases = o.variants[0].results;
  cases[cases.findIndex((item) => item.id === 'P1_WRONG_SAGA_REVEAL')] = structuredClone(cases[0]);
});
for (const component of ['directZenstackEngine', 'drizzleRawCapability', 'applicationImportBoundary']) {
  rejects('missing required component fails: ' + component, (_r, o) => { delete o[component]; });
}
rejects('missing direct engine denial is rejected', (_r, o) => {
  delete o.directZenstackEngine.rawWrite;
});
rejects('missing import-boundary probe is rejected', (_r, o) => {
  o.applicationImportBoundary.attackAttempts.pop();
});
rejects('cold process sample cannot be replaced by a summary alone', (_r, o) => {
  o.variants[0].coldStarts.observations.pop();
});
test('omitting the policy source entry cannot suppress its drift check', () => {
  const changed = structuredClone(report);
  changed.sourceFiles = changed.sourceFiles.filter((entry) => !entry.path.endsWith('/drizzle/policy-service.ts'));
  assert.throws(() => verifyEvidence({ repo, evidence, sourceRoot, report: changed, observation }), /Full canonical source coverage/);
});
test('omitting the observation hash cannot suppress evidence drift', () => {
  const changed = structuredClone(report);
  changed.evidenceFiles = [];
  assert.throws(() => verifyEvidence({ repo, evidence, sourceRoot, report: changed, observation }), /current observation file/);
});
