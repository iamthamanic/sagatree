# Acceptance — browser-host-FE-HOST-08 (#1100)

## SLICE DONE

Marketplace, rulesets, and user-profile product HTTP + FE dual-path under
`VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL. Character lore AI and session
recap AI explicitly stubbed (German unavailable). Recap get remains host-session.

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-08-catalog-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-08 self-test.

## Deferred

- Full Supabase removal → FE-HOST-09
- Character lore AI host path (explicit DENY stub)
- Session recap AI generate/save host path (explicit DENY stub; get-recap already host)
- Peer `getProfilesByUserIds` batch under host (German unavailable until FE-HOST-09)
- Marketplace Edge Map quarantine (MIG-415) stays unmounted
- Rulesets Edge quarantine stays unmounted

## Security Coverage

- Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
- Marketplace mutations author-scoped; claimed foreign profile owner DENY.
- Ruleset custom mutations creator-scoped; official rows immutable via ports.

## Implementation Notes

- Host routes: `server/src/api/catalog-routes.ts` (`/api/v1/marketplace/*`, `/api/v1/rulesets/*`, `/api/v1/user-profile/me*`).
- FE: `host-catalog-http.ts` + dual-path marketplace/ruleset/user-profile services.
- PUBLIC_ACTIVATION: `MARKETPLACE_INFRA` + `USER_PROFILE` flipped with HTTP+FE wire.
