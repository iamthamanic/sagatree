# Acceptance — MIG-421 Session-Recap Host Port (#837)

## Intent
Port allowlisted Edge `session-recap` contracts onto the host as an isolated use-case surface under `server/src/application/session-recap/`. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Distinct owner O and project GM G: only G can generate a recap for an ended session; active member/player/foreign X denied.
- [x] POST with client highlights/prompt/worldState/summaryText rejects 400, and GM-only highlight sentinel never reaches provider.
- [x] Successful response coincides with persisted summary_status=draft; publication remains a separate RPC decision.
- [x] Non-ended session 400, missing session 404, eighth-thousand-and-first byte 413; quota7 returns 429.
- [x] Provider/persistence failure returns generic 500 and never publishes stale or partial generated text.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-421-session-recap.self-test.mjs` → PASS

## Security Coverage
- SC-01: Authenticated account must equal `projects.gm_user_id`; owner/member/GM-label alone never substitutes.
- SC-02: N/A — no uploads.
- SC-03: Persistent quota (`consume_session_recap_rate_limit` stand-in) charged before body/session/GM validation; default 6/min.
- SC-06: Provider/API secrets never returned; degraded errors omit secrets; client prompt payloads rejected.
- Out of scope: production cutover / host HTTP mount / auto-publish.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-421-session-recap.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Isolated host ports under `server/src/modules/session/internal/session-recap-generate.ts` + slim barrel + application generate use-cases; Edge allowlist unchanged; no `create-app` mount. RPC get/save remain under `get_session_recap/` / `save_session_recap_summary/`.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-421.md` (CLEAR).
