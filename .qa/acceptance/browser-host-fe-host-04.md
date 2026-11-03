# Acceptance — browser-host-FE-HOST-04 (#1096)

## SLICE DONE

Product projectInfra HTTP + FE dual-path under `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL.

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-04-project-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-04 self-test.

## Deferred

- Full Supabase removal → FE-HOST-09
- Saga definition authoring RPCs → FE-HOST-05 (`sagaInfra`)
- Library project list already dual-pathed in FE-HOST-01

## Security Coverage

- Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
- projectInfra ports deny strangers; no client-supplied owner/GM elevation.

## Implementation Notes

- Host routes: `server/src/api/project-routes.ts` via `projectInfra`.
- FE client: `src/infrastructure/host/host-project-http.ts`.
- Dual-path: saga-overview, saga-permission, project-member join/character, ensure-starter.
