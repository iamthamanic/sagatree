# Acceptance — browser-host-FE-HOST-02 (#1094)

## SLICE DONE

Product session HTTP + FE dual-path under `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL.

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-02-session-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY (unauth create + stranger runtime).
- [x] Empty/missing resource produces stable empty/not-found UX (missing sessionId → 403/404).
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-02 + mig-311.

## Deferred

- Full Supabase removal → FE-HOST-09
- Authoritative host lobby broadcast room (local echo only under host flag)
- `deleteSession` host port (still Supabase when flag off; host path may fail closed)
