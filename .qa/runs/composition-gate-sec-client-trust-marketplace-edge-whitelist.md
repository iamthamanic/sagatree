# Composition Gate — sec-client-trust-marketplace-edge-whitelist (#675)

## Verdict
CLEAR

## Scope
Marketplace adapter mutations + allowlisted Edge POST body privilege rejection.

## Simulations

### N-actors (foreign author DENY)
- Actor A owns marketplace row (`author_id = A`).
- Actor B authenticates and calls `updateMarketplaceItem` / `deleteMarketplaceItem` for A's id.
- Adapter always `.eq('author_id', userId)` with B's JWT id → `maybeSingle`/empty select → throw / false (never success on foreign rows).

### Invalid privileged keys rejected
- Client POST to allowlisted Edge with `{ author_id, rating, downloads, roles, … }` → `privilegedClientBodyRejectionMessage` → HTTP 400 before action handlers.
- Client update DTO with privileged keys → `whitelistMarketplaceUpdatePatch` throws (no DB write).

### Concurrent consumer
- Single-hop adapter/Edge parsers; no multi-hop invalid fallback. Download counter: RPC only; client write fallback removed.

## HEAD
fe2410f360d4132f69697469e558df19781251a6


## Evidence
- `node scripts/sec-client-trust-marketplace-check.mjs` PASS
- `deno test supabase/functions/_shared/client-trust-body_test.ts` PASS
