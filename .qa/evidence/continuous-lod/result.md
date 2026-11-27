# Evidence: EINE Welt — Shared Chunked Terrain + Continuous-LOD Smooth-Zoom

- **Branch:** `feat/atlas-spatial-containment`
- **Captured at:** `2026-11-26`
- **Verification mode:** Host Browser-E2E (`PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium`) + `npm run test-gate`

## 1. Test Results

| Suite | Result | Details |
|---|---|---|
| `scripts/atlas-world-terrain-chunks.self-test.mjs` | **PASS (4/4)** | Shared chunked world heightfield, Visumaxx descriptors (`L<lod>:<gx>:<gz>`, `logicalCells = 64`), zero landmass island slabs, keep-coarse, continuous `detailWeight` crossfade |
| `scripts/atlas-default-world.self-test.mjs` | **PASS (9/9)** | Calibrated default world hierarchy, overlays without duplicate landmasses, Dornhain reference settlement |
| `scripts/atlas-world-scene-plan.self-test.mjs` | **PASS (6/6)** | Keep-coarse focus-path carrier retention, unchanged `sseRefinePx` / `sseCoarsenPx` thresholds |
| `scripts/sws-renderer-input-history.self-test.mjs` | **PASS** | Multi-Map D1–D5, Trackpad E2–E5, 100-cycle 3D Undo/Redo F1–F3 |
| `e2e/scm-spatial-containment.spec.ts` (Host Browser E2E, Chromium) | **PASS (4/4, 19.7s)** | SCM-07 + L-1 WCAG contrast, Phase 1–3 Shared Terrain + Continuous-LOD + Ebenen, M-1 real pointer-drag breach + grow dialog, M-2 SQLite Undo/Redo + soft-cascade |

## 2. Zoom Trace Summary (`zoom-trace.json`)

- **Total intermediate crossfade opacity samples (`0.02 < opacity < 0.96`):** `27`
- **`clearRootCount` across all 11 zoom steps:** `0`
- **`ownPerMapTerrainCount` across all 11 zoom steps:** `0` (ZERO per-continent / per-country / per-place landmass meshes)
- **`terrainCoarseBaseCount` across all 11 zoom steps:** `>= 1` (keep-coarse `L0:0:0` base always mounted)

| Step | Span | Active Terrain Chunks | Max Terrain LOD | Coarse Base | `ownPerMapTerrainCount` | `clearRootCount` | Active Ebenen Label | Depth | Breadcrumb Len |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|
| `world-530` | `530` | `17` | `2` | `1` | `0` | `0` | `Karte · Dornhain` | `1` | `0` |
| `westmark-300` | `300` | `20` | `3` | `1` | `0` | `0` | `Kontinent Westmark` | `2` | `1` |
| `westmark-120` | `120` | `22` | `4` | `1` | `0` | `0` | `Kontinent Westmark` | `2` | `1` |
| `dorn-220` | `220` | `22` | `3` | `1` | `0` | `0` | `Nordreich` | `3` | `2` |
| `dorn-140` | `140` | `20` | `4` | `1` | `0` | `0` | `Nordreich` | `3` | `2` |
| `dorn-80` | `80` | `21` | `5` | `3` | `0` | `0` | `Nordreich` | `3` | `2` |
| `nordreich-25` | `25` | `22` | `6` | `4` | `0` | `0` | `Nordreich` | `3` | `2` |
| `dorn-12` | `12` | `19` | `6` | `4` | `0` | `0` | `Nordreich` | `3` | `2` |
| `dorn-8` | `8` | `10` | `6` | `4` | `0` | `0` | `Dornhain` | `4` | `3` |
| `dorn-5` | `5` | `10` | `6` | `4` | `0` | `0` | `Dornhain` | `4` | `3` |
| `dornhain-2.5` | `2.5` | `6` | `6` | `4` | `0` | `0` | `Dornhain` | `4` | `3` |
| `zoom-out-nordreich-25` | `25` | `22` | `6` | `4` | `0` | `0` | `Nordreich` | `3` | `2` |

### Sampled Crossfade Ramp (Dornhain Enter & Exit)

- `dorn-8`: `dh-map-place-dornhain` enters smoothly (`detailWeight: 0.528`, `opacity: 0.216`)
- `dorn-5`: `dh-map-place-dornhain` ramps (`detailWeight: 1.0`, `opacity: 0.342`)
- `dornhain-2.5`: `dh-map-place-dornhain` settles (`detailWeight: 1.0`, `opacity: 0.919`), ancestors remain mounted (`coarse`, `opacity: 1.0`)
- `zoom-out-nordreich-25`: `dh-map-place-dornhain` fades out smoothly (`exiting: true`, `detailWeight: 0`, `opacity: 0.238`) before disposal

## 3. Visual Evidence Artifacts

- `lod-01-world-span530.png` — Planet overview (`span = 530`): Westmark & Ostmark on ONE shared heightfield (`terrainMaxLod = 2`), Ebenen = `Karte · Dornhain`.
- `lod-02-westmark-span120.png` — Continent zoom (`span = 120`): Westmark relief (`terrainMaxLod = 4`), Ebenen = `Kontinent Westmark`.
- `lod-03-nordreich-span25.png` — Country zoom (`span = 25`): Continuous green terrain fills viewport (ZERO bare ocean + pins), Nordreich political border & settlements on the same ground, Ebenen = `Nordreich`.
- `lod-04-dornhain-span2.5.png` — Settlement zoom (`span = 2.5`): Same continuous ground sampled to LOD 6, Dornhain plaza, fountain, houses, tower, streetlamps, trees & crag sitting cleanly on the terrain, Ebenen = `Dornhain`.
- `lod-05-zoom-out-nordreich.png` — Zoom-out verification (`span = 25`): Clean return to `Nordreich` highlight and continuous ground.
- `zoom-trace.json` — Raw per-step telemetry (chunk counts, LOD levels, opacities, active Ebenen focus).

## 4. Residual Findings & Follow-ups (All Severities)

| Severity | Finding | Status / Note |
|---|---|---|
| Critical | None | — |
| High | None | — |
| Medium | None | — |
| Low | Terrain chunk transitions swap discrete LOD chunk meshes (`L0`..`L6`) with downward skirts rather than GPU vertex geomorphing (`morphFactor`). | Non-blocking; documented in `.qa/design/visumaxx-terrain-chunk-contract.md` for future Visumaxx GPU geomorphing upgrade. |
| Low | At `span = 2.5` (Dornhain), the underlying `81×81` root heightfield + Dornhain overlay uses linear/smoothstep interpolation over `15.6 wu` LOD-6 chunks; fine terrain brushes painted at village scale will benefit from per-chunk delta patches in a future sculpt ticket. | Non-blocking; `AtlasWorldHeightfieldOverlay` already provides the extension seam. |
| Info | `worldRoot` keeps `w.west-core` / `w.east-core` metadata polygons in `rootDoc` solely for `atlas-coast-polygons` contract compatibility, while the 3D Multi-Map renderer skips them whenever `sharedWorldTerrain` is active (`ownPerMapTerrainCount === 0`). | Documented intentional compatibility boundary. |
| Info | Standalone `Dornhain` single-map view preserves its canonical V01 `dataFingerprint` and local `heightfield` for `atl3-v01-visual-contract.self-test.mjs` parity. | Intentional contract invariant. |
