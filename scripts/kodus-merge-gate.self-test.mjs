#!/usr/bin/env node
/**
 * kodus-merge-gate.self-test — offline fixtures for Kodus completion + severity.
 * Location: scripts/kodus-merge-gate.self-test.mjs
 */
import {
  KODY_CHECK_NAME,
  KODY_SEVERITY_RE,
  isKodyBotLogin,
  kodyFindingSeverity,
  kodyBodiesIndicateDismissed,
  evaluateKodusCheckRun,
  selectKodusCheckRun,
  evaluateKodusHeadEvidence,
  findKodusApprovedReviewForHead,
  collectKodusIssueCommentFindings,
  collectDismissedIssueCommentIds,
  extractDismissedFindingIds,
} from './kodus-merge-gate.mjs';
import { evaluateMergeGate, findingSeverity } from './ecc-merge-gate-check.mjs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

assert(isKodyBotLogin('kody-ai'), 'kody-ai login');
assert(isKodyBotLogin('kody-ai[bot]'), 'kody-ai[bot] login');
assert(!isKodyBotLogin('evil-kody'), 'reject spoofed login');

const criticalBody =
  '![kody code-review](https://img.shields.io/badge/kody-code--review-312B4B?labelColor=C9BBF2) ![Bug](https://img.shields.io/badge/Bug-B71C1C) ![critical](https://img.shields.io/badge/severity_level-critical-FF3D3D)\n\n**Invalid layers**';
assert(KODY_SEVERITY_RE.test(criticalBody), 'kody severity regex');
assert(kodyFindingSeverity(criticalBody) === 'Critical', 'critical mapping');

const allowed = ['P1', 'P2', 'Critical', 'Important', 'High', 'Medium', 'Low', 'Info'];
assert(
  findingSeverity(criticalBody, allowed, { authorLogin: 'kody-ai' }) === 'Critical',
  'findingSeverity integrates kody',
);

assert(evaluateKodusCheckRun(null).reason === 'kodus-missing', 'missing kody check fails');
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    app: { slug: 'kody-ai' },
    status: 'in_progress',
    conclusion: null,
    output: { title: 'Running' },
  }).reason === 'kodus-pending',
  'in_progress fails',
);
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    app: { slug: 'kody-ai' },
    status: 'completed',
    conclusion: 'success',
    output: { title: 'Code Review Started' },
  }).reason === 'kodus-started-only',
  'Started title never PASS',
);
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    app: { slug: 'not-kody' },
    status: 'completed',
    conclusion: 'success',
    output: { title: 'Code Review Complete' },
  }).reason === 'kodus-spoofed-app',
  'spoofed app fails',
);
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    status: 'completed',
    conclusion: 'success',
    output: { title: 'Code Review Complete' },
  }).reason === 'kodus-spoofed-app',
  'missing app object fails',
);
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    app: { slug: 'kody-ai' },
    status: 'completed',
    conclusion: 'neutral',
    output: { title: 'Code Review Complete' },
  }).reason === 'kodus-failed',
  'neutral conclusion fails',
);

const okRun = {
  name: KODY_CHECK_NAME,
  app: { slug: 'kody-ai' },
  status: 'completed',
  conclusion: 'success',
  completed_at: '2026-10-26T21:27:38Z',
  output: {
    title: 'Code Review Complete',
    summary: 'Review finished successfully. Suggestions (if any) were posted as PR/file comments.',
  },
};
assert(evaluateKodusCheckRun(okRun).ok === true, 'complete success PASS');
assert(selectKodusCheckRun([okRun, { name: 'Test Gate' }])?.name === KODY_CHECK_NAME, 'select kody');

const skippedAfterComplete = {
  name: KODY_CHECK_NAME,
  app: { slug: 'kody-ai' },
  status: 'completed',
  conclusion: 'skipped',
  completed_at: '2026-10-26T23:06:43Z',
  output: { title: 'Code Review Skipped', summary: 'No changed files in this pull request.' },
};
assert(
  selectKodusCheckRun([okRun, skippedAfterComplete])?.conclusion === 'success',
  'later skipped must not wipe earlier Complete on same HEAD',
);
assert(
  evaluateKodusCheckRun(selectKodusCheckRun([okRun, skippedAfterComplete])).ok === true,
  'Complete+later-Skipped still evaluates PASS',
);
assert(
  selectKodusCheckRun([skippedAfterComplete])?.conclusion === 'skipped',
  'skipped alone still selected',
);
const pendingRun = {
  name: KODY_CHECK_NAME,
  app: { slug: 'kody-ai' },
  status: 'in_progress',
  conclusion: null,
  started_at: '2026-10-26T23:10:00Z',
  output: { title: 'Code Review Starting' },
};
assert(
  selectKodusCheckRun([okRun, pendingRun])?.status === 'in_progress',
  'in_progress wins over prior Complete',
);

