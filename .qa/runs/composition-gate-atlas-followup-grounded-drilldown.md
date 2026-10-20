# Composition Gate — atlas-followup-grounded-drilldown (#752)

- HEAD_SHA: 27aa93da8e02a7beb462dfe296238f79c6c2b46b
- BASE_SHA: 044d8f998b9e537b11e4b0bec18d44bb560fa512
- Date: 2026-10-20
- Verdict: CLEAR

## Event

GM selects a WorldNode in product WebGL; drill/LOD only proceeds when the place has a grounded link anchor. Unlocated maps render honest empty ocean (no demo continents/hotspots). Parent spatial transforms are validated before mutation.

## Hop chain

1. Producer: world_places + map links (anchors) → `buildAtlasWebglNavTree` (`located`)
2. Domain: `canWebglDrillSelect` / `assertParentSpatialAnchor` / `canLodEnterChildMap`
3. Host: `mapSketchStatus` into native runtime; workbench opens primary map for authoring
4. Consumer A: WebGL product path — hide demo hotspots; block dblclick ladder; toast when unlocated
5. Consumer B: unlocated status ⇒ `isEmptyWorldActive` (no invented landmass)
6. Geometry authority: `ATLAS_FEATURE_OWNERS` political / terrain / room_geometry remain single-sourced

## Simulations

- N-actors: tip/status updates via `setMapSketchStatus` without remount.
- Invalid/missing: zero extent anchor rejected; unlocated child `canWebglDrillSelect=false`.
- Two consumers / crash: map document + place link anchors remain shared persist path; no demo LOD invents IDs.

## Flags

(none)
