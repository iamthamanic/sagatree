# Acceptance — stack-migration-rpc-marketplace-count (#878)

## Intent

Port `increment_marketplace_downloads` as a host use-case with unchanged safe semantics: atomic +1 on known items, no-op on unknown, authenticated callers without author binding, no client write fallback.

## Acceptance tier

`isolated-contract`

## Happy path

- Authenticated actor increments an existing `marketplace_items` row → downloads +1.
- Unknown item id → ok no-op (mutated=false).
- Host migration `0029_marketplace_items.sql` is the install successor for optional `src/supabase/*marketplace*` RPC scripts.

## Edge / security

- Empty actor id → `42501` DENY (host does not expose PUBLIC/anon EXECUTE).
- Legacy SECURITY DEFINER / missing search_path / no auth.uid in optional SQL remain documented regressions — not silently treated as secure host policy.
- FE `incrementDownloads` stays RPC-only (no client counter write, #675).

## Required tests

Covered by `scripts/rpc-marketplace-count.self-test.mjs` (wired into `npm run test-gate`).

## Implementation notes

- Module: `createMarketplaceCountPorts` + `MarketplaceCountStore`
- Use-case: `server/src/application/marketplace-count/increment_marketplace_downloads`
- Command barrel: `increment_marketplace_downloads`
- Quarantine Map catalog unchanged (`MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS=false`)
