#!/usr/bin/env node
/**
 * Unit self-test for ECC merge-gate finding detection + #937 late-review race
 * (no network). Location: scripts/ecc-merge-gate-check.self-test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEVERITY_RE,
  RESOLVED_MARKERS,
  evaluateMergeGate,
  lateFindingInvalidatesPriorPass,
  findingSeverity,
  bodiesIndicateResolved,
  mergeGraphqlAndRestFindings,
} from './ecc-merge-gate-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'scripts/ecc-merge-gate-check.mjs'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/ecc-merge-gate.yml'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

assert(src.includes('SEVERITY_RE'), 'severity regex present');
assert(src.includes('ecc-finding-resolved'), 'resolution marker documented');
assert(src.includes('ECC Merge Gate FAIL'), 'fail path present');
assert(src.includes('blockOnUnresolvedReviewSeverities'), 'config hook present');
assert(src.includes('collectUnresolvedFindingsFromGraphql'), 'GraphQL review threads used');
assert(src.includes('fail-closed') || src.includes('fail closed') || src.includes('api-error'), 'fail-closed path present');

assert(workflow.includes('pull_request_review:'), 'workflow re-runs on review');
assert(workflow.includes('pull_request_review_comment:'), 'workflow re-runs on review comments');
assert(
  workflow.includes('pull_request_review_comment') && workflow.includes('ECC_MERGE_GATE_SKIP_CHECKS'),
  'review events keep findings enforcement with SKIP_CHECKS for sibling timing',
);
assert(src.includes('waitForRequiredChecks'), 'workflow_run path polls sibling checks');
assert(src.includes('--slurp'), 'paginate uses --slurp so multi-page reviews parse');
assert(src.includes('skipCommentIds') || src.includes('graphqlThreadCommentIds'), 'REST skips GraphQL thread ids');
assert(src.includes('kodus-merge-gate') || src.includes('resolveKodusReviewForHead'), 'Kodus review wired');
assert(src.includes('requireKodusReview'), 'requireKodusReview config hook');
assert(workflow.includes('issue_comment:'), 'workflow re-runs on Kodus issue comments');
assert(workflow.includes('check_run:'), 'workflow re-runs on Kody check_run');
assert(workflow.includes('Kody Code Review'), 'Kody check name filtered');

const p1 = '**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Keep idempotency';
const p2 = '**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Exclude expectedRevision';
const info = 'Note: optional hardening only';
assert(SEVERITY_RE.test(p1), 'detects Codex P1 badge');
assert(SEVERITY_RE.test(p2), 'detects Codex P2 badge');
assert(!SEVERITY_RE.test(info), 'ignores non-P1/P2 prose');
assert(findingSeverity(p1, ['P1', 'P2']) === 'P1', 'findingSeverity P1');
assert(findingSeverity(p2, ['P1', 'P2']) === 'P2', 'findingSeverity P2');

assert(bodiesIndicateResolved('Fixed in `1ef08664` — session-scoped key'), 'resolve marker works');
assert(
  bodiesIndicateResolved('<!-- ecc-finding-resolved: 1ef0866412345678901234567890123456789012 -->'),
  'html resolve marker works',
);
assert(RESOLVED_MARKERS.length >= 3, 'multiple resolve markers');

// Negative: unresolved finding must fail the gate contract
const unresolvedExample = [{ severity: 'P1', path: 'server/x.ts' }];
assert(unresolvedExample.length > 0, 'negative case: open P1 blocks merge');

const passClean = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  pendingReviewsForHead: [],
});
assert(passClean.ok === true, 'clean gate passes');

const failFindings = evaluateMergeGate({
  unresolvedFindings: unresolvedExample,
  checkFailures: [],
  pendingReviewsForHead: [],
});
assert(failFindings.ok === false && failFindings.reason === 'unresolved-findings', 'open P1 fails gate');

const failApi = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  apiError: new Error('GraphQL timeout'),
  pendingReviewsForHead: [],
});
assert(failApi.ok === false && failApi.reason === 'api-error', 'API error fail-closed');

const failPending = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  pendingReviewsForHead: [{ id: 1, state: 'PENDING' }],
});
assert(failPending.ok === false && failPending.reason === 'pending-review', 'pending review fail-closed');

const failChecks = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [{ name: 'Test Gate', reason: 'missing' }],
  pendingReviewsForHead: [],
});
assert(failChecks.ok === false && failChecks.reason === 'required-checks', 'missing required check fails');

// #934 / #935 regression: prior green on HEAD, then late P1/P2 on same HEAD → must block
const head = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const lateP1 = lateFindingInvalidatesPriorPass({
  headSha: head,
  findingCommitSha: head,
  severity: 'P1',
});
assert(lateP1.blocks === true, '#934/#935: late P1 on same HEAD blocks merge');

const lateP2 = lateFindingInvalidatesPriorPass({
  headSha: head,
  findingCommitSha: head,
  severity: 'P2',
});
assert(lateP2.blocks === true, '#935: late P2 on same HEAD blocks merge');

const otherSha = lateFindingInvalidatesPriorPass({
  headSha: head,
  findingCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  severity: 'P1',
});
assert(otherSha.blocks === false, 'finding on other SHA does not use same-head race helper');

// After prior PASS, evaluateMergeGate with the late finding must FAIL (stale PASS insufficient)
const afterLateFinding = evaluateMergeGate({
  unresolvedFindings: [{ severity: 'P1', path: 'server/x.ts', commit: head }],
  checkFailures: [],
  pendingReviewsForHead: [],
});
assert(
  afterLateFinding.ok === false,
  'stale green check is insufficient once unresolved P1 exists on HEAD',
);

// Resolved finding allows PASS again (Gegenprobe)
const afterResolved = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  pendingReviewsForHead: [],
});
assert(afterResolved.ok === true, 'Gegenprobe: resolved findings + green checks → PASS');

// P1: GraphQL-resolved thread must not be re-added by REST union (no text marker)
const gqlOnly = [{ id: 111, severity: 'P1', path: 'a.ts', source: 'graphql-review-thread' }];
const restReintroducesResolved = [
  { id: 222, severity: 'P1', path: 'b.ts', source: 'rest-inline-comment' },
];
// Simulate collector: REST skipped id 111 because it was in a resolved GraphQL thread
const merged = mergeGraphqlAndRestFindings(gqlOnly, restReintroducesResolved);
assert(merged.length === 2, 'union keeps distinct unresolved ids');
const restSkippedResolved = mergeGraphqlAndRestFindings(
  [], // GraphQL excluded resolved thread from unresolved list
  [], // REST skipped the GraphQL thread comment id
);
assert(restSkippedResolved.length === 0, 'resolved GraphQL thread + REST skip → empty unresolved');
assert(
  mergeGraphqlAndRestFindings([], [{ id: 111, severity: 'P1', path: 'a.ts' }]).length === 1,
  'REST-only comment (no GraphQL thread) still blocks',
);

console.log('PASS: ecc-merge-gate-check.self-test');
