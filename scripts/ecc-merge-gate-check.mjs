#!/usr/bin/env node
/**
 * ecc-merge-gate-check — machine gate: block merge when unresolved P1/P2
 * (or Critical/Important) review findings remain on the PR tip.
 * Location: scripts/ecc-merge-gate-check.mjs
 *
 * Also verifies required GitHub check conclusions for the PR head SHA.
 * Used by `.github/workflows/ecc-merge-gate.yml` and local `@pr-merge-safe`.
 *
 * Fail-closed (#937): late review findings on an unchanged HEAD must invalidate
 * a prior green run; GraphQL review-thread resolution is authoritative; API
 * errors or unclear review state → FAIL (never PASS).
 *
 * Exit 0 = PASS, exit 1 = FAIL (must not merge).
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SEVERITY_RE =
  /!\[[^\]]*\]\([^)]*badge\/(P1|P2|Critical|Important)[^)]*\)|\b(P1|P2)\b.*(?:Badge|finding)|Severity:\s*(P1|P2|Critical|Important)/i;

export const RESOLVED_MARKERS = [
  /fixed in\s+`?[0-9a-f]{7,40}`?/i,
  /resolved by\s+`?[0-9a-f]{7,40}`?/i,
  /addressed in\s+(?:commit\s+)?`?[0-9a-f]{7,40}`?/i,
  /<!--\s*ecc-finding-resolved:\s*[0-9a-f]{7,40}\s*-->/i,
];

export function loadMergeGateConfig(configRoot = root) {
  const path = join(configRoot, '.qa/merge-gate.yaml');
  if (!existsSync(path)) {
    return {
      requiredChecks: ['Test Gate', 'Composition Gate', 'ECC Merge Gate'],
      blockOnUnresolvedReviewSeverities: ['P1', 'P2', 'Critical', 'Important'],
    };
  }
  const text = readFileSync(path, 'utf8');
  const requiredChecks = [];
  const severities = [];
  let inChecks = false;
  let inSev = false;
  for (const line of text.split('\n')) {
    if (/^requiredChecks:\s*$/.test(line)) {
      inChecks = true;
      inSev = false;
      continue;
    }
    if (/^blockOnUnresolvedReviewSeverities:\s*$/.test(line)) {
      inSev = true;
      inChecks = false;
      continue;
    }
    if (/^[a-zA-Z]/.test(line)) {
      inChecks = false;
      inSev = false;
    }
    const item = line.match(/^\s+-\s+(.+)\s*$/);
    if (item && inChecks) requiredChecks.push(item[1].replace(/^["']|["']$/g, ''));
    if (item && inSev) severities.push(item[1].replace(/^["']|["']$/g, ''));
  }
  return {
    requiredChecks:
      requiredChecks.length > 0
        ? requiredChecks
        : ['Test Gate', 'Composition Gate', 'ECC Merge Gate'],
    blockOnUnresolvedReviewSeverities:
      severities.length > 0 ? severities : ['P1', 'P2', 'Critical', 'Important'],
  };
}

/**
 * Parse `gh api` JSON. When `--paginate` is used without `--slurp`, gh emits
 * one JSON document per page; concatenate via `--slurp` automatically.
 */
