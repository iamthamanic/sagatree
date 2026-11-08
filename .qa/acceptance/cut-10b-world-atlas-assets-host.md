# Acceptance — CUT-10b (#1161)

- Issue: #1161
- Slug: cut-10b-world-atlas-assets-host
- Epic: #1135

## Delivered

Host-only parity for world map pin image upload, Azgaar `.map` upload, and atlas download URL:

- `POST /api/v1/worlds/:worldId/assets` with `purpose=map-pin|azgaar`
- Authorizes `world.edit` before `AssetPorts.publish` (not actor-only `/api/v1/assets`)
- FE facades `worldMapService.uploadPinImage` / `worldAtlasService.uploadAzgaarMapFile` / `createSignedUrl`
- Soft-DENY removed; foreign owner → 403

## Checks

- [x] scripts/cut-10b-world-atlas-assets.self-test.mjs
- [x] Owner publish + credentialed GET
- [x] Stranger publish/read deny
- [x] Invalid MIME reject (pin + azgaar)
- [x] Matrix keys HOST_VERIFIED
- [x] `npm run test-gate` (includes CUT-10b)

## Composition Gate

See `.qa/runs/composition-gate-cut-10b-world-atlas-assets-host.md`.
