# ATL2-D03 — Product camera modes

## Decision

Implement named camera modes on the **custom WebGL** product runtime
(`atlas-prototype-runtime`), not Three SpatialViewport.

| Mode | Projection | Pitch |
|------|------------|-------|
| `ortho-topdown` | Ortho | π/2 |
| `diorama-oblique` | Ortho | ~35°–70° (default ~60°) |
| `perspective` | Perspective FOV 50° | clamped band |

Shared target = `{x,z}` + `span` + `yaw`. Mode changes do **not** rebuild
`buildProductGeometry`.

## Persist

`state.camera` rides in ephemeral `webglRuntimeV3` extras; B04 still strips
geometry on product save. UnifiedCanvasDoc remains the geometry SoT.
