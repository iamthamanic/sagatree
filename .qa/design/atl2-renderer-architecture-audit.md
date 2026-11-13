# ATL2 Renderer Architecture Audit — Three.js wording vs product WebGL

**Date:** 2026-11-13  
**Epic:** #1196  
**Decision lock:** ATL2-D01 / #1212 (`.qa/design/atl2-d01-renderer-decision.md`)  
**Code SoT:** `src/domains/world/atlas/atlas-renderer-target.ts`  
  (`ATLAS_PRODUCT_3D_TARGET = 'custom-webgl-prototype-runtime'`)

## Question

Epic #1196 and Gate D (#1218) name **Three.js** as the Phase-D 3D renderer.
ATL2-D01 shipped a **custom WebGL** product path (`AtlasGL` + `AtlasLite3D` in
`atlas-prototype-runtime.mjs`). Is product still meeting requirements, and may
later D/E slices flip architecture?

## Findings

| Claim | Evidence |
| --- | --- |
| Epic Intent/Design lists Three.js | #1196 body — historical planning language + MIT dungeon reference |
| Productive 3D target is custom WebGL | D01 decision + `ATLAS_RENDERER_DECISION` |
| Product chrome mounts Native3d / prototype-runtime only | `AtlasNative3dEditor.tsx`; no `AtlasSpatialViewport` product mount |
| Parallel Three inventory exists, not product SoT | `ATLAS_PARALLEL_THREE_VIEWPORT_PATH` → retire in ATL2-H cleanup |
| D02–D06 built on the custom runtime | camera modes, heightfield, terrain LOD, diorama look (#1213–#1217) |
| Single canonical geometry | UnifiedCanvasDoc → WebGL bridge; IV-01/IV-02 honored |

## Verdict (binding until parity proof)

1. **Keep custom WebGL as the sole productive Atlas 3D renderer.**
2. Epic/ticket phrases “Three.js” for Phase D mean **product 3D view of the same
   canonical map**, not a mandatory library swap. Gate D (#1218) acceptance that
   says “echte Three.js-Geometrie” is interpreted as **echte produktive 3D-Geometrie
   aus Saved Maps** on the locked custom-WebGL target.
3. **No architecture flip** (adopting Three.js as product SoT, dual renderers, or
   retiring `AtlasGL` early) without a measured parity package: Golden 2D↔3D,
   camera modes, terrain/diorama, Nav/Tools, software fallback, and performance
   on high/balanced/lite — documented CLEAR evidence, not aspirational wording.
4. Contradictory ticket text stays sync’d via this audit + D01; implementers must
   not re-introduce a second product chrome path.

## Sync targets

- #1196 Design item 2 (“Three.js is 3D projection”) — satisfied by custom WebGL projection of the same features.
- #1218 Gate D — evaluate the locked custom-WebGL stack; do not fail solely for missing `three` npm dependency.
- Later E/F/G renderer work continues on `atlas-prototype-runtime.mjs` unless a new ADR with parity evidence supersedes D01.

## Rollback

Unchanged from D01: Draufsicht remains authoring SoT; 3D can fall back to controlled seed / software path. Do not re-activate parallel Three as product chrome without ADR.
