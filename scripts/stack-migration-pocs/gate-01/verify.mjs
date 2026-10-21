import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderReport } from './render-report.mjs';

const local = path.dirname(fileURLToPath(import.meta.url));
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const allFiles = (dir, exclude = new Set()) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (exclude.has(entry.name)) return [];
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? allFiles(file, exclude) : [file];
});

// This acceptance set is independent of the mutable report and observations.
const requiredResultIds = [
  'P1_PROJECTION', 'P2_PROJECTION', 'P2_SAGA_B', 'P1_WRONG_SAGA_REVEAL',
  'P1_CORRUPT_FOREIGN_REVEAL', 'G_FULL_VIEW', 'O_FULL_VIEW', 'X_CROSS_OWNER_GET',
  'X_OWN_SAGA_WRONG_WORLD', 'UNKNOWN_SAGA', 'MISSING_SAGA', 'INACTIVE_MEMBER',
  'MISSING_ACTOR_READ', 'OWNER_WRITE', 'G_MAP_WRITE_DENIED', 'P1_MAP_WRITE_DENIED',
  'P2_MAP_WRITE_DENIED', 'X_MAP_WRITE_DENIED', 'INACTIVE_MAP_WRITE_DENIED',
  'MISSING_ACTOR_WRITE', 'FORGED_OWNER_FIELDS', 'FORGED_OWNER_NO_ESCALATION',
  'STALE_REVISION', 'NEGATIVE_REVISION', 'TRANSACTION_ROLLBACK', 'IDEMPOTENT_REPLAY',
  'IDEMPOTENCY_PAYLOAD_MISMATCH', 'REPLAY_AFTER_OWNER_REVOKED', 'REOPEN_AND_REPLAY',
  'COMPETING_REVISIONS', 'QUEUED_DUPLICATE_KEY', 'GM_SESSION_STATUS',
  'O_SESSION_STATUS_DENIED', 'P1_SESSION_STATUS_DENIED', 'P2_SESSION_STATUS_DENIED',
  'X_SESSION_STATUS_DENIED', 'INACTIVE_SESSION_STATUS_DENIED', 'GM_FOREIGN_SESSION',
  'MISSING_ACTOR_SESSION', 'GM_UNKNOWN_SAGA_SESSION', 'APPLICATION_CAPABILITIES',
  'SEQUENTIAL_100_WRITES',
].sort();
const upstreamFiles = [
  'supabase/migrations/015_inventory_item_definitions.sql', 'supabase/migrations/040_session_join_code_security.sql',
  'supabase/migrations/094_world_atlas.sql', 'supabase/migrations/104_atlas_worldbuilder_mutations.sql',
  'supabase/migrations/105_atlas_worldbuilder_player_projection.sql', '.qa/design/gates/GATE-01-drizzle-vs-zenstack.md',
];
const imports = [
  ["import { drizzle } from 'drizzle-orm/better-sqlite3';", 'drizzle-orm/better-sqlite3'],
  ["import { ZenStackClient } from '@zenstackhq/orm';", '@zenstackhq/orm'],
  ["import SQLite from 'better-sqlite3';", 'better-sqlite3'],
  ["import { openPolicyClient } from '../zenstack/engine.js';", '../zenstack/engine.js'],
  ["const db = await import('../drizzle/adapter.js');", '../drizzle/adapter.js'],
  ['const db = await import(request.module);', '[unresolved dynamic import]'],
];

function stats(samples, count) {
  assert.equal(samples.length, count, 'Required measurement count');
  assert.ok(samples.every((value) => Number.isFinite(value) && value >= 0), 'Finite nonnegative measurements required');
  const sorted = [...samples].sort((a, b) => a - b);
  return { n: count, min: sorted[0], median: sorted[Math.ceil(count * 0.5) - 1],
    p95: sorted[Math.ceil(count * 0.95) - 1], max: sorted.at(-1), samples };
}

