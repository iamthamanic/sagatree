# Composition Gate — cut-10b-world-atlas-assets-host (#1161)

- HEAD_SHA: 40abce9778e2e436fd3879b1d806b2a5dedbc13c
- BASE_SHA: 45f681e20a84671b13b81afd98b641320279785e
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-10b closes world map/atlas asset Soft-DENYs; cookie media replaces time-limited signed tokens)

## Event

Under host-only cutover, WorldMapPinDialogs and WorldAtlasWorkbench publish
pin/Azgaar bytes through `POST /api/v1/worlds/:worldId/assets` after `world.edit`
authorization, then read via credentialed `GET /api/v1/assets/:id`. Soft-DENY
removed. No Supabase Storage.

## Hop chain

1. **Producer (UI):** WorldMapPinDialogs / useWorldAtlasEditor / WorldAtlasWorkbench
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** `publishHostWorldAsset` / `resolveHostWorldAssetUrl`
4. **Authorize:** `permissions.authorize('world.edit')` then AssetPorts owner publish/get
5. **Persist:** LocalAssetStore under dataDir/assets (no world pin SQL table)
6. **Consumer:** pin `imagePath` / atlas `azgaarMapStoragePath` + download button

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot publish/read | Fail-closed 403/404 | pass |
| Invalid/missing | Bad pin/azgaar MIME | 400 | pass |
| Two consumers / crash | Upload path + signed URL resolve | Shared AssetPorts | pass |
| Soft-DENY | Removed from FE facades | Host path only | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Owner/GM world.edit gate + AssetPorts provide host-only parity for the three
matrix keys without inventing a second storage authority.
