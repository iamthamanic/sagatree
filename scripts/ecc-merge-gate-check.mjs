#!/usr/bin/env node
/**
 * ecc-merge-gate-check — machine gate: block merge when unresolved P1/P2
 * (or Critical/Important) review findings remain on the PR tip.
 * Location: scripts/ecc-merge-gate-check.mjs
 *
 * Also verifies required GitHub check conclusions for the PR head SHA.
 * Used by `.github/workflows/ecc-merge-gate.yml` and local `@pr-merge-safe`.
 *
 * Exit 0 = PASS, exit 1 = FAIL (must not merge).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEVERITY_RE =
  /!\[[^\]]*\]\([^)]*badge\/(P1|P2|Critical|Important)[^)]*\)|\b(P1|P2)\b.*(?:Badge|finding)|Severity:\s*(P1|P2|Critical|Important)/i;

const RESOLVED_MARKERS = [
  /fixed in\s+`?[0-9a-f]{7,40}`?/i,
  /resolved by\s+`?[0-9a-f]{7,40}`?/i,
  /addressed in\s+(?:commit\s+)?`?[0-9a-f]{7,40}`?/i,
  /<!--\s*ecc-finding-resolved:\s*[0-9a-f]{7,40}\s*-->/i,
];

function loadMergeGateConfig() {
  const path = join(root, '.qa/merge-gate.yaml');
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

function ghJson(args) {
  const out = execFileSync('gh', args, {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function isResolvedThread(comment, replies) {
  const bodies = [comment.body, ...replies.map((r) => r.body)].join('\n');
  if (RESOLVED_MARKERS.some((re) => re.test(bodies))) return true;
  // GitHub "resolved" conversation state when present on review threads API
  if (comment.isResolved === true || comment.resolved === true) return true;
  return false;
}

function findingSeverity(body, allowed) {
  const m = body.match(SEVERITY_RE);
  if (!m) return null;
  const sev = (m[1] || m[2] || m[3] || '').toUpperCase();
  const normalized = sev === 'CRITICAL' ? 'Critical' : sev === 'IMPORTANT' ? 'Important' : sev;
  if (!allowed.map((s) => s.toUpperCase()).includes(normalized.toUpperCase())) return null;
  return normalized;
}

function collectUnresolvedFindings(owner, repo, pullNumber, allowedSeverities) {
  const comments = ghJson([
    'api',
    `repos/${owner}/${repo}/pulls/${pullNumber}/comments`,
    '--paginate',
  ]);
  // Group replies by in_reply_to_id
  const byId = new Map(comments.map((c) => [c.id, c]));
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
    if (c.in_reply_to_id) continue; // only top-level findings
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
    });
  }
  return unresolved;
}

function collectCheckFailures(owner, repo, headSha, requiredChecks) {
  // Prefer combined status + check runs for the head SHA
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
  for (const name of requiredChecks) {
    if (name === 'ECC Merge Gate') continue; // this job — avoid self-deadlock
    const run = byName.get(name);
    if (!run) {
      failures.push({ name, reason: 'missing' });
      continue;
    }
    if (run.status !== 'completed') {
      failures.push({ name, reason: `status=${run.status}` });
      continue;
    }
    if (run.conclusion !== 'success' && run.conclusion !== 'skipped' && run.conclusion !== 'neutral') {
      failures.push({ name, reason: `conclusion=${run.conclusion}` });
    }
  }
  return failures;
}

function resolvePrContext() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const pr = event.pull_request;
    if (pr) {
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

const config = loadMergeGateConfig();
const ctx = resolvePrContext();

const unresolved = collectUnresolvedFindings(
  ctx.owner,
  ctx.repo,
  ctx.pullNumber,
  config.blockOnUnresolvedReviewSeverities,
);

let checkFailures = [];
if (process.env.ECC_MERGE_GATE_SKIP_CHECKS !== '1') {
  checkFailures = collectCheckFailures(
    ctx.owner,
    ctx.repo,
    ctx.headSha,
    config.requiredChecks,
  );
}

const lines = [
  '## ECC Merge Gate',
  `- PR: #${ctx.pullNumber}`,
  `- HEAD: ${ctx.headSha}`,
  `- Unresolved P1/P2 findings: ${unresolved.length}`,
  `- Required check failures: ${checkFailures.length}`,
];

if (unresolved.length > 0) {
  lines.push('', '### Unresolved findings');
  for (const f of unresolved) {
    lines.push(`- **${f.severity}** ${f.path} (${f.user}) ${f.url}`);
  }
}
if (checkFailures.length > 0) {
  lines.push('', '### Required check failures');
  for (const f of checkFailures) {
    lines.push(`- ${f.name}: ${f.reason}`);
  }
}

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

if (unresolved.length > 0 || checkFailures.length > 0) {
  console.error('ECC Merge Gate FAIL — do not merge');
  process.exit(1);
}

console.log('ECC Merge Gate PASS');
process.exit(0);
