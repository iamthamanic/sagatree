# Atlas Scale-Aware Macro Separation, World-Space Labels & Calibrated HUD Pass

- **Branch:** `feat/atlas-spatial-containment`
- **Base:** `984bcd44b`
- **Date:** 2026-11-27
- **Evidence directory:** `.qa/evidence/atlas-scale-labels-pass/`
- **GPU / Runtime:** Apple M4 Pro Hardware Metal WebGL (`PLAYWRIGHT_HARDWARE_WEBGL=1`), sequential runs

## Summary of Structural Fixes

1. **A — Physical Macro-Deco vs. Real Local Geometry Separation:**
   - `atlas-three-scene.ts`: Macro overview maps (`depth 1..3`, `mapScale === 'world'`) in continuous Shared World Space render canonical landmarks as compact cartographic medallions (`emitMacroLandmarkMarker`) instead of giant 34-WE residential houses or 50-WE trees, skip world-scale giant scatter, and slim macro routes (`<= 4.8`) and macro rivers (`<= 3.2`).
   - `atlas-three-multimap.ts`: Split non-water macro overlay opacity (`computeMacroOverlayTargetOpacity`) from macro river opacity (`computeMacroWaterTargetOpacity`). Macro non-water overlays fade cleanly to exact **`0`** (zero `0.08` ghost geometry!) before settlement scale and restore smoothly on zoom-out; regional carrier rivers stay active up to Liang-Barsky settlement cutouts and hand off cleanly to calibrated local settlement rivers at close-up zoom. Faded meshes are hidden (`visible = false`) and excluded from raycast picking.
2. **B — World-Space Pins, Projection-Driven Labels & Honest Active Place Resolution:**
   - `atlas-map-pins.ts`: Added pure domain `buildAtlasWorldPins()` resolving primary-map pins to exact World-Space map centers via `computeMapWorldTransform` and child landmarks without own primary maps via `localToWorld(link.mapId, anchor)`, deduplicated per `place.id`, omitting unlocated places honestly.
   - `atlas-label-hierarchy.ts`: Projection-driven World Scene Graph label hierarchy (`Continent → Country → Place → Building/Dungeon → Room`) using real screen-projected footprint pixels (`projectedSpanPx`), locking the active/focused place so decluttering never covers or shifts it.
   - `atlas-world-scene-plan.ts`: Prioritized the live camera focus chain over stale off-screen `focusTargetMapId` targets so moving from Dornhain/Schankraum to Südmark/Moorbrück never starves Südmark/Moorbrück out of the 6-map budget.
   - `AtlasThreeWorkstation.tsx`: Bound `bindAtlasUnifiedInput` to `stageRef` (canvas + pin overlay) so wheel/pinch over any map label zooms seamlessly into the 3D canvas; dimmed pins to `pointer-events-none` when editing tools (`activeTool !== 'hand'`) are active so buildings under labels remain freely draggable.
3. **C — Ebenen-Drawer Auto-Scroll:**
   - `AtlasThreeWorkstation.tsx`: Container-only `block: 'nearest'` auto-scroll inside `[data-atlas-layers-scroll]` triggered only on drawer open or actual `zoomLayerState.activePlaceId` change (zero outer page scroll, zero forced focus, zero search clear, zero per-frame scroll, jsdom-safe).
4. **D — Calibration- & Projection-Truthful Scale HUD:**
   - `map-frame.ts` + `atlas-world-scene-plan.ts`: Added `extractMapCalibrationMetersPerUnit()` and `resolveWorldCalibrationMetersPerUnit()` reading real persisted `worldSpace.metersPerUnit` (`250 m/WE` on calibrated default worlds) or active calibrated child `parentAnchor.metersPerUnit / worldScale`, returning `null` on uncalibrated maps/worlds (never inventing meters/km!).
   - `atlas-three-camera.ts`: Removed invented `1250 m` constant; added `computeVisibleGroundSpanWu()` accounting for exact `ortho-topdown` (`2 * span`), `diorama-oblique` (`2 * span / sin(pitch)`), and `perspective` (rig ray unprojection) ground footprints.
5. **E — Anchor Settling Fix:**
   - `atlas-three-runtime.ts`: On `damped.settled === true`, always syncs `this.view = damped.next` and `this.targetView = { ...damped.next }` (including `y` in change check) before clearing `this.zoomAnchor = null`.

## Verified Hardware-WebGL Measurements (`WO-5CFNZ` disposable copy + E2E)

- **World overview (`01-world.png`):** 2 continent pins (`Kontinent Westmark`, `Kontinent Ostmark`), zero settlement clutter; uncalibrated `WO-5CFNZ` root honestly shows `~1149 WE` (calibrated default world in E2E shows `~265 km`).
- **Free zoom Südmark countryside (`02-suedmark-free-zoom.png`):** `Ebenen` badge = `Südmark`; `Moorbrück` pin visible on canvas.
- **Free wheel-zoom onto Moorbrück (`03-moorbrueck-free-zoom.png`):** `maxDriftPx = 0.00 px`, `settledDriftPx = 0.00 px` (zooming straight through the Moorbrück pin!), `Ebenen` badge = `Moorbrück`, calibrated HUD = `~3,9 km` (`~1,3 km` at click-focus `07-moorbrueck-click-focus.png`), `dh-atlas-root` / `Westmark` / `Südmark` macro overlay opacity = **`0`** (zero `0.08` ghost!), `clearRootCount = 0`, `ownPerMapTerrainCount = 0`.
- **Ebenen-Drawer Auto-Scroll (`04-moorbrueck-layers-scroll.png`):** `window.scrollY = 0` (zero page scroll), `scrollTop = 307`, active `Moorbrück` node fully inside scroll viewport, `activeFocusForcedToNode = false`; clicking `Dornhain` scrolled cleanly back to `scrollTop = 48`.
- **Click-focus Dornhain (`05-dornhain-click-focus.png`) & Zoom-out (`06-world-zoom-out.png`):** `Ebenen` = `Dornhain`, macro overlays = `0`; free wheel-zoom out to `span = 481.7` restores macro overlays smoothly (`Ostmark = 1.0`, `Westmark = 0.734`, `Südmark = 0.453`).
- **DB integrity:** `dh-map-loc-tavern` rev `39`, `dh-map-place-dornhain` rev `3` unchanged; `pageErrors = 0`.

## Executed Suites

- `node scripts/atlas-camera-anchor.self-test.mjs` — **PASS (10/10)**
- `node scripts/atlas-world-scene-plan.self-test.mjs` — **PASS (6/6)**
- `node scripts/atlas-world-focus.self-test.mjs` — **PASS (7/7)**
- `node scripts/sws-renderer-input-history.self-test.mjs` — **PASS**
- `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/atlas-world-zoom-journey.spec.ts --project=chromium` — **PASS (1/1, 26.7s)**
- `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium` — **PASS (4/4, 22.1s)**