const approvedReview = {
  id: 5660272270,
  state: 'APPROVED',
  commit_id: '30884f5bdb4c6bc7af92d87f1076a95b61d95c69',
  submitted_at: '2026-10-26T23:05:41Z',
  user: { login: 'kody-ai[bot]' },
};
assert(
  findKodusApprovedReviewForHead([approvedReview], '30884f5bdb4c6bc7af92d87f1076a95b61d95c69')?.id ===
    5660272270,
  'find APPROVED on HEAD',
);
assert(
  evaluateKodusHeadEvidence(skippedAfterComplete, {
    reviews: [approvedReview],
    headSha: '30884f5bdb4c6bc7af92d87f1076a95b61d95c69',
  }).ok === true,
  'skipped check + APPROVED review on HEAD = PASS',
);
assert(
  evaluateKodusHeadEvidence(skippedAfterComplete, {
    reviews: [],
    headSha: '30884f5bdb4c6bc7af92d87f1076a95b61d95c69',
  }).ok === false,
  'skipped alone without APPROVED still FAIL',
);

assert(
  evaluateMergeGate({
    unresolvedFindings: [],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: false, reason: 'kodus-missing', detail: 'missing' },
  }).reason === 'kodus-missing',
  'gate blocks missing kody',
);
assert(
  evaluateMergeGate({
    unresolvedFindings: [{ severity: 'Critical', path: 'x.ts', user: 'kody-ai' }],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: true, reason: 'kodus-complete' },
  }).reason === 'unresolved-findings',
  'open kody finding blocks',
);
assert(
  evaluateMergeGate({
    unresolvedFindings: [],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: true, reason: 'kodus-complete' },
  }).ok === true,
  'kody complete + clean findings PASS',
);

assert(
  kodyBodiesIndicateDismissed('<!-- ecc-finding-dismissed id=99: false-positive -->'),
  'dismiss marker',
);
assert(
  extractDismissedFindingIds(
    '<!-- ecc-finding-dismissed id=42: reason --> see https://x/issuecomment-42',
  ).has('42'),
  'extract dismiss id',
);

const dismissed = collectDismissedIssueCommentIds([
  {
    id: 9,
    author_association: 'OWNER',
    body: '<!-- ecc-finding-dismissed id=2: false-positive barrel -->',
  },
  {
    id: 10,
    author_association: 'NONE',
    body: '<!-- ecc-finding-dismissed id=3: attacker -->',
  },
]);
assert(dismissed.has('2'), 'trusted owner dismiss');
assert(!dismissed.has('3'), 'untrusted dismiss ignored');

const headAt = '2026-10-26T21:00:00Z';
const issueFindings = collectKodusIssueCommentFindings(
  [
    {
      id: 1,
      user: { login: 'kody-ai[bot]' },
      body: '## Code Review Completed!\n<!-- kody-codereview-completed-1 -->',
      created_at: '2026-10-26T21:10:00Z',
    },
    {
      id: 2,
      user: { login: 'kody-ai[bot]' },
      body: criticalBody,
      html_url: 'https://example/2',
      created_at: '2026-10-26T21:10:00Z',
    },
    {
      id: 3,
      user: { login: 'kody-ai[bot]' },
      body: '![kody code-review](x) ![medium](https://img.shields.io/badge/severity_level-medium-1A7BBE)\nMed',
      html_url: 'https://example/3',
      created_at: '2026-10-26T21:10:00Z',
    },
    {
      id: 4,
      user: { login: 'kody-ai[bot]' },
      body: criticalBody,
      created_at: '2026-10-26T20:00:00Z', // before HEAD
    },
    { id: 5, user: { login: 'evil-bot' }, body: criticalBody, created_at: '2026-10-26T21:10:00Z' },
  ],
  allowed,
  { headCommittedAt: headAt, dismissedIds: new Set(['3']) },
);
assert(issueFindings.some((f) => f.id === 2 && f.severity === 'Critical'), 'issue comment critical counted');
assert(!issueFindings.some((f) => f.id === 3), 'dismissed id skipped');
assert(!issueFindings.some((f) => f.id === 4), 'pre-HEAD card skipped');
assert(!issueFindings.some((f) => f.id === 5), 'spoofed bot ignored');
assert(!issueFindings.some((f) => f.id === 1), 'completed wrapper ignored');

assert(
  evaluateMergeGate({
    unresolvedFindings: [],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: false, reason: 'kodus-pending', detail: 'in_progress' },
  }).reason === 'kodus-pending',
  'push during review → pending blocks',
);

assert(
  evaluateMergeGate({
    unresolvedFindings: [],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: true, reason: 'kodus-complete' },
    apiError: new Error('GitHub API failed'),
  }).reason === 'api-error',
  'API error fail-closed',
);

console.log('PASS: kodus-merge-gate.self-test');