export function ghJson(args, { cwd = root } = {}) {
  const finalArgs = [...args];
  if (finalArgs.includes('--paginate') && !finalArgs.includes('--slurp')) {
    finalArgs.push('--slurp');
  }
  try {
    const out = execFileSync('gh', finalArgs, {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out);
    // --slurp wraps each page in an array; flatten common list shapes.
    if (Array.isArray(parsed) && finalArgs.includes('--slurp')) {
      if (parsed.every((page) => Array.isArray(page))) {
        return parsed.flat();
      }
      // check-runs style: [{ check_runs: [...] }, ...]
      if (parsed.every((page) => page && typeof page === 'object' && Array.isArray(page.check_runs))) {
        return { check_runs: parsed.flatMap((page) => page.check_runs) };
      }
    }
    return parsed;
  } catch (err) {
    const stderr = err?.stderr?.toString?.() ?? err?.message ?? String(err);
    const error = new Error(`GitHub API failed (fail-closed): ${stderr}`);
    error.cause = err;
    throw error;
  }
}

export function findingSeverity(body, allowed) {
  const m = body.match(SEVERITY_RE);
  if (!m) return null;
  const sev = (m[1] || m[2] || m[3] || '').toUpperCase();
  const normalized = sev === 'CRITICAL' ? 'Critical' : sev === 'IMPORTANT' ? 'Important' : sev;
  if (!allowed.map((s) => s.toUpperCase()).includes(normalized.toUpperCase())) return null;
  return normalized;
}

export function bodiesIndicateResolved(bodiesJoined) {
  return RESOLVED_MARKERS.some((re) => re.test(bodiesJoined));
}

/**
 * Pure decision used by CI and by the #934/#935 regression self-test:
 * a prior green gate on HEAD H is insufficient once an unresolved blocking
 * finding exists for that same HEAD (or any finding without commit if HEAD-bound
 * resolution is unknown — fail-closed).
 */
export function evaluateMergeGate({
  unresolvedFindings,
  checkFailures,
  apiError = null,
  pendingReviewsForHead = [],
}) {
  if (apiError) {
    return {
      ok: false,
      reason: 'api-error',
      detail: String(apiError.message ?? apiError),
    };
  }
  if (pendingReviewsForHead.length > 0) {
    return {
      ok: false,
      reason: 'pending-review',
      detail: `Pending reviews for current HEAD: ${pendingReviewsForHead.length}`,
    };
  }
  if (unresolvedFindings.length > 0) {
    return {
      ok: false,
      reason: 'unresolved-findings',
      detail: `${unresolvedFindings.length} unresolved blocking finding(s)`,
    };
  }
  if (checkFailures.length > 0) {
    return {
      ok: false,
      reason: 'required-checks',
      detail: `${checkFailures.length} required check failure(s)`,
    };
  }
  return { ok: true, reason: 'pass', detail: 'ECC Merge Gate PASS' };
}

/**
 * Simulate #934/#935: gate was green, then P1/P2 lands on the same HEAD → must FAIL.
 */
export function lateFindingInvalidatesPriorPass({ headSha, findingCommitSha, severity }) {
  const sameHead =
    !findingCommitSha ||
    String(findingCommitSha).toLowerCase() === String(headSha).toLowerCase() ||
    String(headSha).toLowerCase().startsWith(String(findingCommitSha).toLowerCase()) ||
    String(findingCommitSha).toLowerCase().startsWith(String(headSha).toLowerCase().slice(0, 7));
  if (!sameHead) return { blocks: false, reason: 'finding-on-other-sha' };
  const allowed = ['P1', 'P2', 'Critical', 'Important'];
  if (!allowed.map((s) => s.toUpperCase()).includes(String(severity).toUpperCase())) {
    return { blocks: false, reason: 'non-blocking-severity' };
  }
  return { blocks: true, reason: 'late-blocking-finding-on-same-head' };
}

export function isResolvedThread(comment, replies) {
  const bodies = [comment.body, ...replies.map((r) => r.body)].join('\n');
  if (bodiesIndicateResolved(bodies)) return true;
  if (comment.isResolved === true || comment.resolved === true) return true;
  return false;
}

/**
 * Authoritative path: GraphQL reviewThreads.isResolved + comment bodies.
 * Fail-closed callers must catch thrown API errors.
 */
export function collectUnresolvedFindingsFromGraphql(owner, repo, pullNumber, allowedSeverities) {
  const query = `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 30) {
                nodes {
                  databaseId
                  body
                  path
                  url
                  author { login }
                  commit { oid }
                }
              }
            }
          }
        }
      }
    }
  `;
  const payload = ghJson([
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${repo}`,
    '-F',
    `number=${pullNumber}`,
  ]);
  if (payload.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  const pr = payload.data?.repository?.pullRequest;
  if (!pr) {
    throw new Error('GraphQL returned no pullRequest (fail-closed)');
  }
  const threads = pr.reviewThreads?.nodes ?? [];
  const unresolved = [];
  /** Comment database IDs that GraphQL already classified (resolved or not). */
  const graphqlThreadCommentIds = new Set();
  for (const thread of threads) {
    const comments = thread.comments?.nodes ?? [];
    if (!comments.length) continue;
    for (const c of comments) {
      if (c.databaseId != null) graphqlThreadCommentIds.add(String(c.databaseId));
    }
    const root = comments[0];
    const sev = findingSeverity(root.body ?? '', allowedSeverities);
    if (!sev) continue;
    const bodies = comments.map((c) => c.body ?? '').join('\n');
    if (thread.isResolved === true || bodiesIndicateResolved(bodies)) continue;
    unresolved.push({
      id: root.databaseId,
      path: root.path,
      severity: sev,
      user: root.author?.login,
      url: root.url,
      commit: root.commit?.oid,
      source: 'graphql-review-thread',
    });
  }
  return { unresolved, graphqlThreadCommentIds };
}

/**
 * REST fallback for inline comments that are NOT part of any GraphQL review
 * thread. GraphQL isResolved is authoritative — never re-add a thread that
 * GraphQL already resolved just because REST lacks resolution state (#937 P1).
 */
export function collectUnresolvedFindingsFromRest(
  owner,
  repo,
  pullNumber,
  allowedSeverities,
  { skipCommentIds = new Set() } = {},
) {
  const comments = ghJson([
    'api',
    `repos/${owner}/${repo}/pulls/${pullNumber}/comments`,
    '--paginate',
  ]);
  const repliesByParent = new Map();
  for (const c of comments) {
    if (c.in_reply_to_id) {
      const list = repliesByParent.get(c.in_reply_to_id) ?? [];
      list.push(c);
      repliesByParent.set(c.in_reply_to_id, list);
    }
  }

  const unresolved = [];
  for (const c of comments) {
    if (c.in_reply_to_id) continue;
    if (skipCommentIds.has(String(c.id))) continue;
    const sev = findingSeverity(c.body ?? '', allowedSeverities);
    if (!sev) continue;
    const replies = repliesByParent.get(c.id) ?? [];
    if (isResolvedThread(c, replies)) continue;
    unresolved.push({
      id: c.id,
      path: c.path,
      severity: sev,
      user: c.user?.login,
      url: c.html_url,
      commit: c.commit_id,
      source: 'rest-inline-comment',
    });
  }
  return unresolved;
}

/**
 * Merge GraphQL findings with REST-only comments. GraphQL thread membership
 * (including resolved threads) suppresses REST re-introduction of the same id.
 */
export function mergeGraphqlAndRestFindings(fromGql, fromRest) {
  const byId = new Map();
  for (const f of [...fromGql, ...fromRest]) {
    const key = String(f.id ?? `${f.path}:${f.url}`);
    if (!byId.has(key)) byId.set(key, f);
  }
  return [...byId.values()];
}

/**
 * Union GraphQL (authoritative resolution) + REST (non-thread comments only).
 * Any API throw propagates (fail-closed).
 */
export function collectUnresolvedFindings(owner, repo, pullNumber, allowedSeverities) {
  const { unresolved: fromGql, graphqlThreadCommentIds } = collectUnresolvedFindingsFromGraphql(
    owner,
    repo,
    pullNumber,
    allowedSeverities,
  );
  const fromRest = collectUnresolvedFindingsFromRest(owner, repo, pullNumber, allowedSeverities, {
    skipCommentIds: graphqlThreadCommentIds,
  });
  return mergeGraphqlAndRestFindings(fromGql, fromRest);
}

export function collectPendingReviewsForHead(owner, repo, pullNumber, headSha) {
  const reviews = ghJson([
    'api',
    `repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
    '--paginate',
  ]);
  const list = Array.isArray(reviews) ? reviews : [];
  return list.filter((r) => {
    if (String(r.state).toUpperCase() !== 'PENDING') return false;
    const commitId = r.commit_id ?? r.commit?.sha;
    if (!commitId) return true; // unknown commit → fail-closed treat as pending for head
    return (
      String(commitId).toLowerCase() === String(headSha).toLowerCase() ||
      String(headSha).toLowerCase().startsWith(String(commitId).toLowerCase().slice(0, 7))
    );
  });
}

export function classifyRequiredChecks(owner, repo, headSha, requiredChecks) {
  const runs = ghJson([
    'api',
    `repos/${owner}/${repo}/commits/${headSha}/check-runs`,
    '--paginate',
  ]);
  const byName = new Map();
  const list = Array.isArray(runs) ? runs : runs.check_runs ?? [];
  for (const run of list) {
    const prev = byName.get(run.name);
    if (!prev || new Date(run.completed_at || 0) > new Date(prev.completed_at || 0)) {
      byName.set(run.name, run);
    }
  }
  const failures = [];
  const pending = [];
  for (const name of requiredChecks) {
    if (name === 'ECC Merge Gate') continue; // this job — avoid self-deadlock
    const run = byName.get(name);
    if (!run) {
      pending.push({ name, reason: 'missing' });
      continue;
    }
    if (run.status !== 'completed') {
      pending.push({ name, reason: `status=${run.status}` });
      continue;
    }
    if (run.conclusion !== 'success' && run.conclusion !== 'skipped' && run.conclusion !== 'neutral') {
      failures.push({ name, reason: `conclusion=${run.conclusion}` });
    }
  }
  return { failures, pending };
}

/** @deprecated Prefer classifyRequiredChecks + waitForRequiredChecks */
export function collectCheckFailures(owner, repo, headSha, requiredChecks) {
  const { failures, pending } = classifyRequiredChecks(owner, repo, headSha, requiredChecks);
  return [...failures, ...pending];
}

/**
 * Wait for sibling required checks to settle. Early workflow_run events must not
 * leave a sticky FAIL while Test Gate / Composition Gate / Browser E2E are still
 * queued — that FAIL would become the latest required check and block merges.
 */
export function waitForRequiredChecks(
  owner,
  repo,
  headSha,
  requiredChecks,
  {
    timeoutMs = Number(process.env.ECC_MERGE_GATE_CHECK_WAIT_MS || 480_000),
    intervalMs = Number(process.env.ECC_MERGE_GATE_CHECK_POLL_MS || 20_000),
    sleep = (ms) => {
      try {
        execFileSync('sleep', [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: 'ignore' });
      } catch {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      }
    },
    log = (msg) => console.error(msg),
  } = {},
) {
  const started = Date.now();
  let last = classifyRequiredChecks(owner, repo, headSha, requiredChecks);
  while (last.pending.length > 0 && last.failures.length === 0 && Date.now() - started < timeoutMs) {
    log(
      `ECC Merge Gate: waiting for ${last.pending.length} required check(s): ${last.pending
        .map((p) => `${p.name} (${p.reason})`)
        .join(', ')}`,
    );
    sleep(intervalMs);
    last = classifyRequiredChecks(owner, repo, headSha, requiredChecks);
  }
  return [...last.failures, ...last.pending];
}

export function resolvePrContext() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    // pull_request | pull_request_review | pull_request_review_comment all expose pull_request
    const pr = event.pull_request ?? null;
    if (pr?.number && pr.head?.sha) {
      return {
        owner: event.repository.owner.login,
        repo: event.repository.name,
        pullNumber: pr.number,
        headSha: pr.head.sha,
      };
    }
  }
  const prNumber = process.env.ECC_MERGE_GATE_PR || process.argv[2];
  if (!prNumber) {
    console.error('FAIL: provide PR number (arg or ECC_MERGE_GATE_PR) outside Actions PR events');
    process.exit(1);
  }
  const meta = ghJson(['pr', 'view', String(prNumber), '--json', 'number,headRefOid,url']);
  const repo = ghJson(['repo', 'view', '--json', 'nameWithOwner']);
  const [owner, name] = repo.nameWithOwner.split('/');
  return {
    owner,
    repo: name,
    pullNumber: meta.number,
    headSha: meta.headRefOid,
  };
}

