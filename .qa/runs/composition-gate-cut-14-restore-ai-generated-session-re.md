# Composition Gate — cut-14-restore-ai-generated-session-re (#1149)

- HEAD_SHA: 4b6db58a5ba7468aa454b51d906fe1582b67a019
- BASE_SHA: 0e211f0e99124a02f758513ce4ae362bf4d9e82e
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-14 activates existing session-recap generate host ports)

## Event

Under host-first, EpisodeSummary / useEpisodeSummary calls `sessionRecapAiService.generateDraft`
which POSTs to `/api/v1/sessions/:sessionId/recap/generate`. Actor is resolved from Better Auth;
use-case enforces rate/size/GM equality (linked solo ids), hydrates session/project/recap from
SQLite, builds spoiler-safe prompt, invokes inference, persists `summary_status=draft` only.
Approved summaries are locked (409) with atomic recheck before durable write. Soft-DENY removed.
Without provider: `not-configured`. Manual GET/PUT recap unchanged. User Organize prefs beat env.

## Hop chain

1. **Producer (UI):** EpisodeSummaryPanel / useEpisodeSummary
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/sessions/:id/recap/generate`
4. **Authorize:** session Actor + projects.gm_user_id equality (+ linked solo)
5. **Infer:** `generateSessionRecapStory` (user Organize prefs → SESSION_RECAP_* / CHARACTER_AI_*)
6. **Persist:** SQLite `session_recaps` draft only (refuses overwrite of approved)
7. **Consumer:** same panel — draft until GM approves via PUT

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Non-GM cannot generate | 403 before provider | pass |
| Invalid/missing | No model configured | `not-configured` 200 | pass |
| Approved lock | Re-generate after approve / race | 409 atomic | pass |
| Dual-path | Flag off → Edge session-recap | Exclusive | pass |
| Quota | SESSION_RECAP / CHARACTER rate | SQLite durable 429 | pass |
| Two consumers / crash | Concurrent generate shares durable SQLite quota | Same rate-limit table | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + HTTP + provider hops changed; covered by cut-14-recap-generate.self-test with
injected deterministic host inference adapter. Subsequent tip commits are proofOnly
(docs/qa pin + MIG-002 retarget).
