# Composition Gate — atlas-world-zoom-journey

- Feature slug: `atlas-world-zoom-journey`
- HEAD_SHA: `e07188ef8fd3086128f15c2ee31736e669d204d1` (plus final E2E/report commit on `feat/atlas-spatial-containment`)
- BASE_SHA: `0c1f58d0c` (checkpoint `feat(atlas): checkpoint in-world focus and continuous zoom`)
- WORKTREE: Phase A exact projection-anchored cursor zoom + Phase B continuous logarithmic pitch & truthful scale HUD + Phase C Visumaxx/V8 terrain/water/shadow/scatter visual pass + edit-badge owner lock + Phone/Tablet AU fixes; pre-existing unrelated backend/bootstrap edits excluded
- Date: 2026-11-27
- Verdict: **SKIPPED** (verified: zero new backend, persistence, API, service, or migration hops introduced)
- Acceptance tier: hardware-WebGL browser + intermediate-frame cursor-anchor & visual pass verified (see `.qa/runs/atlas-camera-visual-pass.md`)

## Skip reason

Pure frontend domain, Three.js infrastructure renderer, and workstation UI composition only. No new backend route, host service, database table, SQLite migration, or persistence write path was added or altered. Navigation, zooming, focusing, and returning from single-map edit remain 100% read-only (verified on disposable `WO-5CFNZ` copy: `dh-map-loc-tavern` rev `39`, `dh-map-place-dornhain` rev `3`). Pre-existing unrelated working-tree edits (`server/src/bootstrap/ensure-dornhain-default.ts`, `scripts/atl2-a03-cold-bootstrap.self-test.mjs`) remain untouched and uncommitted.

## Event

1. User scrolls/pinches/clicks zoom buttons anywhere on the canvas (off-center terrain hill, village, building, oblique yaw/pitch, ortho-topdown, Desktop/Tablet/Phone).
2. User focuses a located WorldNode (`Welt → Westmark → Nordreich → Dornhain → Taverne Zum Flüstern → Schankraum`) or explicitly opens a child map for editing and returns without saving.

## Hop chain

1. **Producer:** existing Host atlas map read (`useWorldAtlasEditor`) — unchanged.
2. **Domain:** `atlas-map-pins.ts` (shallowest owner resolution), `atlas-world-focus.ts` (target framing span), `atlas-scene-scatter.ts` (organic deterministic suggestive grove) — pure TypeScript, zero React/Three/Host.
3. **Infrastructure Renderer:** `atlas-three-camera.ts` (exact 3D projection anchor solver, `C¹` logarithmic pitch curve, truthful scale HUD), `atlas-three-runtime.ts` (3D surface/terrain raycast picking, intermediate-frame anchored damping, heightfield bathymetry water shader, dynamic tight 2048px PCF shadows), `atlas-three-world-terrain.ts` (tri-scale world-space procedural PBR material, cross-chunk analytical normals, 128×128 bathymetry texture), `atlas-three-multimap.ts` (flush indoor elevation grounding) — single productive Three.js engine, zero `clearRoot()`, `ownPerMapTerrainCount === 0`.
4. **UI/Workstation:** `WorldAtlasWorkbench.tsx` + `AtlasThreeWorkstation.tsx` — edit-mode `Ebenen` badge locked to active document owner, zoom buttons unified with anchored zoom, Phone bottom taskbar clears mobile shell nav, Tablet topbar yields when `Ebenen` drawer is open.
5. **Consumer:** same owner-operated editor; zero unintended DB writes.

## Simulations

| Case | Intended | Composed | Result |
|---|---|---|---|
| Cursor-anchored zoom IN/OUT | 3D terrain/surface point stays pinned under cursor across ALL intermediate RAF frames & settled | `pickWorldPointAtScreen` + `solveAnchoredCameraFocus` + per-frame anchored `dampAtlasThreeView` | **PASS** (`193.21 px → 0.00 px` IN, `28.83 px → 0.00 px` OUT) |
| Oblique Perspective + Yaw + Ortho | Anchor stays pinned under rotated yaw (`-0.85`), perspective, ortho (`π/2`), Tablet & Phone | Exact rig projection/unprojection solver with elevated-anchor eye guard | **PASS** (`37.56 px → 0.00 px` Persp, `0.00 px` Ortho, `0.01 px` Tablet, `0.00 px` Phone) |
| Continuous Pitch & Scale HUD | Smooth `C¹` pitch across `0.10..1200` + truthful physical scale readout (no fake `2500%`) | `autoAtlasThreePitchForSpan` + `formatAtlasTruthfulScaleHud` | **PASS** (`~1330 km → ~9,2 km → ~840 m → ~420 m`) |
| Active document label in Edit | Dornhain stays `Dornhain` in `Ebenen` badge during explicit edit | Shallowest `atlasMapOwnerPlace` + edit-mode `activeDocMapId` lock | **PASS** (12/12 ticks = `Dornhain`, previously Medium open) |
| Visual Terrain / Coast / Shadows / Interior | Seamless shared terrain, real coastline bathymetry, crisp PCF shadows, flush tavern interior, organic grove | Tri-scale world PBR + cross-chunk normals + bathymetry water + tight shadow frustum + flush `multiMapDepthLiftY` | **PASS** (`62–83` draw calls, `76.9k–84.2k` tris, zero chunk seams) |
| Mobile & Tablet AU Layout | Bottom zoom bar clears Phone shell nav; Tablet topbar hidden behind open drawer | `bottom-16 sm:bottom-3` + `hidden lg:flex` when `layersOpen` | **PASS** (verified in `after-06-phone.png` & `after-06-tablet.png`) |

## Flags

| Tag | Severity | Hops | Status | Notes |
|---|---|---|---|---|
| Edit label drift | Medium | Domain → UI | **CLOSED** | Fixed via shallowest `atlasMapOwnerPlace` + edit-mode `activeDocMapId` lock (`atlas-camera-anchor.self-test` + `e2e/atlas-world-zoom-journey.spec.ts`) |
| Camera/scale/visual continuity | Medium | Camera → Renderer | **CLOSED** | Fixed via exact projection-anchored zoom (`0.00 px` drift across intermediate frames), `C¹` pitch, truthful scale HUD, and Phase C visual pass |
| Terrain LOD vertex geomorphing | Low | Renderer | **OPEN (documented)** | Analytical cross-chunk normals + downward skirts remove visible seams (`0` grey lines); continuous vertex-height geomorphing remains a future GPU-shader enhancement |
| Metal `texImage3D` console warning | Low | WebGL runtime | **OPEN (pre-existing)** | Pre-existing Three.js/Metal `FLIP_Y`/`PREMULTIPLY_ALPHA` warning; not suppressed, zero functional impact |
| ATL3-R05 / Q01 / ATL4 scope gates | Info | Release governance | **OPEN (out of scope)** | ADR-ST-11 GO passed; tablet/phone hardware R05 (#1270), Q01 (#1300) and ATL4 (#1308/#1310) remain separate epics |
