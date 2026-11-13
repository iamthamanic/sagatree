# ATL2-D01 — Productive 3D renderer decision

**Issue:** #1212  
**Slug:** `atl2-d01`  
**Date:** 2026-11-13

## Candidates

| Id | Module | Product chrome today |
|----|--------|----------------------|
| `custom-webgl-prototype-runtime` | `atlas-prototype-runtime.mjs` via `AtlasNative3dEditor` | **Yes** (controlled seed/persist) |
| `three-spatial-viewport` | `AtlasSpatialViewport.tsx` | No (barrel export only) |
| `unified-three-poc` | `.qa/evidence/unified-atlas-renderer-poc/` | Historical PoC only |

## Golden / tool parity (measured in self-test)

- Dornhain Golden `UnifiedCanvasDoc` → `syncCanvasDocIntoWebglRuntime` →
  `syncWebglPropsIntoCanvasDoc` preserves object/room/wall/stroke **counts** and
  prop **ids** (stamp-aware bridge).
- Product editor source mounts `AtlasNative3dEditor`; does **not** import
  `AtlasSpatialViewport`.
- Runtime source contains `AtlasGL` (WebGL) and `AtlasLite3D` (software fallback).

Historical Hybrid vs Unified-Three PoC (2026-10-17) remains archived under
`.qa/research/unified-atlas-renderer-comparison.md` — frame cost was within noise;
it does **not** justify swapping the live product custom-WebGL path.

## Decision

**Target:** `custom-webgl-prototype-runtime` (`ATLAS_PRODUCT_3D_TARGET`).

### Why

1. Sole productive 3D path already wired for Golden hierarchy, product nav, tool
   registry, and controlled `generator_meta` persist (#721/#747/#750).
2. `AtlasSpatialViewport` is unused in product chrome — adopting it as a second
   path would violate the single-engine rule from ATL2-A01.
3. Full Unified-Three rewrite has no measured FPS/heap win that offsets brush/LOD
   /nav port risk after Gate C.

### Explicit non-goals this ticket

- No second parallel engine in product UI.
- No WebGL→Three swap in D01 (Phase D hardens the chosen target instead).

## Parity / ablöse plan (Phase D)

| Step | Issue | Action |
|------|-------|--------|
| D02+ | #1213–#1217 | Terrain/materials/camera on **custom WebGL** target only |
| Gate D | #1218 | Browser evidence on chosen target |
| Cleanup | #1234 / Gate H | Retire or quarantine `AtlasSpatialViewport` if still unused |

## Rollback

- 2D Draufsicht remains the authoritative authoring surface (Gate C).
- 3D can fall back to read-only controlled seed if mutation regresses.
- Do **not** re-enable SpatialViewport as product chrome during rollback.

## Graphics presets (degradable)

| Preset | max DPR | Software fallback |
|--------|---------|-------------------|
| high | 2 | no |
| balanced | 1.5 | no |
| lite | 1 | prefer AtlasLite3D |

Domain API: `resolveAtlasGraphicsPreset` / `clampAtlasPixelRatio` in
`atlas-renderer-target.ts`. Runtime already activates `AtlasLite3D` when WebGL
construction throws.
