# Acceptance — browser-host-FE-HOST-06 (#1098)

## SLICE DONE

Product asset publish/get HTTP and character portrait upload dual-path under
`VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL (host AssetPorts + SQLite; no Supabase Storage).

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-06-assets-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-06 self-test.

## Deferred

- Full Supabase removal → FE-HOST-09
- Item thumbnail / model Edge uploads remain Supabase until a later media cutover
- World atlas / map pin / user-avatar / Meshy export Storage paths remain prior surfaces
- Resumable large uploads (MIG-501) not exposed on this product HTTP surface

## Security Coverage

- Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
- AssetPorts + policy: owner-scoped publish/read; path/URL never authorization.
- Character portrait bind verifies asset ownership before storing `ownerId/assetId`.

## Implementation Notes

- Host routes: `server/src/api/asset-routes.ts` (`POST/GET /api/v1/assets`).
- Library character PATCH normalizes display URL → owner storage path.
- FE: `publishHostAsset` + `characterService.uploadPortrait` dual-path.
