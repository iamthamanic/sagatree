# Composition Gate — cut-17-activate-existing-item-model3d (#1152)

- HEAD_SHA: cd8fd591661ad2d8a61d3d2657713b6a9a4a4781
- BASE_SHA: 4e89e826a8ed9ec6d275512aaa5b3365c40ba107
- Date: 2026-11-06
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-17 activates existing item-model3d host use-cases)

## Event

Under host-first, item Workbench model3d calls invoke POST `/api/v1/items/model3d`
(action body) or REST aliases. Actor from Better Auth; definitions hydrated from inventory
with world-edit checks; upload/status materialize via AssetPorts; generate requires thumbnail
assetKey. Soft-DENY removed. Without Meshy: generate `not-configured`.

## Hop chain

1. **Producer (UI):** Item model3d Workbench
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/items/model3d`
4. **Authorize:** inventory definition ownership (+ world edit / linked solo ids)
5. **Store:** ItemModel3dStore metadata + AssetPorts durable GLB (+ Meshy mock/env)
6. **Consumer:** same UI — model3d key / job poll / `/api/v1/assets/...` URL

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot upload foreign item | 403/404/500 before write | pass |
| Invalid/missing | No Meshy / no thumbnail | `not-configured` / THUMBNAIL_REQUIRED | pass |
| Dual-path | Flag off → Edge item-model3d | Exclusive | pass |
| Quota | RATE_LIMIT 2/min | 429 | pass (isolated) |
| Two consumers / crash | Concurrent jobs share in-memory store/quota; durable bytes via AssetPorts | Same process Map + asset store | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + HTTP hops covered by cut-17-item-model3d.self-test (includes durable asset GET). Tip docs/qa pins are proofOnly after feature HEAD.
