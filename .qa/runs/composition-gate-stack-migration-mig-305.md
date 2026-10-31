# Composition Gate — stack-migration-mig-305 (#804)

- HEAD_SHA: 8213530083f9470e6e8b8e9757d9f4853c933282
- BASE_SHA: 6515414f66d4e03515c50cbfc94f64b97c70d817
- HOP_DIGEST: e0e1ff065645f2605c9589710f7b1f3cae8431b8d56ede5efa6482fe17e6538b
- Date: 2026-10-31
- Verdict: CLEAR

## Event

Authenticated author creates/lists/updates/deletes marketplace_items via host marketplace ports. Foreign actors receive DENY on mutate. Catalog reads are public. Download increment is atomic (#878). Browser Supabase marketplace-service stays the live default (dual-path seam only).

## Hop chain

1. Producer: Marketplace UI / infrastructure marketplace-service successor (or host dual-path adapter)
2. Authorize: verified actor for mutate/increment; author_id from actor only (no client-claimed author)
3. Persist: SQLite marketplace_items (+ atomic downloads UPDATE)
4. Project: MarketplaceItemRecord with filters/featured/search semantics
5. Consumer: createHost wires marketplace ports; FE createHostMarketplaceAdapter dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner and stranger share catalog reads; only owner mutates own rows; foreign update/delete DENY.

### Invalid/missing
Missing/blank id → invalid-item-id; unknown id → not-found; privileged client author_id → invalid-draft; missing actor → 42501.

### Two consumers / crash
Catalog reconstructed from SQLite after host restart; no client role elevation; dual-path FE still defaults to Supabase.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: Frontend cutover + feature E2E → MIG-311/#810 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
