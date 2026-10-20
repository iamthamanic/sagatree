# Feature: ST-MIG PREP-04 — Per-RPC contracts (#777)

## Intent

Map all 55 inventarized frontend RPC names to SQL definitions, call sites, proposed TypeScript successors, tests, and PR-sized split tickets.

## Happy Path

- [x] `inventory.json` has ≥55 RPCs with sqlDefinitions, callSites, successor module, requiredTests
- [x] Per-RPC markdown under `.qa/intake/rpc-contracts/`
- [x] `SPLIT_TICKETS.md` replaces oversized MIG-350..353 clusters
- [x] Marketplace RPC located under `src/supabase/*.sql` (migration gap noted)

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-04.md`
