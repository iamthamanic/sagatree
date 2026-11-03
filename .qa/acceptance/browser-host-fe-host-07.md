# Acceptance — browser-host-FE-HOST-07 (#1099)

## SLICE DONE

Product sign-in/sign-out via host Better Auth cookies when
`VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL; GoTrue JWT reconnect gates
skipped for Library/Atlas under that flag.

## Checks

- [x] Covered happy-path ops succeed against host without Supabase (`scripts/fe-host-07-product-auth.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-07 self-test.

## Deferred

- Full Supabase/GoTrue removal → FE-HOST-09
- Local Admin offline shortcut remains for non-host-library DEV
- Dornhain soft-provision after host sign-in (still GoTrue-tied)

## Security Coverage

- Host session from Better Auth HttpOnly cookie only; no bearer mint.
- Unauthenticated whoami/library stay 401.
- Atlas/World API-reconnect CTA hidden under host library flag.

## Implementation Notes

- `hostAuthBridge`: `signInHostEmail` / `signUpHostEmail` / `signOutHost`.
- `auth-context`: product auth dual-path when `isHostLibraryEnabled()`.
- Atlas: skip GoTrue JWT gate under host library.
