# Composition Gate — cut-16-activate-existing-item-thumbnai (#1151)

- HEAD_SHA: e9edd7c4e7eab280f2e7e4165ebb9be24c192771
- BASE_SHA: 156dee3da136a9f1f730b77e1163403f06e0a6a3
- Date: 2026-11-06
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-16 activates existing item-thumbnail host use-cases)

## Event

Under host-first, item Workbench thumbnail calls invoke POST `/api/v1/items/thumbnail`
(action body) or REST aliases. Actor from Better Auth; definitions hydrated from inventory
with world-edit checks; upload/status materialize via AssetPorts; generate/status/resolve/remove/latest-job
via `createItemThumbnailUseCases`. Soft-DENY removed. Without Meshy: generate `not-configured`.

## Hop chain

1. **Producer (UI):** Item thumbnail Workbench
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/items/thumbnail`
4. **Authorize:** inventory definition ownership (+ world edit / linked solo ids)
5. **Store:** ItemThumbnailStore metadata + AssetPorts durable bytes (+ Meshy mock/env)
6. **Consumer:** same UI — assetKey / job poll / `/api/v1/assets/...` URL

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot upload foreign item | 403/404/500 before write | pass |
| Invalid/missing | No Meshy | `not-configured` | pass |
| Dual-path | Flag off → Edge item-thumbnail | Exclusive | pass |
| Quota | RATE_LIMIT 4/min | 429 | pass (isolated) |
| Two consumers / crash | Concurrent jobs share in-memory store/quota; durable bytes via AssetPorts | Same process Map + asset store | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + HTTP hops covered by cut-16-item-thumbnail.self-test (includes durable asset GET). Tip docs/qa pins are proofOnly.
