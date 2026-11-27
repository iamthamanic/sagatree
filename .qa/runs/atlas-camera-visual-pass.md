# Atlas Cursor-Anchored Camera, Continuous Pitch & Visumaxx/V8 Visual Pass Report

**Date:** 2026-11-27  
**Branch:** `feat/atlas-spatial-containment`  
**Base Checkpoint:** `0c1f58d0c` (`feat(atlas): checkpoint in-world focus and continuous zoom`)  
**Hardware Renderer:** `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)` (true hardware WebGL, non-SwiftShader)  
**Data Safety:** Live `.data/host.sqlite*`, `server/.sagatree-data/`, and `/tmp/sagatree-recovery-staging-solo-wo5cfnz/` were never modified. Every staging probe ran on a disposable temp copy deleted in `finally`. Verified `dh-map-loc-tavern` rev `39` and `dh-map-place-dornhain` rev `3` unchanged. Pre-existing unrelated working-tree edits (`server/src/bootstrap/ensure-dornhain-default.ts`, `scripts/atl2-a03-cold-bootstrap.self-test.mjs`) were untouched and excluded from all commits.

---

## 1. Root Cause Analysis of Previous Camera Drift (Measured Baseline `0c1f58d0c`)

Running the hardware-WebGL baseline probe against `0c1f58d0c` (`.qa/evidence/atlas-camera-visual-pass/before-anchor-trace.json`) proved **five compounding defects** causing **`193.21 px`** cursor drift when zooming toward Dornhain and **`37.56 px`** drift in rotated Perspective mode:

1. **Flat `y = activeY` ground-plane raycast (`screenToGround`):** Intersected a horizontal plane at the *camera center's* ground height instead of the actual 3D terrain/building surface under the cursor, introducing a horizontal parallax error of $\Delta h / \tan(\text{pitch})$ whenever the cursor pointed at hills or elevated structures.
2. **Naive 2D planar scale formula (`nextX = before.x + (targetView.x - before.x) * ratio`):** Ignored simultaneous changes in `pitchRad`, perspective foreshortening, terrain elevation `y`, and mixed `this.view` (used by `this.camera`) with `this.targetView` during rapid wheel input.
3. **Non-linear `eyeLift = Math.min(5, view.span * 0.12)` kink in `buildAtlasThreeCameraRig`:** Silently bent the effective pitch angle below `span = 41.6`, breaking geometric projection consistency.
4. **Linear `(x, z)` vs. logarithmic `span` damping (`dampAtlasThreeView`):** Even with an exact target endpoint, damping `(x, z)` linearly while damping `span` logarithmically caused the world point under the cursor to bow away from the cursor across every intermediate frame (`28.83 px` bow even on zoom-out).
5. **Disconnected `+/-` zoom buttons & flat pitch floor:** `zoomByFactor` called raw `rt.setView({ span })` instead of the cursor-anchored zoom path; `autoAtlasThreePitchForSpan` clamped flat below `span = 65`; and the HUD clamped zoom readout at a misleading `2500%` for Dornhain, Taverne, and Schankraum alike.

Additionally, the previously open Medium **`Ebenen` edit-badge drift** (`Whisper Road` / `Marktplatz` / `Krypta unter dem Hügel` during Dornhain edit) was isolated to two spots: `atlasMapOwnerPlace` (`src/domains/world/atlas/atlas-map-pins.ts`) and `WorldAtlasWorkbench.tsx` selected the *first* place in arbitrary DB order sharing `usage === 'primary'` on `dh-map-place-dornhain`, and `AtlasThreeWorkstation.tsx` did not lock `deriveZoomLayerHierarchyState` to `activeDocMapId` in explicit single-document edit mode.

---

## 2. Cursor-Anchor Stability Measurements (Before `0c1f58d0c` vs. After)

Evidence: `.qa/evidence/atlas-camera-visual-pass/before-anchor-trace.json` & `.qa/evidence/atlas-camera-visual-pass/after-anchor-trace.json`

