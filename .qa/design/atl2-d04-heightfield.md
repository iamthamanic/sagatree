# ATL2-D04 — Editable heightfields

## Decision

Canonical terrain heights live on `UnifiedCanvasDoc.heightfield` as a versioned
inline chunk (`sagatree-atlas-heightfield-v1`). Brushes mutate the chunk via
`MapEditOperation`; 2D and custom WebGL share the same SoT. No globe streaming.

## Contract

1. **Format:** cols×rows heights, origin, cellSize, waterLevel, assetRef version.
2. **Ops:** ensure / paint (raise|lower|smooth|flatten) / clear / set.
3. **Shore:** cells below waterLevel stay submerged unless leaveWater.
4. **Legacy:** missing or invalid heightfield does not invalidate polygons.
5. **3D:** `product_heightfield` mesh from the same chunk; fingerprint includes hf.

## Non-goals

- Planet-wide streaming / LOD chunks beyond one map sheet
- GPU tessellation / displacement shaders beyond MeshBuilder tris
