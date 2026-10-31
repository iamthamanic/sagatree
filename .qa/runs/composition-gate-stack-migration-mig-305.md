# Composition Gate — stack-migration-mig-305 (#804)

- HEAD_SHA: 986b25edf823d4bfa5617d072d0a29b357e748c9
- BASE_SHA: `6515414f66d4e03515c50cbfc94f64b97c70d817`
- Date: 2026-10-31
- Verdict: CLEAR

## Event

Authenticated author creates/lists/updates/deletes marketplace_items via host `marketplace` ports. Foreign actors receive DENY on mutate. Catalog reads are public. Download increment is atomic (#878). Browser Supabase marketplace-service stays the live default (dual-path seam only).

## Hop chain

1. Producer: Marketplace UI / infrastructure marketplace-service successor (or host dual-path adapter)
2. Authorize: verified actor for mutate/increment; author_id from actor only (no client-claimed author)
3. Persist: SQLite `marketplace_items` (+ atomic downloads UPDATE)
4. Project: MarketplaceItemRecord with filters/featured/search semantics
5. Consumer: `createHost` wires `marketplace` ports; FE `createHostMarketplaceAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner O creates/lists/updates/deletes own items; stranger X gets not-authorized on update/delete. Public catalog list/get remains readable.

### Invalid/missing
Missing actor on create/update → 42501. Privileged client fields → privileged-client-field. Unauth increment → 42501. Unknown increment id → no-op. Search `%`/`_` escaped (literal).

### Two consumers / crash
Create + increment committed via SQLite; reload returns same id and downloads. Featured prefers rating≥3.5 else top downloads.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No marketplace catalog HTTP mount in this slice