export function runMergeGateCheck({
  ctx,
  config,
  skipChecks = process.env.ECC_MERGE_GATE_SKIP_CHECKS === '1',
} = {}) {
  let apiError = null;
  let unresolved = [];
  let pendingReviewsForHead = [];
  let checkFailures = [];

  try {
    unresolved = collectUnresolvedFindings(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      config.blockOnUnresolvedReviewSeverities,
    );
    pendingReviewsForHead = collectPendingReviewsForHead(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      ctx.headSha,
    );
    if (!skipChecks) {
      // Findings first: if already blocked, do not wait on sibling checks.
      const early = evaluateMergeGate({
        unresolvedFindings: unresolved,
        checkFailures: [],
        apiError: null,
        pendingReviewsForHead,
      });
      if (early.ok) {
        checkFailures = waitForRequiredChecks(
          ctx.owner,
          ctx.repo,
          ctx.headSha,
          config.requiredChecks,
        );
      }
    }
  } catch (err) {
    apiError = err;
  }

  const decision = evaluateMergeGate({
    unresolvedFindings: unresolved,
    checkFailures,
    apiError,
    pendingReviewsForHead,
  });

  const lines = [
    '## ECC Merge Gate',
    `- PR: #${ctx.pullNumber}`,
    `- HEAD: ${ctx.headSha}`,
    `- Unresolved P1/P2 findings: ${apiError ? 'unknown (API error)' : unresolved.length}`,
    `- Pending reviews for HEAD: ${apiError ? 'unknown' : pendingReviewsForHead.length}`,
    `- Required check failures: ${apiError ? 'unknown' : checkFailures.length}`,
    `- Decision: ${decision.reason}${decision.detail ? ` — ${decision.detail}` : ''}`,
  ];

  if (unresolved.length > 0) {
    lines.push('', '### Unresolved findings');
    for (const f of unresolved) {
      lines.push(`- **${f.severity}** ${f.path} (${f.user}) ${f.url}`);
    }
  }
  if (pendingReviewsForHead.length > 0) {
    lines.push('', '### Pending reviews (current HEAD)');
    for (const r of pendingReviewsForHead) {
      lines.push(`- ${r.user?.login ?? r.author?.login ?? 'unknown'} state=${r.state} id=${r.id}`);
    }
  }
  if (checkFailures.length > 0) {
    lines.push('', '### Required check failures');
    for (const f of checkFailures) {
      lines.push(`- ${f.name}: ${f.reason}`);
    }
  }
  if (apiError) {
    lines.push('', '### API error (fail-closed)', `- ${apiError.message}`);
  }

  return { decision, lines, unresolved, checkFailures, pendingReviewsForHead, apiError };
}

const isMainModule =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const config = loadMergeGateConfig();
  let ctx;
  try {
    ctx = resolvePrContext();
  } catch (err) {
    console.error('ECC Merge Gate FAIL — do not merge');
    console.error(`Could not resolve PR context (fail-closed): ${err.message}`);
    process.exit(1);
  }

  const { decision, lines } = runMergeGateCheck({ ctx, config });
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }

  if (!decision.ok) {
    console.error('ECC Merge Gate FAIL — do not merge');
    process.exit(1);
  }

  console.log('ECC Merge Gate PASS');
  process.exit(0);
}
