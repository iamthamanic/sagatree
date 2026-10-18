# Feature: Atlas prototype LOD & layers

## Intent

Port the Unified Atlas HTML prototype’s **level / LOD / layer** model into the product editor: one camera, staged zoom (`Welt → Region → Stadt → Dungeon → Raum`), visibility toggles, and hotspots — without embedding Eldoria demo art or the offline HTML shell.

## Preconditions

- Authenticated GM with a Dornhain/product world map (`demoSeed=false`, ocean root).
- Unified Atlas editor open on the world layer.

## Happy Path

1. Root level shows tag **WELT** and crumb **Welt**; canvas is ocean-first.
2. Zooming toward Dornhain updates level pill through REGION → STADT → DUNGEON (when anchors apply).
3. Left nav lists the five prototype stages; click flies the camera to that stage.
4. Layer switches (Weltkarte / Regionen / Stadt / Dungeon / 3D-Objekte / Kampfgrid) toggle paint visibility.
5. Canvas hotspots appear at prototype-like span windows and jump to the next stage.

## Edge Cases

- Empty `placeNav`: still uses product LOD anchors (not Eldoria demo rects).
- Demo Eldoria maps keep existing Eldoria LOD path.
- Layer off → corresponding map/content not painted.

## Adaptive UI

- AU-TOUCH ≥ 44px on nav / layer / hotspot controls.
- AU-CONTENT-WIDTH: rails stay inside `@container/main`.

## Security Coverage

- N/A — client LOD/chrome only; no new auth or cross-owner writes.

## Scope

- In: domain LOD helpers, editor chrome + paint gates, self-test.
- Out: full WebGL AtlasGL port, Eldoria texture bake, iframe HTML.

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-prototype-lod.ts` — levels, `levelFromView`, `applyLod`, hotspots, brush/stamp sizes (HTML v3 parity, Dornhain anchors).
- Editor: product (`demoSeed=false`) uses prototype nav / layer switches / hotspots / double-click drill; demo keeps Eldoria path.
- Self-test: `scripts/atlas-prototype-lod.self-test.mjs` (wired in `test-gate`).
