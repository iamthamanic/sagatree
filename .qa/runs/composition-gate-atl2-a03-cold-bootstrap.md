# Composition Gate — atl2-a03-cold-bootstrap

- Issue: #1199
- Feature slug: atl2-a03-cold-bootstrap
- HEAD_SHA: 84c786aa02043955f73232558ef884651fd83620
- BASE_SHA: d3e3f2b71db41e48f34d8ea17d49b5782efa7c84
- Date: 2026-11-12
- Verdict: SKIPPED

## Skip reason

Owner-scoped Dornhain catalog / atlas cold bootstrap and Golden hierarchy seed.
No new multi-actor hop; writes stay on the same owner world via host
`ensureDornhainDefaultCatalog` → `seedDornhainGoldenHierarchy`.

## Event

Fresh host / ensure-starter lands six-level Golden maps + places for the owner.

## Hop chain

Host boot / ensure-starter → `ensureDornhainDefaultCatalog` →
`seedOwnedDornhainAtlas` → `seedDornhainGoldenHierarchy` → SQLite
`world_atlas_maps` / `world_places` / `world_place_map_links` → FE
`WorldAtlasWorkbench` list/drill (existing read path).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Only owner world receives Golden seed | owner-scoped ids + world_profile_id | pass |
| Invalid/missing | Re-ensure without parent throws; user maps survive | seedDornhainGoldenHierarchy + self-test | pass |
| Two consumers / crash | Idempotent retry after partial ensure | INSERT OR IGNORE + UPDATE by seed | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
