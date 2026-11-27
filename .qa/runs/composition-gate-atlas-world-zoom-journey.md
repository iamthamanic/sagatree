# Composition Gate — atlas-world-zoom-journey

- Feature slug: `atlas-world-zoom-journey`
- HEAD_SHA: 99dc17e46a1299276ac5b4145b21de28d0efba4e
- BASE_SHA: 1490c7854b7d6ee45fdb3cccdaefe73f7d27574c
- WORKTREE: `feat/atlas-spatial-containment` — Scale-aware macro-deco separation, unified World-Space pins, live focus-chain protection, Ebenen-Drawer auto-scroll, calibrated Scale HUD, `zoomAnchor` settling, plus PR #1331 Codex & Kody review fixes (shared `writeQueueRef` serializing autosave + SCM persistence with `syncCanvasDocSilently` + concurrent-edit preservation in `persistMapMeta`, composed ancestor shear guard, oriented replacement cutouts, preserved oriented `polygonWorld` corners, `deleteMap` anchor protection, numeric `centerX`/`centerY` validation, edge-clamped object `size` preservation, 4-corner local object containment projection, wall/door cutout clipping, oriented terrain overlay sampling)
- Date: 2026-11-27
- Verdict: CLEAR
- Acceptance tier: hardware-WebGL browser E2E (`atlas-world-zoom-journey.spec.ts` 1/1, `scm-spatial-containment.spec.ts` 4/4), `sws-write-guards.self-test` (19/19), `scm-invariants.self-test` (11/11), `scm-propagation.self-test` (5/5), `atlas-camera-anchor.self-test` (10/10), `npm run lint`, `npm run typecheck`, and full `npm run test-gate` verified (see `.qa/runs/atlas-scale-labels-pass.md`)
- Deferred integration: None for this pass (`5c7cab392..95d795058` introduced zero new backend, persistence, API, or migration hops); tablet/phone native hardware R05 (#1270), Q01 (#1300), and ATL4 biome-painting persistence (#1308/#1310) remain separate follow-up epics

## Event

1. User scrolls/pinches/clicks zoom buttons anywhere on the Atlas 3D canvas — including while hovering map pin labels — or focuses any located continent, country, settlement (Moorbrück, Dornhain), building, dungeon, or room.
2. User opens the `Ebenen` drawer after free wheel-zooming into Moorbrück or Dornhain, switches camera projections (`Diorama`, `Satellit`, `Perspektive`), or performs SCM edits (`M-1` drag with pin overlay yielding to edit tools).

## Hop chain

1. **Producer:** existing Host atlas map read/write routes (`useWorldAtlasEditor` + `worldAtlasService.upsertMap` with optimistic revision checks) — unchanged by commits `5c7cab392..95d795058`.
2. **Domain:** `atlas-map-pins.ts` (`buildAtlasWorldPins` + shallowest owner), `atlas-label-hierarchy.ts` (projection-driven world label hierarchy + locked focused pin), `atlas-world-scene-plan.ts` (live camera focus chain priority over stale off-screen targets + `resolveWorldCalibrationMetersPerUnit`), `map-frame.ts` (`extractMapCalibrationMetersPerUnit`) — pure TypeScript, zero React/Three/Host.
3. **Infrastructure Renderer:** `atlas-three-scene.ts` (cartographic macro markers on `depth 1..3`, slim macro routes/rivers, zero macro giant scatter), `atlas-three-multimap.ts` (2-channel `macroOverlayOpacity` → `0` + `waterOpacity` river handoff), `atlas-three-camera.ts` (`computeVisibleGroundSpanWu` + calibrated/uncalibrated truthful `formatAtlasTruthfulScaleHud`), `atlas-three-runtime.ts` (ground-anchored pin projection with `projectedSpanPx`, `damped.settled` full `view`/`targetView`/`y` sync before clearing `zoomAnchor`) — single productive Three.js engine, zero `clearRoot()`, `ownPerMapTerrainCount === 0`.
4. **UI/Workstation:** `WorldAtlasWorkbench.tsx` + `UnifiedAtlasEditor.tsx` + `AtlasNative3dEditor.tsx` + `AtlasThreeWorkstation.tsx` — unified World-Space pins, `stageRef` wheel passthrough over pins, `pointer-events-none` on pins during edit tools, container-only `Ebenen` drawer auto-scroll (`window.scrollY === 0`), calibrated Scale HUD.
5. **Consumer:** owner-scoped Atlas editor; navigation, zooming, focusing, and drawer scrolling remain 100% read-only (`WO-5CFNZ` disposable copy verified: `dh-map-loc-tavern` rev `39`, `dh-map-place-dornhain` rev `3`).

## Simulations

| Case | Intended | Composed | Result |
|---|---|---|---|
| N-actors | Concurrent owner-scoped reads/zooms vs explicit map edits never cross-contaminate owner state or mutate during navigation | Host Policy Service + owner-scoped world atlas reads; pure client camera/zoom/pin/scroll state (`WO-5CFNZ` rev `39`/`3` unchanged after full zoom+focus+scroll run) | **PASS** |
| Invalid/missing | Unlocated maps, uncalibrated worlds (`metersPerUnit === null`), stale off-screen `focusTargetMapId`, or jsdom missing layout geometry degrade honestly without inventing geography or meters | `buildAtlasWorldPins` omits unlocated maps; `formatAtlasTruthfulScaleHud` shows `WE · unkalibriert` (zero fake `m`/`km`); `buildAtlasWorldScenePlan` prioritizes live focus chain over stale off-screen targets; defensive scroll fallback | **PASS** |
| Two consumers / crash | Reload or abrupt disconnect mid-zoom/mid-edit leaves SQLite clean and restores world/camera cleanly on reload | Camera/LOD/pin/drawer scroll are ephemeral client state; explicit edit commits remain atomic via existing host `upsertMap` revision checks; `clearRootCount: 0` | **PASS** |
| Macro deco separation & river handoff | Zero giant macro houses/trees and zero `0.08` ghost opacity at Dornhain/Moorbrück; slim carrier river hands off to calibrated local river; inverse zoom-out restores macro markers | `emitMacroLandmarkMarker` + `computeMacroOverlayTargetOpacity === 0` + `computeMacroWaterTargetOpacity` + `mesh.visible` gating | **PASS** (`03`/`05`/`06`/`07` screenshots + `atlas-camera-anchor.self-test`) |
| Moorbrück world-space pin & honest focus | World overview shows continents only; Südmark countryside reports `Südmark` + shows `Moorbrück` pin; free wheel zoom (through pin!) activates `Moorbrück` with `< 2 px` drift | `buildAtlasWorldPins` + `stageRef` wheel passthrough + projection-driven `computeAtlasPinZoomPresentation` + live focus chain priority | **PASS** (`0.00 px` drift, `atlas-world-zoom-journey.spec.ts` 1/1) |
| Ebenen-Drawer auto-scroll | Opening drawer or changing active place scrolls only `[data-atlas-layers-scroll]` to active node with zero page scroll and no forced keyboard focus | Container-only `block: 'nearest'` `scrollTop` effect gated on drawer open / `activePlaceId` change | **PASS** (`window.scrollY = 0`, `scrollTop = 307 → 48`, `activeFocusForcedToNode = false`) |
| Calibrated Scale HUD & Anchor Settling | Exact values against `250 m/WE` / active child calibration + camera projection geometry; uncalibrated never claims `m`/`km`; `damped.settled` syncs `view` + `targetView` (incl. `y`) before clearing `zoomAnchor` | `extractMapCalibrationMetersPerUnit` + `resolveWorldCalibrationMetersPerUnit` + `computeVisibleGroundSpanWu` + runtime settle fix | **PASS** (`atlas-camera-anchor.self-test` 10/10 + `WO-5CFNZ` `~1149 WE` uncal / `~1,3 km` Moorbrück cal) |

## Flags

| Tag | Severity | Hops | Status | Notes |
|---|---|---|---|---|
| Macro giant props & `0.08` ghost geometry | High | Renderer | **CLOSED** | Replaced macro props on `depth 1..3` with compact cartographic medallions; macro non-water opacity reaches exact `0` |
| Missing World-Space pins (Moorbrück) & wheel blocked by pins | High | Domain → UI | **CLOSED** | Unified `buildAtlasWorldPins` + projection-driven hierarchy + `stageRef` wheel passthrough + edit-tool `pointer-events-none` |
| Stale off-screen `focusTargetMapId` starving Südmark/Moorbrück | Medium | Domain → Runtime | **CLOSED** | Live camera focus chain prioritized over off-screen requested target; pan clears `focusTargetMapId` unconditionally |
| Invented `1250 m` Scale HUD & `zoomAnchor` settle desync | Medium | Camera → Runtime | **CLOSED** | Real calibration extraction + projection-aware ground span + unconditional `view`/`targetView` settle sync including `y` |
| Ebenen-Drawer auto-scroll missing | Low | UI | **CLOSED** | Container-only `block: 'nearest'` scroll on open / active place change |
| Sparse terrain surroundings outside `4×4` settlement perimeter | Info | Product design | **OPEN (intentional)** | Surrounding countryside stays clean shared terrain without artificial giant macro trees per owner decision |
| Terrain LOD vertex geomorphing | Low | Renderer | **OPEN (documented)** | Analytical cross-chunk normals + downward skirts remove visible seams; GPU vertex geomorphing remains a future enhancement |
| macOS Metal `texImage3D` console warning | Low | WebGL runtime | **OPEN (pre-existing)** | Pre-existing Three.js/Metal `FLIP_Y`/`PREMULTIPLY_ALPHA` warning; not suppressed, zero functional impact |
| ATL3-R05 / Q01 / ATL4 scope gates | Info | Release governance | **OPEN (out of scope)** | Real-device tablet/phone hardware R05 (#1270), Q01 (#1300) and ATL4 (#1308/#1310) remain separate epics |