| Scenario (Hardware Metal WebGL, real `mouse.wheel` + intermediate RAF sampling) | Span Range | Before Max Intermediate Drift | Before Settled Drift | After Max Intermediate Drift | After Settled Drift |
|---|---:|---:|---:|---:|---:|
| **Diorama Zoom IN → Dornhain (off-center, yaw `0.42`, 12 steps / 36 RAF samples)** | `477.4 → 35.6` | `182.37 px` | `193.21 px` | **`0.00 px`** | **`0.00 px`** |
| **Diorama Zoom OUT ← Dornhain (8 steps / 24 RAF samples)** | `39.5 → 215.5` | `28.83 px` | `2.70 px` | **`0.00 px`** | **`0.00 px`** |
| **Perspective + Rotated Yaw (`-0.85`) over hilly terrain (8 steps)** | `236.9 → 52.5` | `34.71 px` | `37.56 px` | **`0.00 px`** | **`0.00 px`** |
| **Ortho-Topdown (`Draufsicht`, yaw `0.35`, pitch `π/2`, 6 steps)** | `288.2 → 83.0` | *(not triggered pre-fix)* | *(n/a)* | **`0.00 px`** | **`0.00 px`** |
| **Tablet (`768×1024`) off-center Diorama zoom (5 steps)** | `240 → ~115` | *(n/a)* | *(n/a)* | **`0.01 px`** | **`0.01 px`** |
| **Phone (`390×844`) off-center Diorama zoom (5 steps)** | `240 → ~115` | *(n/a)* | *(n/a)* | **`0.00 px`** | **`0.00 px`** |

**Continuous Pitch & Truthful Scale HUD (Phase B):**
- World (`span 530`): `pitchRad = 1.174` (~67.3°), HUD = `~1330 km` (`Z1.9`)
- Dornhain (`span 3.68`): `pitchRad = 0.781` (~44.7°), HUD = `~9,2 km` (`Z9.1`)
- Taverne (`span 0.335`): `pitchRad = 0.974` (~55.8° cutaway angle), HUD = `~840 m` (`Z12.6`)
- Schankraum (`span 0.167`): `pitchRad = 1.020` (~58.4° cutaway angle), HUD = `~420 m` (`Z13.6`)

---

## 3. Before vs. After Visual Evidence & Frame Sequences

