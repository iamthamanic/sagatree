# Composition Gate — atlas-worldbuilder-geometry

- HEAD_SHA: 7294f96f3e5ac621dad1fc67dd361c6ab71c648b
- BASE_SHA: 8b29a613d8d8580116d17c80b7a8b36608d5a1f5
- Date: 2026-10-19
- Verdict: CLEAR

## Event

GM creates a child primary map; system assigns an independent 0…1000 frame with `mapStatus: unlocated`. LOD/drill enters the child only after a grounded parent-space anchor exists.

## Hop chain

1. Producer: `createChildMap` / create RPC → independent bounds + `unlocatedChildMapGeneratorMeta`
2. Consumer A: `buildAtlasPlaceNav` / `resolveAtlasLodFromPlaces` (`located` gate)
3. Consumer B: Workbench unlocated hint + tree select by `mapId` (no invented geo)

## Simulations

- N-actors: concurrent frame edits use map revision CAS on upsert (existing).
- Invalid/missing: zero/invalid parentAnchor rejected; unlocated never LOD-enters.
- Two consumers / crash: tree select still opens primary mapId while LOD stays on parent.

## Flags

(none)

