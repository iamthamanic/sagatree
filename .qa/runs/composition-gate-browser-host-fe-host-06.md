# Composition Gate — browser-host-fe-host-06 (#1098)

- HEAD_SHA: c94282a5e9e120d8f5e59047209005160aecf1ef
- BASE_SHA: 34282183f15fb190619b3c7ff1756d7b619b15d4
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1099–#1101; item thumbnails/models; other Storage buckets

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, character portrait upload and
asset publish/get go to host HTTP (`POST/GET /api/v1/assets`) backed by AssetPorts
+ SQLite under `dataDir/assets/`; without the flag, Supabase Storage remains.

Character PATCH accepts host display URLs and stores owner-scoped `ownerId/assetId`
after AssetPorts ownership verification; list/get expand back to display URLs.

## Hop chain

1. **Producer (UI):** CharacterEditor avatar upload → `characterService.uploadPortrait`
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http`)
3. **Transport:** credentialed `FormData` POST `/api/v1/assets`
4. **Authorize:** Actor from cookie session; `asset.publish` / `asset.read` policy
5. **Persist:** SQLite `assets` + bytes under `dataDir/assets/`
6. **Consumer:** Display URL on character portrait; GET bytes with same session cookie

Cardinality: one publish per upload; no cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read foreign assets or bind foreign portrait URLs. | Ports + normalizePortraitStoragePath. | pass |
| Invalid/missing | Unauth publish DENY; missing/foreign get → not-found. | 401/403 fail-closed. | pass |
| Two consumers / crash | Dual-path exclusive. | Flag off → Supabase; flag on → host. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Self-test `scripts/fe-host-06-assets-http.self-test.mjs` covers publish/get DENY/bind.
Composition hops are exclusive dual-path; no new cross-owner edges.
