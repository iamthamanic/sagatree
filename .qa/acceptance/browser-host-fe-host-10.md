# Acceptance — browser-host-FE-HOST-10 (#1115)

## SLICE DONE

Host-first product defaults: Better Auth demo `admin`/`player1` + `1234`,
owned Dornhain starter per remote actor (ensure-starter), MIG-015 solo identity
route + FE auto-link, Library list/delete/patch honor linked solo owners,
Vite `/api` same-origin proxy, Dashboard „Session hosten“.

## Checks

- [x] `scripts/fe-host-07-product-auth.self-test.mjs` covers solo identity,
      ensure-starter Dornhain for two remotes, minPasswordLength 4, vite proxy,
      Session hosten, libraryActorIds.
- [x] No required live Supabase for this slice.
- [x] Touched files: zero type escape hatches.

## Deferred

- Atlas/map/places seed → FE-HOST-11 (#1116)
- Project write residual DENY → FE-HOST-12 (#1117)
- Saga definition HTTP → FE-HOST-13 (#1118)
- AI/Meshy/media residuals → FE-HOST-14 (#1119)

## Security Coverage

- Solo link remains confirm + host solo id match (MIG-015).
- Per-actor Dornhain copies use scoped catalog ids (no INSERT OR REPLACE steal).
- Owner-scoped library mutations via `libraryActorIds`.
- All severities listed (Critical→Info) for residual allowlist unchanged except
  product-default gaps closed here.

## Implementation Notes

- `ensureOwnedDornhainStarter` on project-infra ensure-starter fallback.
- `ensure-dornhain-default.ts` owner-scoped catalog apply + nativeTag payload.
- `GET /api/solo/identity` + `ensureHostSoloAccountLinked` after sign-in.
