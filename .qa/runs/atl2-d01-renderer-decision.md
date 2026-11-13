# ATL2-D01 — Renderer decision

- Issue: #1212
- HEAD: `2dd32e15dc65217bcfbfb2d1375ba296312275e3`
- Verdict: **CLEAR**
- Date: 2026-11-13

## Decision

- **Target:** `custom-webgl-prototype-runtime`
- Product host: `AtlasNative3dEditor` → `atlas-prototype-runtime.mjs`
- Parallel Three `AtlasSpatialViewport`: inventory only (not mounted in product chrome)

## Golden bridge parity

- objects/rooms/walls/strokes: **11/19/0/4**
- ID-preserving canvas→webgl→canvas: **yes**
- Bridge wall-clock: **0.794 ms**

## Graphics presets

| Preset | Locked | Wired into Native3d mount |
|--------|--------|---------------------------|
| high | yes | yes |
| balanced | yes | yes |
| lite | yes | yes |

## Imagination-First (IV)

- IV-01 / IV-07 / IV-09 / IV-18: acceptance checklist + controlled productMap path asserted

## Historical PoC

- Archived Hybrid vs Unified-Three comparison retained under research/
- Does **not** reopen a second product engine

## Residuals

- **Low**: Interactive FPS/draw-call soak on device matrix — Structural Lite3D + preset contracts locked; device soak deferred to Gate D / #1218.

## Decision line

Phase D hardens **custom-webgl-prototype-runtime**. SpatialViewport retirement tracked for cleanup (#1234 / Gate H).
