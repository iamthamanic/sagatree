# Composition Gate — stack-migration-rpc-marketplace-count (#878)

- HEAD_SHA: b89eaae09c551c23bffbab408741bba4affc540b
- BASE_SHA: 655a207a9f62eabdc2423417edf8dd79cdc7add3
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Host `createMarketplaceCountPorts.incrementDownloads` atomically increments durable `marketplace_items.downloads` for verified actors. Unknown ids no-op. Optional Supabase SQL scripts remain legacy install sources; host migration 0029 is the successor. FE keeps RPC-only counters (no client write). Quarantine Map catalog stays non-durable.

## Hop chain

1. Producer: marketplace download UI / `incrementDownloads` service (or host command)
2. Authorize: verified Actor id required (`42501` if missing); no author binding (legacy)
3. Persist: SQLite `marketplace_items` single-writer UPDATE downloads+1
4. Project: typed CountOk (downloads / mutated) or CountError
5. Consumer: application command `increment_marketplace_downloads` + future dual-path adapter

## Simulations

### N-actors
Author seeds item; non-author player increments; solo actor increments; empty actor DENY.

### Invalid/missing
Unknown item id → ok no-op. Empty item id → `22023`.

### Two consumers / crash
Sequential increments persist across reads; no client-side counter write path.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + FEATURE VERIFIED → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
