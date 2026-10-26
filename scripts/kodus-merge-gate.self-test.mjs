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
  collectKodusIssueCommentFindings,
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
assert(!isKodyBotLogin('chatgpt-codex-connector'), 'codex is not kody');

const criticalBody =
  '![kody code-review](https://img.shields.io/badge/kody-code--review-312B4B?labelColor=C9BBF2) ![Bug](https://img.shields.io/badge/Bug-B71C1C) ![critical](https://img.shields.io/badge/severity_level-critical-FF3D3D)\n\n**Invalid layers**';
assert(KODY_SEVERITY_RE.test(criticalBody), 'kody severity regex');
assert(kodyFindingSeverity(criticalBody) === 'Critical', 'critical mapping');
assert(
  kodyFindingSeverity(
    '![kody code-review](x) ![high](https://img.shields.io/badge/severity_level-high-6B6B92)\nHi',
  ) === 'High',
  'high mapping',
);
assert(
  kodyFindingSeverity(
    '![kody code-review](x) ![medium](https://img.shields.io/badge/severity_level-medium-1A7BBE)\nMed',
  ) === 'Medium',
  'medium mapping',
);

const allowed = ['P1', 'P2', 'Critical', 'Important', 'High', 'Medium', 'Low', 'Info'];
assert(
  findingSeverity(criticalBody, allowed, { authorLogin: 'kody-ai' }) === 'Critical',
  'findingSeverity integrates kody',
);

// Missing review
assert(
  evaluateKodusCheckRun(null).reason === 'kodus-missing',
  'missing kody check fails',
);

// Pending / started-only
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
    app: { slug: 'kody-ai' },
    status: 'in_progress',
    conclusion: null,
    output: { title: 'Code Review Started' },
  }).ok === false,
  'Started+in_progress never PASS',
);

// Spoofed app
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

// Failed conclusion
assert(
  evaluateKodusCheckRun({
    name: KODY_CHECK_NAME,
    app: { slug: 'kody-ai' },
    status: 'completed',
    conclusion: 'failure',
    output: { title: 'Code Review Complete' },
  }).reason === 'kodus-failed',
  'failed conclusion',
);

// Success complete (positive)
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

// Stale / other SHA is handled by callers fetching check-runs for HEAD only
assert(selectKodusCheckRun([okRun, { name: 'Test Gate' }])?.name === KODY_CHECK_NAME, 'select kody');

// Gate: kody missing blocks even with clean findings
const failMissing = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  pendingReviewsForHead: [],
  kodusReview: { ok: false, reason: 'kodus-missing', detail: 'missing' },
});
assert(failMissing.ok === false && failMissing.reason === 'kodus-missing', 'gate blocks missing kody');

// Gate: kody complete + open critical finding blocks
const failFinding = evaluateMergeGate({
  unresolvedFindings: [{ severity: 'Critical', path: 'x.ts', user: 'kody-ai' }],
  checkFailures: [],
  pendingReviewsForHead: [],
  kodusReview: { ok: true, reason: 'kodus-complete' },
});
assert(failFinding.ok === false && failFinding.reason === 'unresolved-findings', 'open kody finding blocks');

// Gate: kody complete + findings cleared → PASS
const passAll = evaluateMergeGate({
  unresolvedFindings: [],
  checkFailures: [],
  pendingReviewsForHead: [],
  kodusReview: { ok: true, reason: 'kodus-complete' },
});
assert(passAll.ok === true, 'kody complete + clean findings PASS');

// Late finding after prior green
const late = evaluateMergeGate({
  unresolvedFindings: [{ severity: 'High', path: 'y.ts' }],
  checkFailures: [],
  pendingReviewsForHead: [],
  kodusReview: { ok: true, reason: 'kodus-complete' },
});
assert(late.ok === false, 'late high finding invalidates prior green');

// Dismissed finding
assert(
  kodyBodiesIndicateDismissed('<!-- ecc-finding-dismissed: false-positive barrel import -->'),
  'dismiss marker',
);

const issueFindings = collectKodusIssueCommentFindings(
  [
    {
      id: 1,
      user: { login: 'kody-ai[bot]' },
      body: '## Code Review Completed!\n<!-- kody-codereview-completed-1 -->',
    },
    {
      id: 2,
      user: { login: 'kody-ai[bot]' },
      body: criticalBody,
      html_url: 'https://example/2',
    },
    {
      id: 3,
      user: { login: 'kody-ai[bot]' },
      body: '![kody code-review](x) ![medium](https://img.shields.io/badge/severity_level-medium-1A7BBE)\nMed',
      html_url: 'https://example/3',
    },
    {
      id: 4,
      in_reply_to_id: 3,
      user: { login: 'iamthamanic' },
      body: '<!-- ecc-finding-dismissed: style-only / out of scope for isolated-contract -->',
    },
    { id: 5, user: { login: 'evil-bot' }, body: criticalBody },
  ],
  allowed,
);
assert(issueFindings.some((f) => f.id === 2 && f.severity === 'Critical'), 'issue comment critical counted');
assert(!issueFindings.some((f) => f.id === 3), 'dismissed medium skipped');
assert(!issueFindings.some((f) => f.id === 5), 'spoofed bot ignored');
assert(!issueFindings.some((f) => f.id === 1), 'completed wrapper ignored');

// New push while review pending
assert(
  evaluateMergeGate({
    unresolvedFindings: [],
    checkFailures: [],
    pendingReviewsForHead: [],
    kodusReview: { ok: false, reason: 'kodus-pending', detail: 'in_progress' },
  }).reason === 'kodus-pending',
  'push during review → pending blocks',
);

// API error still fail-closed (kodus not consulted)
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
