/**
 * kodus-merge-gate — Kodus (kody-ai) review completion + finding helpers.
 * Location: scripts/kodus-merge-gate.mjs
 *
 * Evidence (PR #993, HEAD 80e3ccc2…):
 * - Check run name: "Kody Code Review", app slug: "kody-ai"
 * - Success output.title: "Code Review Complete"
 * - Issue comment: "## Code Review Completed!" + <!-- kody-codereview-completed-… -->
 * - Findings: review threads / issue comments with badge severity_level-{critical|high|medium|low}
 * - Bot logins: "kody-ai", "kody-ai[bot]"
 *
 * Never treat "Code Review Started" (or in-progress checks) as completion.
 */
export const KODY_CHECK_NAME = 'Kody Code Review';
export const KODY_APP_SLUG = 'kody-ai';
export const KODY_BOT_LOGINS = new Set(['kody-ai', 'kody-ai[bot]']);

/** Shields.io / Kodus badge: severity_level-critical|high|medium|low|info */
export const KODY_SEVERITY_RE =
  /badge\/severity_level-(critical|high|medium|low|info)|\bseverity[_ -]?level[_ -]?(critical|high|medium|low|info)\b/i;

export const KODY_FINDING_MARK_RE =
  /kody code-review|Kody Rules|kodus\.io|kody-ai/i;

export const KODY_DISMISS_MARKERS = [
  /<!--\s*ecc-finding-dismissed:\s*.+?\s*-->/i,
  /<!--\s*ecc-finding-resolved:\s*[0-9a-f]{7,40}\s*-->/i,
  /dismissed as (false positive|out of scope|wontfix)/i,
  /not applicable:\s+/i,
];

const SEVERITY_MAP = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export function isKodyBotLogin(login) {
  if (!login) return false;
  return KODY_BOT_LOGINS.has(String(login).toLowerCase());
}

export function mapKodySeverityToken(token) {
  if (!token) return null;
  return SEVERITY_MAP[String(token).toLowerCase()] ?? null;
}

/**
 * Parse Kodus severity from a comment body. Unknown kody finding formats return
 * `Critical` when `failClosedUnknown` is true (never silently ignore).
 */
export function kodyFindingSeverity(body, { failClosedUnknown = true } = {}) {
  const text = body ?? '';
  const m = text.match(KODY_SEVERITY_RE);
  if (m) {
    const mapped = mapKodySeverityToken(m[1] || m[2]);
    if (mapped) return mapped;
  }
  if (failClosedUnknown && KODY_FINDING_MARK_RE.test(text) && !/Code Review Completed/i.test(text)) {
    // Looks like a Kody finding card without a recognized severity badge.
    return 'Critical';
  }
  return null;
}

export function kodyBodiesIndicateDismissed(bodiesJoined) {
  return KODY_DISMISS_MARKERS.some((re) => re.test(bodiesJoined));
}

/**
 * Classify the Kody Code Review check-run for a commit.
 * @param {object|null} checkRun
 */
export function evaluateKodusCheckRun(checkRun) {
  if (!checkRun) {
    return { ok: false, reason: 'kodus-missing', detail: 'No Kody Code Review check-run on HEAD' };
  }
  const appSlug = checkRun.app?.slug ?? checkRun.app?.name ?? '';
  if (appSlug && String(appSlug).toLowerCase() !== KODY_APP_SLUG) {
    return {
      ok: false,
      reason: 'kodus-spoofed-app',
      detail: `Check app slug "${appSlug}" is not ${KODY_APP_SLUG}`,
    };
  }
  if (checkRun.name !== KODY_CHECK_NAME) {
    return {
      ok: false,
      reason: 'kodus-wrong-check',
      detail: `Unexpected check name "${checkRun.name}"`,
    };
  }
  const title = checkRun.output?.title ?? '';
  if (/started/i.test(title) && !/complete/i.test(title)) {
    return {
      ok: false,
      reason: 'kodus-started-only',
      detail: `Title "${title}" is not a completed review`,
    };
  }
  if (checkRun.status !== 'completed') {
    return {
      ok: false,
      reason: 'kodus-pending',
      detail: `status=${checkRun.status}`,
    };
  }
  if (checkRun.conclusion === 'cancelled') {
    return { ok: false, reason: 'kodus-cancelled', detail: 'Kody check cancelled' };
  }
  if (checkRun.conclusion !== 'success' && checkRun.conclusion !== 'neutral') {
    return {
      ok: false,
      reason: 'kodus-failed',
      detail: `conclusion=${checkRun.conclusion}`,
    };
  }
  if (!/complete/i.test(title) && !/success/i.test(checkRun.output?.summary ?? '')) {
    return {
      ok: false,
      reason: 'kodus-incomplete',
      detail: `Completed check lacks completion title/summary (title="${title}")`,
    };
  }
  return { ok: true, reason: 'kodus-complete', detail: title || 'Code Review Complete' };
}

/**
 * Pick the latest Kody Code Review check-run from a check-runs list.
 */
export function selectKodusCheckRun(checkRuns) {
  const list = Array.isArray(checkRuns) ? checkRuns : checkRuns?.check_runs ?? [];
  let best = null;
  for (const run of list) {
    if (run.name !== KODY_CHECK_NAME) continue;
    if (!best) {
      best = run;
      continue;
    }
    const a = new Date(run.completed_at || run.started_at || 0).getTime();
    const b = new Date(best.completed_at || best.started_at || 0).getTime();
    if (a >= b) best = run;
  }
  return best;
}

/**
 * Issue-comment findings from kody-ai[bot] (non-thread cards).
 * Skips start-review / completed wrapper comments.
 */
export function collectKodusIssueCommentFindings(comments, allowedSeverities) {
  const allowed = new Set(allowedSeverities.map((s) => s.toUpperCase()));
  const list = Array.isArray(comments) ? comments : [];
  const byId = new Map();
  for (const c of list) {
    if (c.in_reply_to_id) continue;
    const login = c.user?.login ?? c.author?.login;
    if (!isKodyBotLogin(login)) continue;
    const body = c.body ?? '';
    if (/^@kody\s+start-review/i.test(body.trim())) continue;
    if (/##\s*Code Review Completed/i.test(body)) continue;
    if (/<!--\s*kody-codereview-completed-/i.test(body) && !KODY_SEVERITY_RE.test(body)) continue;
    const sev = kodyFindingSeverity(body, { failClosedUnknown: true });
    if (!sev) continue;
    if (!allowed.has(sev.toUpperCase())) continue;
    const replies = list.filter((r) => r.in_reply_to_id === c.id);
    const joined = [body, ...replies.map((r) => r.body ?? '')].join('\n');
    if (kodyBodiesIndicateDismissed(joined)) continue;
    byId.set(String(c.id), {
      id: c.id,
      path: '(issue-comment)',
      severity: sev,
      user: login,
      url: c.html_url ?? c.url,
      commit: c.commit_id ?? null,
      source: 'kodus-issue-comment',
    });
  }
  return [...byId.values()];
}
