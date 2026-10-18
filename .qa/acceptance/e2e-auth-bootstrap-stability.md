# Feature: E2E Auth Bootstrap Stability

<!-- e2e-auth-bootstrap-stability -->

## Intent
Local Admin login must not hang Browser E2E when remote GoTrue is slow/unreachable. Bound the existing GoTrue attempt with `AUTH_SESSION_TIMEOUT_MS` and fall back to the existing app-level Local Admin session. Timed-out / superseded GoTrue successes must not resurrect Admin after logout or overwrite a newer user.

## Happy Path
- [x] Controlled hang repro: Dashboard stays absent while token request is held (pre-fix)
- [x] Local Admin `signIn` uses `raceWithTimeoutOrSymbol` + `AUTH_SESSION_TIMEOUT_MS`
- [x] Timeout / network failure → Local Admin fallback → Dashboard
- [x] Successful GoTrue → real JWT user
- [x] Non-admin login unchanged (no admin fallback)
- [x] Shared `e2e/helpers/auth.ts` `ensureLoggedIn` used by previously duplicated specs
- [x] Cases 1–8 Playwright behavioral suite (incl. late-success races)
- [x] Targeted auth suite 5× PASS (`--retries=0`)
- [x] Full Browser E2E PASS (`CI=1`, `--retries=0`)

## Edge Cases
- [x] GoTrue abort → fallback
- [x] GoTrue hang > 1500ms → fallback before 15s E2E asserts
- [x] Bootstrap with stored Local Admin + slow auth → no hang
- [x] Timeout → late GoTrue success upgrades intentional Local Admin fallback to JWT (no login bounce; API usable)
- [x] Timeout → logout → late success does not resurrect Admin / persist admin session
- [x] Timeout → different user → late admin does not replace newer user
- [x] Overlapping Local Admin attempts: newest wins; superseded JWT may upgrade live Local Admin fallback
- [x] HMR / Strict remount race: storage flag still set → adopt JWT (never scrub); `decideLocalAdminJwt` + `mayDiscardLocalAdminJwt` + case 1b persist check
- [x] `discardStaleLocalAdminSession` is a no-op while Local Admin storage flag is set (anti-hang harden)

## Regression
- [x] No Face Anchor / #423 / Agent Review changes

## Screenshots
| Step | Filename |
|------|----------|
| Hang repro | `.qa/evidence/e2e-auth-gotrue-hang-repro/` |
| Cases 1–8 / P1 | `.qa/evidence/auth-local-admin-timeout/` |

## Composition Gate
- Verdict: SKIPPED
- Proof: `.qa/runs/composition-gate-e2e-auth-bootstrap-stability.md`
- Reason: in-process attempt generation + fallback JWT upgrade + selective stale session scrub; no producer→consumer fan-out