All captures stored in `.qa/evidence/atlas-camera-visual-pass/`:
- **World Overview:** `before-01-world.png` → `after-01-world.png` (heightfield-driven turquoise coastline bathymetry & subtle animated surf along real continent coasts; stray ocean-floating tower removed; tri-scale mottled meadow/forest terrain; truthful `~1330 km` scale HUD).
- **Zoom-In Frame Sequence (Diorama → Dornhain):** `before-zoom-dornhain-in-step-00..10.png` vs. `after-zoom-dornhain-in-step-00..10.png` (zero cursor drift across all intermediate frames; smooth coastline bathymetry & zero chunk-border grey lines).
- **Dornhain Settlement:** `before-02-dornhain.png` → `after-02-dornhain.png` (seamless analytical cross-chunk normals with zero chunk seams, dynamic scale-tight 2048px PCF shadows on trees & buildings, organic undulating perimeter grove replacing hard rectangle, high-contrast `Ebenen` hover badge, truthful `~9,2 km` HUD).
- **Taverne Zum Flüstern & Schankraum:** `before-03-tavern.png` / `before-04-schankraum.png` → `after-03-tavern.png` / `after-04-schankraum.png` (cobblestone texel density tightened `48 → 20`, indoor floor grounded flush inside Dornhain's cutaway stone walls via `multiMapDepthLiftY`, steeper readable cutaway pitch `0.974 / 1.020`, real rev-39 user edits intact).
- **Dornhain Single-Map Edit & Adaptive Viewports:** `after-05-edit-dornhain.png` (`editBadgeSamples`: 12/12 = `"Dornhain"`), `after-06-tablet.png` (open `Ebenen` drawer unobstructed, zero peeking topbar), `after-06-phone.png` (compact bottom zoom bar cleanly above Phone shell nav, zero clipping).

---

## 4. Performance & GPU Resource Telemetry (Hardware Metal WebGL)

| View | Draw Calls (V01 Budget ≤ 150) | Triangles (V01 Budget ≤ 500,000) | Active Maps | Terrain Chunks / Live Geos | `clearRootCount` | `ownPerMapTerrainCount` |
|---|---:|---:|---:|---:|---:|---:|
| **World Overview (`span 530`)** | `62` | `76,904` | `3` | `17` (max LOD `2`) | `0` | `0` |
| **Dornhain (`span 3.68`)** | `73` | `84,216` | `4` | `8` (max LOD `6`) | `0` | `0` |
| **Taverne (`span 0.335`)** | `83` | `76,902` | `6` | `5` (max LOD `6`) | `0` | `0` |
| **Schankraum (`span 0.167`)** | `79` | `76,734` | `6` | `5` (max LOD `6`) | `0` | `0` |

Clean GPU disposal verified for `AtlasThreeWorldTerrain` (`chunks`, `heightTex`, `enhancedMaterial`) and `AtlasThreeMultiMapGraph` (`geometries`, cloned `materials`).

---

## 5. Atomic Commits & Changed Files

1. **`ecce0bcf3`** — `feat(atlas): exact projection-anchored zoom, continuous pitch curve and edit badge lock`
   - `src/infrastructure/world/atlas-three/atlas-three-camera.ts`
   - `src/infrastructure/world/atlas-three/atlas-three-runtime.ts`
   - `src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts`
   - `src/infrastructure/world/atlas-three/atlas-unified-input.ts`
   - `src/infrastructure/world/atlas-three/index.ts`
   - `src/domains/world/atlas/atlas-map-pins.ts`
   - `src/domains/world/atlas/atlas-world-focus.ts`
   - `src/app/world/atlas/WorldAtlasWorkbench.tsx`
   - `src/app/world/atlas/unified/AtlasThreeWorkstation.tsx`
   - `scripts/atlas-camera-anchor.self-test.mjs` *(new, wired into `scripts/test-gate.mjs`)*
2. **`e07188ef8`** — `feat(atlas): visumaxx/v8 triscale terrain, coastline bathymetry, tight PCF shadows and organic scatter`
   - `src/infrastructure/world/atlas-three/atlas-three-scene.ts`
   - `src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts`
   - `src/infrastructure/world/atlas-three/atlas-three-runtime.ts`
   - `src/infrastructure/world/atlas-three/atlas-three-multimap.ts`
   - `src/domains/world/atlas/atlas-scene-scatter.ts`
   - `src/app/world/atlas/unified/AtlasThreeWorkstation.tsx`
3. **Commit 3 (tests, contracts & evidence)** — `test(atlas): cursor-anchor E2E, contract refresh and camera/visual pass evidence`
   - `src/app/world/atlas/unified/AtlasThreeWorkstation.tsx` (TS non-strict `'reasonDe' in resolved` narrowing)
   - `e2e/atlas-world-zoom-journey.spec.ts` (extended with `< 2 px` cursor-anchor assertions across Diorama IN/OUT, Perspective+Yaw, Ortho, Phone, Tablet, truthful scale HUD & edit-badge lock)
   - `.qa/intake/edge-infra-contracts/*`, `.qa/evidence/stack-migration-prep/completion/mig-002.json`
   - `.qa/evidence/atlas-camera-visual-pass/*`, `.qa/runs/atlas-camera-visual-pass.md`, `.qa/runs/composition-gate-atlas-world-zoom-journey.md`

---

## 6. Executed Verification Commands (Strictly Sequential)

| Step | Command | Result |
|---|---|---|
| 1 | `node scripts/atlas-camera-anchor.self-test.mjs` | **PASS (7/7)** — `< 0.1 px` cursor anchor across all 3 camera modes & sloping hills, `C¹` pitch, truthful scale HUD, wheel clamping, shallowest owner |
| 2 | `node /.../scratch/camera-visual-probe.mjs --phase=after` | **PASS** — `0.00 px` Desktop/Phone drift, `0.01 px` Tablet drift, `0` pageerrors, `12/12` `"Dornhain"` edit badge, `tavernRev: 39`, `dornhainRev: 3` |
| 3 | `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/atlas-world-zoom-journey.spec.ts --project=chromium` | **PASS (1/1, 22.5s)** — Journeys 1–5 + `< 2 px` intermediate/settled cursor anchor + Phone/Tablet AU + edit badge lock |
| 4 | `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium` | **PASS (4/4, 19.0s)** — full SCM + Continuous-LOD + Shared Chunked Terrain regression suite |
| 5 | `npm run test-gate` | **PASS** — `lint` (45 TS files), `typecheck` (45 TS files), `vite build` (5647 modules), `architecture-boundary-check`, all SWS/SCM/atlas/host/security self-tests, secrets scan, dep audit |

---

## 7. Findings Table (All Severities — Full Disclosure)

| Severity | Area | Finding & Status |
|---|---|---|
| **Critical** | — | None open. |
| **High** | — | None open. |
| **Medium** | — | None open. (Previously open Medium findings — 193 px cursor drift, flat pitch/fake 2500% HUD, terrain chunk seam artifacts, floating tavern floor, and Dornhain edit-mode `Ebenen` badge drift — are all resolved and verified.) |
| **Low** | Terrain LOD Vertex Geomorphing (`atlas-three-world-terrain.ts`) | Cross-chunk analytical normals and downward skirts eliminate visible seams/cracks between adjacent LOD chunks (`0` grey grid lines), and chunks mount incrementally with `clearRootCount === 0`. However, continuous vertex-height geomorphing (interpolating fine-grid vertices toward coarse parent heights as a function of camera distance) is not implemented; subtle silhouette refinement remains possible on steep ridge transitions during rapid zoom. Non-blocking; cleanly preparable inside `atlas-three-world-terrain.ts` without domain/app changes. |
| **Low** | World-Heightfield Continent Silhouette Granularity (`WO-5CFNZ` / `atlas-default-world.ts`) | The heightfield bathymetry water shader (`WATER_FRAGMENT`) now hugs the real continent coastline with turquoise shallows and animated surf, but the underlying stored world heightfield in `WO-5CFNZ` has relatively coarse cell spacing around Westmark/Ostmark, so continent outlines still retain some polygonal facets at mid-continent zoom (`after-zoom-dornhain-in-step-08.png`). Improving silhouette resolution requires higher-resolution heightfield data or domain-level coastline noise (intentionally not altered here to preserve existing user worlds & Golden fingerprints). |
| **Low** | Three.js / Metal WebGL Console Warning | Chromium on Apple Metal continues to emit the pre-existing `WebGL: INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA...` warning during Three.js texture/environment setup, plus one expected unauthenticated `401` probe prior to login. Not suppressed; `0` `pageerror`s and zero visual or functional defect. |
| **Low** | Mobile & Tablet Polish (Closed Items Verified) | Both prior Low AU items — Phone bottom zoom bar overlapping mobile shell nav (`bottom-16 sm:bottom-3`) and Tablet topbar peeking behind open `Ebenen` drawer (`hidden lg:flex`) — are now **FIXED** and visually confirmed in `after-06-phone.png` and `after-06-tablet.png`. |
| **Info** | ATL3/ATL4 Epic Blockers & Conscious Exclusions | Per ADR-ST-11 (`#1296`), both GO gates passed on 2026-11-25, but R05 (`#1270`, hardware tablet/phone tier acceptance) and ATL3-Q01 (`#1300`, independent retirement gate) remain open; Custom WebGL / `AtlasLite3D` fallback remains intact. `#1308` (ATL4 Worldbuilding), `#1310` (Biome Painting), and `#1327` canonical Golden data rewrites were consciously excluded from this pass. |
| **Info** | Unrelated Working-Tree Files Untouched | Pre-existing uncommitted edits (`server/src/bootstrap/ensure-dornhain-default.ts`, `scripts/atl2-a03-cold-bootstrap.self-test.mjs`, `.data/`, `server/.sagatree-data/`, and unrelated `.qa/fixtures/**` / `.qa/runs/**` touched by other `test-gate` suites) were not modified or committed. |