export function validateRecordedExecution(report, observation) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.gate, 'GATE-01');
  assert.equal(report.architectureApproval, 'NOT_APPROVED');
  assert.equal(report.implementationUnblocked, false);
  assert.equal(report.status, 'EXECUTED_SCOPE_PASS');
  assert.equal(report.observedAt, observation.completedAt);
  assert.ok(Number.isFinite(Date.parse(observation.startedAt)) && Date.parse(observation.completedAt) >= Date.parse(observation.startedAt));
  assert.deepEqual(report.runtime, observation.runtime, 'Runtime summary must match execution');
  assert.deepEqual(observation.variants.map((variant) => variant.variant), ['drizzle', 'zenstack']);
  for (const variant of observation.variants) {
    assert.deepEqual(variant.results.map((result) => result.id).sort(), requiredResultIds, 'Exactly the required unique cases must be present');
    assert.ok(variant.results.every((result) => result.status === 'PASS' && result.observation !== undefined && !result.error &&
      Number.isFinite(result.durationMs) && result.durationMs >= 0), 'All required cases must have successful observations');
    assert.equal(variant.passed, requiredResultIds.length);
    assert.equal(variant.failed, 0);
    assert.deepEqual(variant.writes, stats(variant.writes.samples, 100), 'Write statistics must derive from all samples');
    const writes = variant.results.find((result) => result.id === 'SEQUENTIAL_100_WRITES').observation;
    assert.deepEqual(writes.latencyMs, variant.writes);
    assert.equal(writes.receiptCount, 100);
    assert.equal(writes.final.revision, 100);
    assert.equal(writes.final.title, 'PERF_99');
    const cold = variant.coldStarts.observations;
    assert.deepEqual(variant.coldStarts.processWallMs, stats(cold.map((entry) => entry.processWallMs), 10), 'Cold statistics must derive from process observations');
    for (const entry of cold) {
      assert.equal(entry.observation.variant, variant.variant);
      assert.deepEqual(entry.observation.ids, ['p1', 'public']);
      for (const field of ['importMs', 'openAndFirstAuthorizedReadMs', 'totalInsideProcessMs']) {
        assert.ok(Number.isFinite(entry.observation[field]) && entry.observation[field] >= 0);
      }
    }
  }
  assert.deepEqual(report.candidateResults, observation.variants.map((variant) => ({
    candidate: variant.variant, passed: variant.results.length, failed: 0,
    warmWriteLatencyMs: variant.writes, coldProcessWallMs: variant.coldStarts.processWallMs,
  })), 'Report counts and latency must derive from observations');

  const engine = observation.directZenstackEngine;
  assert.deepEqual(Object.keys(engine).sort(), ['directRows', 'queryBuilderRows', 'gmWrite', 'forgedWorldWrite', 'rawRead', 'rawWrite', 'anonymousRows', 'source'].sort());
  for (const rows of [engine.directRows, engine.queryBuilderRows]) {
    assert.deepEqual(rows.map((row) => row.id), ['p1', 'public']);
    assert.ok(rows.every((row) => row.gmNotes === null));
  }
  assert.equal(engine.gmWrite.reason, 'not-found');
  for (const field of ['forgedWorldWrite', 'rawRead', 'rawWrite']) assert.equal(engine[field].reason, 'rejected-by-policy');
  assert.deepEqual(engine.anonymousRows, []);
  assert.deepEqual(observation.drizzleRawCapability.observedRawRows.map((row) => row.id), ['foreign', 'hidden', 'p1', 'perf', 'public', 'wrong-saga']);
  assert.equal(observation.drizzleRawCapability.rawWriteRowsInsideRolledBackTransaction, 1);
  assert.deepEqual(observation.applicationImportBoundary.attackAttempts, imports.map(([source, rejected]) => ({ source, rejected: [rejected] })));
  assert.deepEqual(observation.domainBoundary.forbidden, []);
  assert.deepEqual(report.gateRows.map((row) => row.row), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(report.gateRows[4].observation, observation.domainBoundary);
  for (const row of report.gateRows) {
    if (row.tests) assert.ok(row.tests.length > 0 && row.tests.every((id) => requiredResultIds.includes(id)), 'Gate rows must reference actual required cases');
  }
}

export function verifyEvidence({ repo, evidence, sourceRoot = local, report, observation }) {
  const canonicalFiles = allFiles(sourceRoot, new Set(['node_modules', 'work', '.gitignore']));
  const expectedSources = [...canonicalFiles.map((file) => ({ path: path.relative(repo, file), sha256: sha(file) })),
    ...upstreamFiles.map((file) => ({ path: file, sha256: sha(path.join(repo, file)) }))];
  const byPath = (a, b) => a.path.localeCompare(b.path);
  assert.deepEqual([...report.sourceFiles].sort(byPath), expectedSources.sort(byPath), 'Full canonical source coverage and hashes are mandatory');
  assert.deepEqual(report.evidenceFiles, [{ path: path.relative(repo, path.join(evidence, 'observations.json')),
    sha256: sha(path.join(evidence, 'observations.json')) }], 'Exactly the current observation file must be bound');
  validateRecordedExecution(report, observation);
  const productDomainManifest = allFiles(path.join(repo, 'src/domains')).filter((file) => /\.tsx?$/.test(file)).sort()
    .map((file) => ({ path: path.relative(repo, file), sha256: sha(file) }));
  assert.equal(createHash('sha256').update(JSON.stringify(productDomainManifest)).digest('hex'), observation.domainBoundary.productDomainTreeSha256, 'Product domain tree changed since import check');
  assert.equal(observation.domainBoundary.productDomainFileCount, productDomainManifest.length);
  assert.equal(observation.domainBoundary.checkedFiles, productDomainManifest.length + allFiles(path.join(sourceRoot, 'domain')).filter((file) => /\.tsx?$/.test(file)).length);
  assert.equal(observation.applicationImportBoundary.checkedFiles, allFiles(path.join(sourceRoot, 'application')).filter((file) => file.endsWith('.ts')).length);
  assert.equal(report.lockfile.sha256, sha(path.join(sourceRoot, 'package-lock.json')));
  assert.equal(report.lockfile.lockfilePresent, true);
  assert.equal(fs.readFileSync(path.join(evidence, 'report.md'), 'utf8'), renderReport(report), 'Rendered report drift');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = process.env.GATE01_REPO_ROOT ?? path.resolve(local, '../../..');
  const evidence = process.env.GATE01_EVIDENCE_DIR ?? path.join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-01');
  const sourceRoot = process.env.GATE01_SOURCE_ROOT ?? local;
  const report = JSON.parse(fs.readFileSync(path.join(evidence, 'report.json'), 'utf8'));
  const observation = JSON.parse(fs.readFileSync(path.join(evidence, 'observations.json'), 'utf8'));
  verifyEvidence({ repo, evidence, sourceRoot, report, observation });
  process.stdout.write('GATE-01 full sources, exact cases, components and derived measurements verified (' + report.runtime.node + '); no architecture approval.\n');
}
