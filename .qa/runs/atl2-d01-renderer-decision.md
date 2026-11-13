# ATL2-D01 — Renderer decision

- Issue: #1212
- HEAD: `d191da96a88b30278e67856f09b6975caac0a81a`
- Verdict: **CLEAR**
- Date: 2026-11-13

## Decision

- **Target:** `custom-webgl-prototype-runtime`
- Product host: `AtlasNative3dEditor` → `atlas-prototype-runtime.mjs`
- Parallel Three `AtlasSpatialViewport`: inventory only (not mounted in product chrome)

## Golden bridge parity

- objects/rooms/walls/strokes: **11/19/0/4**
- ID-preserving canvas→webgl→canvas: **yes**
- Bridge wall-clock: **0.684 ms**

## Graphics presets

| Preset | Locked |
|--------|--------|
| high | yes |
| balanced | yes |
| lite | yes |

## Historical PoC

- Archived Hybrid vs Unified-Three comparison retained under research/
- Does **not** reopen a second product engine

## Residuals

- **Low**: Interactive FPS/draw-call soak on device matrix — Structural Lite3D + preset contracts locked; device soak deferred to Gate D / #1218.

## Decision line

Phase D hardens **custom-webgl-prototype-runtime**. SpatialViewport retirement tracked for cleanup (#1234 / Gate H).
