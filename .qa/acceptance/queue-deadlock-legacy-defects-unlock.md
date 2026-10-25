# Acceptance — queue deadlock unlock (legacyDefects ≠ execution blockers)

## Acceptance
- [x] `legacyDefects` map to `verification.requiredRegressions`, not `verification.blockers`
- [x] Tickets with DONE deps + source-verified + empty execution blockers become READY
- [x] GATE-05, ATLAS-LIVE-E2E, source-blocked, cutover/shutdown stay non-READY
- [x] Contract validation + negative tests PASS
- [x] GitHub bodies/labels synced for status changes (38 updates, 0 failures)
- [x] No invented PASS evidence; no security severity bypass

## Evidence
- `.qa/audits/queue-deadlock-unlock-2026-10-25.md`
- `node --test scripts/stack-migration-contract-validation.test.mjs`
- `npm run check:stack-migration-prep`
