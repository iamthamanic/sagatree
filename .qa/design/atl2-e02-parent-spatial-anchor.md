# ATL2-E02 — ParentSpatialAnchor / locate / calibration

**Issue:** #1220  
**Slug:** `atl2-e02`  
**Depends:** #1219

## Purpose

Consolidate parent-space placement of child primary maps: locate rect →
`ParentSpatialAnchor`, optional meters calibration, invertible World↔Child
points, honest unlocated warnings — persisted in host `generator_meta`.

## Binding rules

1. Coordinates stay abstract until `metersPerUnit > 0`; never invent m/km.
2. Unlocated / missing anchor → no LOD drill that pretends scale-true geography.
3. Product 3D SoT remains custom WebGL (D01); locate authoring writes map meta,
   not a second geometry path.
4. Overlap of child footprints is detectable (AABB); overlap is allowed but tested.

## APIs (`map-frame.ts`)

| API | Role |
| --- | --- |
| `locateChildMapFrame` / `parentAnchorFromParentRect` | Drag-locate (+ rotation / mpu) |
| `childLocalToParentPoint` / `parentPointToChildLocal` | Invertible transform |
| `calibrateParentSpatialMeters` | Optional positive scale |
| `parentAnchorsOverlapAabb` | Overlap probe |
| `unlocatedBlocksScaleTrueDrill` | Honest UI/LOD gate |

## Evidence

- `scripts/atl2-e02-parent-spatial-anchor.self-test.mjs`
- `.qa/runs/atl2-e02-parent-spatial-anchor.md`
- Browser wrapper: `e2e/atl2-e02-parent-spatial-anchor.spec.ts`
