/**
 * kodus-merge-gate — Kodus (kody-ai) review completion + finding helpers.
 * Location: scripts/kodus-merge-gate.mjs
 *
 * Evidence (PR #993): check-run "Kody Code Review" / app kody-ai /
 * title "Code Review Complete"; findings via threads + issue comments.
 *
 * Never treat "Code Review Started" (or in-progress / neutral) as completion.
 */
export const KODY_CHECK_NAME = 'Kody Code Review';
export const KODY_APP_SLUG = 'kody-ai';
export const KODY_BOT_LOGINS = new Set(['kody-ai', 'kody-ai[bot]']);

/** Shields.io / Kodus badge: severity_level-critical|high|medium|low|info */
export const KODY_SEVERITY_RE =
  /badge\/severity_level-(critical|high|medium|low|info)|\bseverity[_ -]?level[_ -]?(critical|high|medium|low|info)\b/i;

export const KODY_FINDING_MARK_RE =
  /kody code-review|Kody Rules|kodus\.io|kody-ai/i;

/** Explicit HTML dismissal only — free-text phrases are not trusted. */
export const KODY_DISMISS_MARKERS = [
  /<!--\s*ecc-finding-dismissed(?:\s+id[=:]?\s*(\d+))?\s*:\s*.+?\s*-->/i,
  /<!--\s*ecc-finding-resolved:\s*[0-9a-f]{7,40}\s*-->/i,
];

const SEVERITY_MAP = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function isKodyBotLogin(login) {
  if (!login) return false;
  return KODY_BOT_LOGINS.has(String(login).toLowerCase());
}

export function mapKodySeverityToken(token) {
  if (!token) return null;
  return SEVERITY_MAP[String(token).toLowerCase()] ?? null;
}

export function kodyFindingSeverity(body, { failClosedUnknown = true } = {}) {
  const text = body ?? '';
  const m = text.match(KODY_SEVERITY_RE);
  if (m) {
    const mapped = mapKodySeverityToken(m[1] || m[2]);
    if (mapped) return mapped;
  }
  if (failClosedUnknown && KODY_FINDING_MARK_RE.test(text) && !/Code Review Completed/i.test(text)) {
    return 'Critical';
  }
  return null;
}

export function extractDismissedFindingIds(body) {
  const text = body ?? '';
  const ids = new Set();
  const re =
    /<!--\s*ecc-finding-dismissed(?:\s+id[=:]?\s*(\d+))?\s*:\s*.+?\s*-->/gi;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) ids.add(String(m[1]));
  }
  // Also allow `#issuecomment-123` / full URL references beside a dismiss marker.
  if (/<!--\s*ecc-finding-dismissed/i.test(text)) {
    for (const ref of text.matchAll(/issuecomment-(\d+)/gi)) {
      ids.add(String(ref[1]));
    }
  }
  return ids;
}

export function isTrustedDismissAuthor(comment) {
  const assoc = String(comment.author_association ?? comment.authorAssociation ?? '').toUpperCase();
  if (TRUSTED_ASSOCIATIONS.has(assoc)) return true;
  // GraphQL often omits association on nested nodes — allow OWNER login match via flag.
  return comment.trustedDismiss === true;
}

/**
 * Build the set of issue-comment finding IDs dismissed by trusted authors.
 * Issue comments are flat (no in_reply_to_id) — correlate via explicit id=/URL.
 */
