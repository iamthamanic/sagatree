# Design: ATL2-E02 ParentSpatialAnchor + locate persistence

<!-- atlas-v2-epic: #1196; slice: E02 -->

## Decision

Reuse `ParentSpatialAnchor` in `map-frame.ts` as the single parent-space placement
SoT (center/extent/rotation + optional `metersPerUnit`). Persist via atlas map
`generatorMeta.mapFrame` / `mapStatus` — same path as `locateChildOnParent`.

## Coordinate model

- Child primary maps keep independent local bounds (`0…1000` abstract).
- Parent↔child mapping: normalize child → scale by extent → rotate → translate.
- Inverse is exact for finite anchors; proven by `assertInvertibleParentChildMap`.
- `metersPerUnit <= 0` or non-finite → `null` (uncalibrated; no m/km claims).

## LOD / honesty

- `canLodEnterChildMap` / `canWebglDrillSelect` require grounded located frame.
- Unlocated children show honest empty/hint — never invent scale-true drill.

## Out of scope

- Continuous planet mesh, forced meter scale, breadcrumb camera (E03).
