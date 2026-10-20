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
  '.qa/design/atlas-live-e2e-cutover-gate.md',
  '.qa/design/gates/README.md',
  '.qa/design/gates/GATE-01-drizzle-vs-zenstack.md',
  '.qa/design/gates/GATE-02-better-auth-colyseus.md',
  '.qa/design/gates/GATE-03-colyseus-http-vs-hono.md',
  '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md',
  '.qa/design/gates/GATE-05-tauri-packaging.md',
  '.qa/intake/rpc-contracts/README.md',
  '.qa/intake/rpc-contracts/inventory.json',
  '.qa/intake/rpc-contracts/SPLIT_TICKETS.md',
  'docs/architektur-sqlite-based.md',
  '.qa/intake/edge-infra-contracts/README.md',
  '.qa/intake/edge-infra-contracts/inventory.json',
  '.qa/intake/edge-infra-contracts/SPLIT_TICKETS.md',
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

const mig700 = issues.find((i) => i.localId === 'MIG-700');
if (!mig700) fail('missing MIG-700');
const d700 = new Set(mig700.dependsOn);
for (const need of ['ATLAS-LIVE-E2E', 'GATE-01', 'GATE-02', 'GATE-03', 'GATE-04', 'MIG-013', 'MIG-022']) {
  if (!d700.has(need)) fail(`MIG-700 missing required dep ${need}`);
}
if (mig700.dependsOn.length < 20) fail('MIG-700 dependsOn too small for cutover safety');

const mig702 = issues.find((i) => i.localId === 'MIG-702');
if (!mig702 || !mig702.dependsOn.includes('ATLAS-LIVE-E2E')) {
  fail('MIG-702 must depend on ATLAS-LIVE-E2E (#770)');
}

const atlas = issues.find((i) => i.localId === 'ATLAS-LIVE-E2E');
if (!atlas || atlas.githubIssue !== 770) fail('ATLAS-LIVE-E2E must reference githubIssue 770');

const atlasDesign = readFileSync(join(root, '.qa/design/atlas-live-e2e-cutover-gate.md'), 'utf8');
for (const needle of ['#770', 'MIG-700', 'BLOCKED / NEEDS DECISION', 'E2E_ATLAS_PRODUCT', 'isolated']) {
  if (!atlasDesign.includes(needle)) fail(`atlas gate design missing ${needle}`);
}
if (!atlasDesign.includes('test.skip') && !atlasDesign.includes('optional')) {
  fail('atlas gate design must reject optional/skippable live tests');
}

for (const gateRel of [
  '.qa/design/gates/GATE-01-drizzle-vs-zenstack.md',
  '.qa/design/gates/GATE-02-better-auth-colyseus.md',
  '.qa/design/gates/GATE-03-colyseus-http-vs-hono.md',
  '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md',
  '.qa/design/gates/GATE-05-tauri-packaging.md',
]) {
  const g = readFileSync(join(root, gateRel), 'utf8');
  for (const needle of ['PASS', 'Negative', 'Decision criteria', 'not APPROVED', 'On APPROVED']) {
    if (!g.includes(needle)) fail(`${gateRel} missing ${needle}`);
  }
}
const g04 = readFileSync(join(root, '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md'), 'utf8');
if (!/expectedRevision|idempotency/i.test(g04) || !/concurrent/i.test(g04)) {
  fail('GATE-04 must cover revision, idempotency, concurrency');
}
const g02 = readFileSync(join(root, '.qa/design/gates/GATE-02-better-auth-colyseus.md'), 'utf8');
if (!/revoke/i.test(g02) || !/reconnect/i.test(g02) || !/GM/i.test(g02)) {
  fail('GATE-02 must cover revoke/reconnect and role-specific join');
}

const rpcInv = JSON.parse(
  readFileSync(join(root, '.qa/intake/rpc-contracts/inventory.json'), 'utf8'),
);
if (!Array.isArray(rpcInv.rpcs) || rpcInv.rpcs.length < 55) {
  fail(`rpc inventory must cover ≥55 rpcs (got ${rpcInv.rpcs?.length ?? 0})`);
}
for (const e of rpcInv.rpcs) {
  if (!e.rpc || !e.proposedSuccessor?.commandModule) fail(`rpc entry incomplete: ${e.rpc}`);
  if (!e.sqlDefinitions?.length) fail(`rpc ${e.rpc} missing sqlDefinitions`);
  if (!e.requiredTests?.length) fail(`rpc ${e.rpc} missing requiredTests`);
}

const edgeInv = JSON.parse(
  readFileSync(join(root, '.qa/intake/edge-infra-contracts/inventory.json'), 'utf8'),
);
if (!Array.isArray(edgeInv.edges) || edgeInv.edges.length < 24) {
  fail(`edge inventory must cover ≥24 functions (got ${edgeInv.edges?.length ?? 0})`);
}
if (!Array.isArray(edgeInv.infrastructure) || edgeInv.infrastructure.length < 13) {
  fail(`infra inventory must cover ≥13 areas (got ${edgeInv.infrastructure?.length ?? 0})`);
}
for (const e of edgeInv.edges) {
  if (!e.function || !e.proposedService || !e.requiredTests?.length) {
    fail(`edge entry incomplete: ${e.function}`);
  }
}
const media = edgeInv.edges.find((e) => e.function === 'session-media-token');
if (!media || !media.requiredTests?.some((t) => /LiveKit|LIVEKIT|membership/i.test(t))) {
  fail('session-media-token must have LiveKit/membership-specific tests');
}
const aiGm = edgeInv.edges.find((e) => e.function === 'ai-gm');
if (!aiGm || !aiGm.requiredTests?.some((t) => /rate|429|membership/i.test(t))) {
  fail('ai-gm must have rate-limit/membership-specific tests');
}
for (const a of edgeInv.infrastructure) {
  if (!a.area || !a.proposedFacade || !a.requiredTests?.length) {
    fail(`infra entry incomplete: ${a.area}`);
  }
}

const edgeReadme = readFileSync(join(root, '.qa/intake/edge-infra-contracts/README.md'), 'utf8');
for (const needle of ['session-media-token', 'ai-gm', 'LiveKit', 'SPEC only']) {
  if (!edgeReadme.includes(needle)) fail(`edge README missing ${needle}`);
}

console.log(
  `stack-migration-prep-check: OK (${issues.length} issues, topo=${seen.length}, published=${doc.meta.githubIssuesPublished})`,
);