export function collectDismissedIssueCommentIds(comments) {
  const dismissed = new Set();
  const list = Array.isArray(comments) ? comments : [];
  for (const c of list) {
    if (!isTrustedDismissAuthor(c)) continue;
    const body = c.body ?? '';
    if (!/<!--\s*ecc-finding-(dismissed|resolved)/i.test(body)) continue;
    for (const id of extractDismissedFindingIds(body)) dismissed.add(id);
    // Marker without id dismisses nothing by itself (fail-closed for correlation).
  }
  return dismissed;
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
  if (checkRun.name !== KODY_CHECK_NAME) {
    return {
      ok: false,
      reason: 'kodus-wrong-check',
      detail: `Unexpected check name "${checkRun.name}"`,
    };
  }
  const appSlug = checkRun.app?.slug ?? checkRun.app?.name ?? '';
  if (!appSlug || String(appSlug).toLowerCase() !== KODY_APP_SLUG) {
    return {
      ok: false,
      reason: 'kodus-spoofed-app',
      detail: `Check app slug "${appSlug || '(missing)'}" is not ${KODY_APP_SLUG}`,
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
  // Only success counts — neutral/skipped/failure are fail-closed.
  if (checkRun.conclusion !== 'success') {
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

const HARD_FAIL_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'cancelled',
]);
const SOFT_NON_SUCCESS_CONCLUSIONS = new Set(['skipped', 'neutral']);

function checkRunTime(run) {
  return new Date(run.completed_at || run.started_at || 0).getTime();
}

function reviewOnHead(review, head) {
  const commit = String(review.commit_id ?? review.commitId ?? '').toLowerCase();
  if (!commit || !head) return false;
  return commit === head || head.startsWith(commit) || commit.startsWith(head);
}

function mostRecentCheckRun(runs) {
  let best = null;
  for (const run of runs) {
    if (!best || checkRunTime(run) >= checkRunTime(best)) best = run;
  }
  return best;
}

/**
 * Pick the authoritative Kody check-run for a HEAD.
 * In-progress always wins (fail-closed pending). Among completed runs, a later
 * `skipped`/`neutral` must not wipe an earlier `success` Complete on the same SHA
 * (Kody often re-posts Skipped after `@kody start-review` when the diff was already
 * reviewed). A later hard `failure` still wins over an older success.
 */
export function selectKodusCheckRun(checkRuns) {
  const raw = Array.isArray(checkRuns) ? checkRuns : checkRuns?.check_runs ?? [];
  const list = raw.filter((run) => run?.name === KODY_CHECK_NAME);
  if (list.length === 0) return null;

  const pending = list.filter((run) => run.status !== 'completed');
  if (pending.length > 0) return mostRecentCheckRun(pending);

  const successes = list.filter((run) => run.conclusion === 'success');
  const hardFails = list.filter((run) => HARD_FAIL_CONCLUSIONS.has(String(run.conclusion)));

  if (hardFails.length > 0) {
    const latestFail = mostRecentCheckRun(hardFails);
    const latestSuccess = successes.length > 0 ? mostRecentCheckRun(successes) : null;
    if (latestSuccess && checkRunTime(latestSuccess) > checkRunTime(latestFail)) {
      return latestSuccess;
    }
    return latestFail;
  }

  if (successes.length > 0) return mostRecentCheckRun(successes);
  return mostRecentCheckRun(list);
}

/**
 * When GitHub overwrites the Kody check-run in place (Complete → Skipped on the
 * same SHA after a re-request), recover completion from a Kody PR review on HEAD.
 * Only `APPROVED` counts — `COMMENTED` alone is not a completed review signal.
 * @param {object[]} reviews
 * @param {string} headSha
 */
export function findKodusApprovedReviewForHead(reviews, headSha) {
  const list = Array.isArray(reviews) ? reviews : [];
  const head = String(headSha || '').toLowerCase();
  if (!head) return null;

  const kodyOnHead = list.filter((r) => {
    const login = r.user?.login ?? r.author?.login ?? '';
    if (!isKodyBotLogin(login)) return false;
    // Require string commit_id / submitted_at — reject malformed payloads fail-closed.
    if (typeof (r.commit_id ?? r.commitId) !== 'string') return false;
    if (r.submitted_at != null && typeof r.submitted_at !== 'string') return false;
    return reviewOnHead(r, head);
  });

  const approved = kodyOnHead
    .filter((r) => String(r.state).toUpperCase() === 'APPROVED')
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
  if (!approved) return null;

  // A later non-APPROVED Kody review on the same HEAD revokes the approval (fail-closed).
  const approvedAt = new Date(approved.submitted_at || 0).getTime();
  const laterNonApproved = kodyOnHead.some(
    (r) =>
      String(r.state).toUpperCase() !== 'APPROVED' &&
      new Date(r.submitted_at || 0).getTime() > approvedAt,
  );
  return laterNonApproved ? null : approved;
}

/**
 * Combine check-run + optional APPROVED review when the check was overwritten to skipped.
 * @param {object|null} checkRun
 * @param {{ reviews?: object[], headSha?: string }} [opts]
 */
export function evaluateKodusHeadEvidence(checkRun, { reviews = [], headSha = '' } = {}) {
  const fromCheck = evaluateKodusCheckRun(checkRun);
  if (fromCheck.ok) return fromCheck;
  if (fromCheck.reason === 'kodus-pending' || fromCheck.reason === 'kodus-started-only') {
    return fromCheck;
  }
  // Overwritten check-run: Skipped/neutral after a real Complete on the same SHA.
  if (
    checkRun &&
    checkRun.status === 'completed' &&
    SOFT_NON_SUCCESS_CONCLUSIONS.has(String(checkRun.conclusion))
  ) {
    const approved = findKodusApprovedReviewForHead(reviews, headSha);
    if (approved) {
      return {
        ok: true,
        reason: 'kodus-complete',
        detail: `Kody APPROVED review on HEAD (check-run was ${checkRun.conclusion}; id=${approved.id})`,
      };
    }
  }
  return fromCheck;
}

/**
 * Issue-comment findings from kody-ai[bot] (non-thread cards).
 * @param {object[]} comments
 * @param {string[]} allowedSeverities
 * @param {{ headCommittedAt?: string|null, dismissedIds?: Set<string> }} [opts]
 */
export function collectKodusIssueCommentFindings(
  comments,
  allowedSeverities,
  { headCommittedAt = null, dismissedIds = new Set() } = {},
) {
  const allowed = new Set(allowedSeverities.map((s) => s.toUpperCase()));
  const list = Array.isArray(comments) ? comments : [];
  const headMs = headCommittedAt ? Date.parse(headCommittedAt) : NaN;
  const byId = new Map();

  for (const c of list) {
    const login = c.user?.login ?? c.author?.login;
    if (!isKodyBotLogin(login)) continue;
    const body = c.body ?? '';
    if (/^@kody\s+start-review/i.test(body.trim())) continue;
    if (/##\s*Code Review Completed/i.test(body)) continue;
    if (/<!--\s*kody-codereview-completed-/i.test(body) && !KODY_SEVERITY_RE.test(body)) continue;

    // Scope to current HEAD: ignore cards posted before this commit existed.
    if (!Number.isNaN(headMs)) {
      const createdMs = Date.parse(c.created_at ?? c.createdAt ?? '');
      if (!Number.isNaN(createdMs) && createdMs < headMs) continue;
    }

    const sev = kodyFindingSeverity(body, { failClosedUnknown: true });
    if (!sev) continue;
    if (!allowed.has(sev.toUpperCase())) continue;
    if (dismissedIds.has(String(c.id))) continue;

    byId.set(String(c.id), {
      id: c.id,
      path: '(issue-comment)',
      severity: sev,
      user: login,
      url: c.html_url ?? c.url,
      commit: null,
      source: 'kodus-issue-comment',
    });
  }
  return [...byId.values()];
}
