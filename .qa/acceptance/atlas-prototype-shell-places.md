# Feature: Atlas Prototype Shell + Place Authoring

<!-- atlas-prototype-shell-places -->

## Intent
Bring the Unified Atlas workstation closer to the offline prototype UX (one shell: hierarchy · stage · inspector) and enable Google-Maps-style authoring: paint land/water, name regions, define settlement presets (Großstadt / Stadt / Dorf), place a basic building. Persist places via existing `world_places` + canvas stamps — no HTML iframe embed.

## Preconditions
- Authenticated GM with JWT; world profile linked (e.g. Dornhain)
- Unified atlas map with `generator_meta.unifiedCanvas`
- Adaptive shell / AU-CONTENT-WIDTH

## Happy Path
- [ ] Unified atlas shows prototype-like chrome: left hierarchy + layers, center stage with level pill + Weltkarte/Globus toggle, floating tools, right inspector
- [ ] At world scale, view toggle is labeled **Weltkarte** / **Globus (3D)** (same 2D/3D engines)
- [ ] GM can create a **Gebiet** (`region`) or **Ort** (`settlement`) from the inspector with name + optional settlement preset
- [ ] Settlement presets: Großstadt / Stadt / Dorf → `seedKey` `settlement.city|town|village` + matching stamp size
- [ ] Creating a place adds a canvas stamp at camera center and upserts `world_places` (owner-scoped RPC)
- [ ] GM can create a **Basic-Gebäude** (`building`, `seedKey` building.basic) at camera center
- [ ] Existing save/undo/dungeon forge still work

## Edge Cases
- [ ] Player / `canEdit=false`: define-place controls hidden; hand/zoom still work
- [ ] Empty name rejected with DE error
- [ ] Place RPC failure surfaces DE error; canvas stamp not left orphaned if upsert fails first (upsert then stamp, or rollback stamp)
- [ ] Narrow pane: side columns collapse to sheets (existing AU pattern)

## Regression
- [ ] Library + Saga share `WorldAtlasWorkbench`
- [ ] Dornhain unified starter canvas still loads
- [ ] No iframe of `sagatree_unified_atlas_3d_v3.html`

## Security Coverage
- Owner/membership via existing `upsert_world_place` RPC + JWT assert
- No elevated client origins; no cross-owner FKs
- N/A — not a launch ticket (SC-01…SC-07 full)

## Implementation Notes
- Domain: `settlement-presets.ts` (Großstadt/Stadt/Dorf + building.basic)
- UI: `AtlasDefinePlacePanel` in Unified inspector; Weltkarte/Globus labels at planet scale
- Workbench: `onCreatePlace` → `upsert_world_place` + optional `linkMap` with canvas anchor
- Self-test: `scripts/atlas-settlement-presets.self-test.mjs` (wired in world-atlas test-gate)

## Composition Gate
- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atlas-prototype-shell-places.md`
