# ATL2-D05 — Terrain mesh / coast / water / LOD

## Decision

Productive 3D remains **custom WebGL** (`atlas-prototype-runtime`). Domain plan
`buildAtlasTerrainMeshPlan` derives triangles + coast edges + water plane from
`UnifiedCanvasDoc.heightfield` with span-based LOD strides (far=4, mid=2, near=1).

## Contract

1. No invented geography beyond the heightfield chunk.
2. LOD only skips cells (stride); origin/cellSize stay fixed so features do not drift.
3. Coast edges only on near LOD water/land transitions.
4. Water plane matches chunk extent at `waterLevel`.

## Non-goals

- Three.js SpatialViewport product chrome
- Planet streaming / GPU tessellation shaders
