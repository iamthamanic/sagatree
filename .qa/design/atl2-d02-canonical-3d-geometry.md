# ATL2-D02 — Canonical features → productive WebGL geometry

## Decision

Productive 3D remains **custom WebGL** (`atlas-prototype-runtime` /
`AtlasNative3dEditor`) per ATL2-D01. Issue wording that mentions Three.js is
interpreted as “3D mesh visualization”; SpatialViewport stays inventory-only.

## Contract

1. **SoT:** `UnifiedCanvasDoc` (`generator_meta.unifiedCanvas`) only.
2. **Plan:** `buildAtlasProductGeometryPlan(doc)` — pure domain counts + door
   placements via `wallPointAt` + triangulation via `triangulatePolygon`.
3. **Bridge:** `syncCanvasDocIntoWebglRuntime` projects `doors[]` into ephemeral
   `webglRuntimeV3` seed (never dual-written on product persist — B04).
4. **Runtime:** `productDoorInto` draws door frames; `productGeometryFingerprint`
   skips unchanged `engine.setMesh` rebuilds.
5. **Edits:** 2D MapEditOps and 3D persist both land in the same canvas doc;
   orphan doors pruned when walls disappear.

## Non-goals

- Heightfield / materials polish (later D slices)
- Camera / terrain consolidations (Gate D)
- Product chrome on SpatialViewport
