# Feature: Dornhain Unified Atlas starter

## Intent
Dornhain / Donalu starter world ships a **canonical Unified Canvas** (`demoSeed=false`) as a **planetary Weltkarte** (ocean + continents) — not Eldoria demo LOD, not a town floorplan as root, and not only legacy tiles. Settlement detail fades in on zoom (`s.*` LOD).

## Happy Path
- [x] Domain `buildDornhainUnifiedCanvasDoc()` v2: `w.ocean` + continents; Dornhain pin; settlement LOD ids `s.*`
- [x] Migration `098` + `099` persist / upgrade `generator_meta` seed `dornhain.unified.v2` + places + settlement child map
- [x] `seed_dornhain_catalog_bindings` calls `seed_dornhain_unified_atlas`
- [x] Client upgrades v1 settlement-as-world docs in-place (`shouldUpgradeDornhainUnifiedToWorld`)
- [x] Default chrome shows **Weltkarte** (no “Unified Atlas” eyebrow); map fills first

## Edge Cases
- [x] Existing maps with user strokes (`demoSeed=false`) and non-v1/v2 seed are not overwritten
- [x] Empty / engine-only meta is filled with starter canvas
- [x] Places upsert by `seed_key` (idempotent)

## Composition Gate
SKIPPED — seed/data + thin client wiring (see `.qa/runs/composition-gate-dornhain-unified-atlas-starter.md` if stamped)
