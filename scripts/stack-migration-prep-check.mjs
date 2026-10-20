#!/usr/bin/env node
/**
 * stack-migration-prep-check — validate local-first migration draft artifacts.
 * Location: scripts/stack-migration-prep-check.mjs
 *
 * Does not publish GitHub issues. Fails on incomplete/cyclic drafts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(msg) {
  console.error(`stack-migration-prep-check failed: ${msg}`);
  process.exit(1);
}

const required = [
  '.qa/design/local-first-stack-migration.md',
  '.qa/intake/local-first-stack-migration-issues.md',
  '.qa/intake/local-first-stack-migration-issues.json',
  '.qa/evidence/stack-migration-prep/legacy-target-matrix.md',
  '.qa/evidence/stack-migration-prep/pr-triage.md',
  '.qa/evidence/stack-migration-prep/baseline.md',
  '.qa/evidence/stack-migration-prep/dependency-graph.md',
  '.qa/evidence/stack-migration-prep/coverage-report.md',
  '.qa/evidence/stack-migration-prep/phase0-status.md',
  '.qa/evidence/stack-migration-prep/EXECUTION_CONTRACT.md',
  '.qa/evidence/stack-migration-prep/PR771_REVIEW.md',
  'docs/architektur-sqlite-based.md',
];

for (const rel of required) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

const doc = JSON.parse(
  readFileSync(join(root, '.qa/intake/local-first-stack-migration-issues.json'), 'utf8'),
);

if (doc.meta?.githubIssuesPublished === true) {
  fail('githubIssuesPublished must stay false until freigabe');
}

const issues = doc.issues;
if (!Array.isArray(issues) || issues.length < 20) fail('issues array too small');

const ids = new Set(issues.map((i) => i.localId));
const indeg = new Map([...ids].map((id) => [id, 0]));
const edges = new Map([...ids].map((id) => [id, []]));

for (const issue of issues) {
  for (const key of ['before', 'after', 'behavior', 'scope', 'acceptance', 'dependsOn', 'status']) {
    if (!(key in issue)) fail(`${issue.localId} missing ${key}`);
  }
  if (!Array.isArray(issue.acceptance) || issue.acceptance.length === 0 || issue.acceptance.length > 5) {
    fail(`${issue.localId} acceptance must be 1..5 items`);
  }
  const blob = JSON.stringify(issue).toLowerCase();
  if (blob.includes('tbd') || blob.includes('todo:') || blob.includes('lorem ipsum')) {
    fail(`${issue.localId} contains placeholder text`);
  }
  if (issue.status === 'ready' && /GATE-0/.test(issue.localId) === false) {
    // ready issues must not depend on unresolved gates
    for (const d of issue.dependsOn) {
      const dep = issues.find((x) => x.localId === d);
      if (dep && dep.status === 'needs-design') {
        fail(`${issue.localId} ready but depends on needs-design ${d}`);
      }
    }
  }
  if (issue.labels?.includes('agent-ready') && issue.status !== 'ready') {
    fail(`${issue.localId} agent-ready label without status=ready`);
  }
  for (const d of issue.dependsOn) {
    if (!ids.has(d)) fail(`${issue.localId} unknown dep ${d}`);
    indeg.set(issue.localId, (indeg.get(issue.localId) ?? 0) + 1);
    edges.get(d).push(issue.localId);
  }
}

const q = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0);
const seen = [];
while (q.length) {
  const n = q.shift();
  seen.push(n);
  for (const m of edges.get(n) ?? []) {
    indeg.set(m, indeg.get(m) - 1);
    if (indeg.get(m) === 0) q.push(m);
  }
}
if (seen.length !== ids.size) fail('dependency cycle detected');

const design = readFileSync(join(root, '.qa/design/local-first-stack-migration.md'), 'utf8');
for (const needle of ['GATE-01', 'BLOCKED', 'Better Auth', 'Colyseus', 'SQLite']) {
  if (!design.includes(needle)) fail(`design missing ${needle}`);
}

// Cutover safety: MIG-700 must not depend only on a tiny subset.
const mig700 = issues.find((i) => i.localId === 'MIG-700');
if (!mig700) fail('missing MIG-700');
const d700 = new Set(mig700.dependsOn);
for (const need of ['ATLAS-LIVE-E2E', 'GATE-01', 'GATE-02', 'GATE-03', 'GATE-04', 'MIG-013', 'MIG-022']) {
  if (!d700.has(need)) fail(`MIG-700 missing required dep ${need}`);
}
if (mig700.dependsOn.length < 20) fail('MIG-700 dependsOn too small for cutover safety');

console.log(
  `stack-migration-prep-check: OK (${issues.length} issues, topo=${seen.length}, published=${doc.meta.githubIssuesPublished})`,
);
