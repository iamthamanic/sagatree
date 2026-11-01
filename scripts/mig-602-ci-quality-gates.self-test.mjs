/**
 * MIG-602 (#847): CI quality-gate wiring canary.
 * Asserts merge-gate requiredChecks + migration workflows have no continue-on-error
 * and keep Atlas/GATE/baseline jobs fail-closed with distinct artifact names.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const REQUIRED = [
  'Test Gate',
  'Composition Gate',
  'ECC Merge Gate',
  'Actual RLS regression canary',
  'RPC source regeneration and migration contracts',
  'Browser E2E',
  'Atlas isolated real product journey',
  'PostgreSQL baseline security and persistence',
  'GATE-01 real SQLite policy candidates',
  'GATE-02 and GATE-03 real browser, auth and transport candidates',
];

function parseRequiredChecks(yaml) {
  const lines = yaml.split('\n');
  const out = [];
  let inChecks = false;
  for (const line of lines) {
    if (/^requiredChecks:\s*$/.test(line)) {
      inChecks = true;
      continue;
    }
    if (inChecks) {
      if (/^\S/.test(line) && !/^\s*-/.test(line)) break;
      const item = line.match(/^\s*-\s+(.+?)\s*$/);
      if (item) out.push(item[1].replace(/^["']|["']$/g, ''));
    }
  }
  return out;
}

test('merge-gate.yaml lists host/DB/transport/browser quality gates as required', () => {
  const checks = parseRequiredChecks(read('.qa/merge-gate.yaml'));
  for (const name of REQUIRED) {
    assert.ok(checks.includes(name), `requiredChecks missing: ${name}`);
  }
});

test('migration CI workflows never use continue-on-error', () => {
  for (const rel of [
    '.github/workflows/stack-migration-baseline.yml',
    '.github/workflows/stack-migration-pocs.yml',
    '.github/workflows/verify.yml',
    '.github/workflows/stack-migration-contracts.yml',
  ]) {
    const text = read(rel);
    assert.doesNotMatch(text, /continue-on-error\s*:/, `${rel} must not continue-on-error`);
  }
});

/** Split GHA workflow YAML into top-level job blocks (indent = 2 spaces). */
function artifactJobs(workflowText) {
  return workflowText
    .split(/\n(?=  [a-z0-9-]+:\n)/)
    .filter((block) => /upload-artifact/.test(block));
}

test('baseline workflow owns distinct Atlas / RLS / Postgres jobs with fail-closed artifacts', () => {
  const text = read('.github/workflows/stack-migration-baseline.yml');
  assert.match(text, /name:\s*Atlas isolated real product journey/);
  assert.match(text, /name:\s*Actual RLS regression canary/);
  assert.match(text, /name:\s*PostgreSQL baseline security and persistence/);
  assert.match(text, /npm run product --prefix scripts\/stack-migration-db/);
  assert.match(text, /npm run canary --prefix scripts\/stack-migration-db/);
  const jobs = artifactJobs(text);
  assert.equal(jobs.length, 3, 'baseline workflow must keep three artifact-backed jobs');
  for (const block of jobs) {
    assert.match(block, /if-no-files-found:\s*error/, 'each artifact upload must be fail-closed');
  }
  assert.doesNotMatch(text, /test\.skip/);
});

test('GATE-01/02/03 candidate workflows stay distinct and artifact-backed', () => {
  const text = read('.github/workflows/stack-migration-pocs.yml');
  assert.match(text, /name:\s*GATE-01 real SQLite policy candidates/);
  assert.match(text, /name:\s*GATE-02 and GATE-03 real browser, auth and transport candidates/);
  const jobs = artifactJobs(text);
  assert.equal(jobs.length, 2, 'pocs workflow must keep two artifact-backed jobs');
  for (const block of jobs) {
    assert.match(block, /if-no-files-found:\s*error/, 'each artifact upload must be fail-closed');
  }
});

test('ECC Merge Gate re-runs on isolated candidates and waits for long MIG-602 jobs', () => {
  const text = read('.github/workflows/ecc-merge-gate.yml');
  assert.match(text, /Stack migration isolated candidates/);
  assert.match(text, /ECC_MERGE_GATE_CHECK_WAIT_MS:\s*'1200000'/);
  assert.match(text, /timeout-minutes:\s*28/);
});

test('Test Gate still runs Drizzle host persistence + architecture boundary proofs', () => {
  const text = read('scripts/test-gate.mjs');
  assert.match(text, /checkGate01DrizzleHostPersistence/);
  assert.match(text, /gate-01-drizzle-host-persistence\.self-test\.mjs/);
  assert.match(text, /architecture-boundary-check/);
});
