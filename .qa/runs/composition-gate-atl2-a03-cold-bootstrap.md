# Composition Gate — atl2-a03-cold-bootstrap

**Verdict:** SKIPPED  
**Feature slug:** `atl2-a03-cold-bootstrap`  
**HEAD:** 45994736e2015117fa217d0541723e8f93c4732c
**Date:** 2026-11-12

## Reason

Owner-scoped Dornhain catalog / atlas bootstrap and Golden reset. No new
multi-actor hop; writes stay on the same owner world via host
`ensureDornhainDefaultCatalog` + `seedDornhainGoldenHierarchy`.

## Path (informational)

Host boot / ensure-starter → `ensureDornhainDefaultCatalog` →
`seedOwnedDornhainAtlas` → `seedDornhainGoldenHierarchy` → SQLite
`world_atlas_maps` / `world_places` / `world_place_map_links` → FE
`WorldAtlasWorkbench` list/drill/reset.
