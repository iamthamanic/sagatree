# Acceptance — MIG-305 Marketplace Host Adapters (#804)

## Intent
Port `src/infrastructure/marketplace` catalog/download callers onto approved host repository ports while Supabase remains the live default (no production cutover). Quarantine Map templates stay MIG-415; download counter host path stays #878.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-600/#845 feature E2E cutover; FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
- [x] RPC increment succeeds atomically; unauth DENY (42501); unknown id no-op; counter asserted via getItemById.
- [x] Create rejects client author_id; foreign update/delete DENY; missing delete → `not-found`.
- [x] Contract fixture for increment_marketplace_downloads host successor.
- [x] Legacy regression: client counter fallback superseded (host atomic; FE no downloads write).
- [x] Legacy regression: search uses parameterized LIKE with escaped %/_.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-305-marketplace-adapter.self-test.mjs` → PASS (stdout only; does not rewrite this file).

## Security Coverage
- Author-scoped mutate: host ports DENY foreign actor update/delete (B-01 / SC-01).
- Create author_id from verified actor only; privileged client fields rejected (B-07/B-08).
- Increment requires authenticated actor (42501 without) (SC-02).
- Search input cannot widen LIKE via %/_ (B-04).
- Launch SC-01…SC-07: N/A — not a launch ticket; inline SC-01/SC-02/SC-03/SC-06 covered above.

## Evidence
`node --experimental-strip-types scripts/mig-305-marketplace-adapter.self-test.mjs` → PASS (stdout evidence; acceptance maintained outside the gate run).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-305.md`.

## Implementation Notes
- Host `MarketplaceCatalogStore` on existing `0029_marketplace_items.sql` + TABLE_OWNERSHIP marketplace.
- `createMarketplacePorts` / stub wired in `create-host` as `marketplace`.
- FE dual-path seam: `host-marketplace-ports.contract.ts` + `createHostMarketplaceAdapter` (Supabase marketplace-service default unchanged).
- No HTTP mount; Edge marketplace quarantine remains unmounted.
