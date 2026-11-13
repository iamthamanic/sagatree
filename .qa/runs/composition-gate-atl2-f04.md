# Composition Gate — atl2-f04

- Issue: #1227
- Feature slug: atl2-f04
- HEAD_SHA: WORKTREE
- BASE_SHA: 68eefe04e892f958da964a3b44fc6d10f5823d07
- Date: 2026-11-14
- Verdict: CLEAR

## Event

Canonical dungeon features (F02/F03 IDs) → atmospheric look plan (theme/light/budget) → Custom WebGL product meshes; theme never rewrites geometry IDs.

## Hop chain

1. `UnifiedCanvasDoc` dungeon feature IDs (`droom-`/`dwall-`/`ddoor-`/…)
2. `buildAtlasDungeonLookPlan(theme, graphicsPreset)` → palette + batches + budget
3. `AtlasNative3dEditor` passes serializable `dungeonLook` into `atlas-prototype-runtime`
4. Runtime `productWallInto` / `productRoomInto` / torches apply theme albedos + envLight

Cardinality: one look plan per doc+theme+preset; geometryFingerprint theme-invariant.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM view | Domain plan + runtime | pass |
| Invalid/missing | Unknown theme / empty doc | ancient / 0 batches | pass |
| Two consumers | ancient vs molten same doc | same geometryFingerprint | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |

## Renderer constraint

R01 #1266 NO-GO — no Three.js product path; Custom WebGL only.
