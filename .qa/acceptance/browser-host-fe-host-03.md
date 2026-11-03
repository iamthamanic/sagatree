# Acceptance — browser-host-FE-HOST-03 (#1095)

## SLICE DONE

Product world map / atlas / places HTTP + FE dual-path under `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL.

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-03-world-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY (unauth + stranger world atlas/map/place).
- [x] Empty/missing resource produces stable empty/not-found UX (unknown map/place → 403/404).
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-03 self-test.

## Implementation Notes

- Host routes: `server/src/api/world-atlas-routes.ts` mounted from `create-app.ts`.
- FE client: `src/infrastructure/host/host-world-http.ts`.
- Dual-path facades: `world-atlas-service`, `world-map-service`, `world-place-service`.

## Deferred

- Full Supabase removal → FE-HOST-09
- Azgaar / pin-image Storage uploads remain Supabase-only until a later media cutover (host flag throws clear DE message)
- World node destructive tree ops covered on host HTTP; browser smoke FEATURE VERIFIED separate

## Security Coverage

- Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only — never client-supplied owner ids.
- Owner-scoped WorldPorts deny strangers (42501 / not-authorized → 403).
- List all severities including Low/Info on review.
