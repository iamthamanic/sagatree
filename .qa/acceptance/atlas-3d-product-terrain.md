# Feature: Atlas shows the saved map (3D + Draufsicht) instead of the demo world

<!-- Step 1 of the Golden world plan (stacked on #1194 Dornhain Golden atlas v4) -->

## Intent

Product atlas maps (`demoSeed: false`) render **only** what is stored in `generator_meta`
(unified canvas doc ↔ `webglRuntimeV3`) — in 3D and in the 2D Draufsicht. The built-in demo
world (Eldoria continents, demo meshes, Dornhain-anchored demo stages/hotspots) never appears
on product maps. Place pins come from `world_places` + `world_place_map_links`; the select and
road tools work in 3D.

Classification: **SETUP** (authoring), surface **Workstation** (Desktop/Tablet). Visualization
work → IV gates apply.

## Preconditions

- Owner/GM with edit rights on a world that has a product root map (e.g. Dornhain Golden v4).
- Host library auth; map persistence via existing `upsert_world_atlas_map` (CAS revision).

## Happy Path

- [x] 3D product map draws doc areas (rooms), strokes, walls and stamps 1:1 on the 0…1000 frame; no demo continents/meshes/labels
- [x] Map scale follows the owning node (world / Ortskarte / Innenraum): world maps keep `w.` terrain as the base, settlement `s.` detail below span 140, dungeon/room detail below span 45
- [x] Pins for every grounded place on the active map (`buildAtlasMapPins`); building pins appear below span 140, room pins below span 45 on world maps; stacked pins at the same anchor are offset
- [x] Pin click (3D canvas, 2D canvas, 2D rail) flies to the pin (kind-based span) and selects the place in Weltstruktur
- [x] 3D tools: Auswahl (select + drag + Delete), Weg/Grenze (road), Pinsel, Stempel, Radierer; tool sizes scale with zoom (span) in 3D and 2D alike
- [x] Draufsicht (2D) renders the same map (was blank for product maps) with the same LOD and pins; rail lists "Orte auf dieser Karte"; double-click zooms in with Hand/Auswahl; "Zur Weltkarte" fits the map
- [x] Surface choice (3D / Draufsicht) survives map remounts (state lifted to the workbench)
- [x] Autosave does not remount the editor; edits made during an in-flight save stay dirty for the next save
- [x] Stamp type, elevation and height survive the doc ↔ runtime round trip; `pflaster` stays `pflaster`

## Edge Cases

- [x] Map without places → rail empty state "Noch keine Orte auf dieser Karte verortet."
- [x] Places without anchor (e.g. Whisper Road "unverortet") get no pin
- [x] Archived places and the map's own owner get no pin; max 400 pins per map
- [x] Pin labels are text only (no HTML injection); coordinates outside ±5000 are dropped
- [x] `setPointerCapture` failures (inactive pointers) do not abort select/drag
- [x] Reduced motion (`prefers-reduced-motion: reduce`) → camera jumps instead of flying (2D + 3D)
- [x] Camera flight is cancelled when the editor unmounts (pin click that switches maps)

## Regression

- [x] Eldoria demo path (`demoSeed` true) keeps demo stages/hotspots and prototype sizing
- [x] Golden reset (#1194) still restores atlas + places; contentEpoch remounts editors once
- [x] Revision conflict UI unchanged
- [x] WebGL tool registry: only runtime-supported tools enabled (select/road now supported)

## Gates

| Gate | Status | Evidence |
|------|--------|----------|
| IV-01 Authority classification | PASS | Pins = canonical places (DB); stamps/strokes = map geometry; demo hotspots removed from product maps |
| IV-02 No silent canon | PASS | Pins never create/move places; stamps never create WorldNodes |
| IV-07 Hidden info safety | PASS | Pins are built from the same `listPlaces({ playerView })` result as Weltstruktur (Spieleransicht filter applies) |
| IV-09 Interaction truth | PASS | Only DB pins are clickable navigation targets |
| IV-12 Reveal restraint | PASS | Camera flights 650 ms, non-blocking; instant under reduced motion |
| IV-17 Camera restraint | PASS | Camera moves only on explicit user action (pin, double-click, home, zoom) |
| IV-18 Canonical linkage | PASS | Pin id = `world_places.id`; selection syncs Weltstruktur |
| AU-02 Touch targets | PASS | Pins, rail entries and surface actions ≥ 44 px (`min-h-11`) |
| AU-04 Keyboard | PASS | Pins and rail entries are buttons; Delete / Ctrl+Z / Esc in 3D |
| AU-05 Motion restraint | PASS | Reduced motion respected for camera flights |
| AU-08 Accessibility basics | PASS | `aria-label="<Ort> öffnen"`, `aria-pressed`, `aria-current` |
| AU-09 States | PASS | Empty pin list state; loading/booting unchanged |
| AU-10 Token fidelity | PASS | Cyan primary for selected, Gold accent hover, card/border tokens |
| AU-CONTENT-WIDTH | PASS (Workstation) | Checked at 1920, 1600 and 900 px viewport width: no horizontal page scroll; Draufsicht actions moved into the surface bar so they no longer overlap the rail |
| AU-06 Recomposition | DEVIATION | Workstation surface; Phone band is not a supported editing band for the atlas (unchanged from #750/#1194) |

## Screenshots (local, not committed)

| Step | Description |
|------|-------------|
| 1 | 3D zoomed to Dornhain: Taverne / Krypta / Marktplatz / Dornhain pins |
| 2 | Draufsicht world view: same map, rail "Orte auf dieser Karte", actions in surface bar |
| 3 | Draufsicht 900 px main width: no overlap, no horizontal scroll |

## Known follow-ups (later steps)

- Golden v4 settlement stamps are oversized relative to span-based new stamps (Step 5+6 content pass)
- Golden `w.` / `s.` overlap around Dornhain (Step 5+6)
- Real coastline polygons + "Fläche zeichnen" (Step 2)
- Draufsicht opens at full-map fit, not at the current 3D camera
- 2D brush default 45 vs 3D 35

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-map-pins.ts` (scale, pins, LOD, focus span, tool sizes), `webgl-runtime-bridge.ts` (lossless stamp/elevation/height, `paving`), `atlas-tool-registry.ts` (select/road supported)
- Runtime: `atlas-prototype-runtime.mjs` product branch (geometry from doc, pins, select/road/erase, span sizing)
- Host: `AtlasNative3dEditor.tsx`, `UnifiedAtlasEditor.tsx` (Draufsicht product path), `WorldAtlasWorkbench.tsx`, `useWorldAtlasEditor.ts` (contentEpoch, edited-during-save)
- Checks: `scripts/atlas-map-pins.self-test.mjs` (new, wired into test-gate), `atlas-prototype-lod.self-test.mjs`, `atlas-worldbuilder-webgl-tool-registry-check.mjs`

## Composition Gate

SKIPPED — UI/runtime + pure domain projection; persistence reuses the existing map upsert (see `.qa/runs/composition-gate-atlas-3d-product-terrain.md`).

## Security Coverage

- Pins are read-only projections of owner-scoped places; no new write path
- Map writes stay on the existing owner-gated `upsert_world_atlas_map` with revision CAS
- Untrusted place names rendered via `textContent` / React text only
- Client tool gating is UX; RPC/RLS remain the authorization boundary
