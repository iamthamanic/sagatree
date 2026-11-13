# Feature: ATL2-D05 — Terrain meshes, coasts, water, LOD (#1216)

<!-- atlas-v2-epic: #1196; slice: D05; slug: atl2-d05 -->

## Intent

Authoritative heightfields render as productive custom-WebGL terrain meshes
with shore materials, coast edges, a water plane, and span-based LOD — not a
flat texture faking relief. Issue wording that says Three.js means mesh
visualization (ATL2-D01 target).

## Preconditions

- #1213 ATL2-D02 + #1215 ATL2-D04 CLEAR

## Happy Path

- [ ] Domain `buildAtlasTerrainMeshPlan` triangulates heightfield with LOD stride
- [ ] Coast edges follow water/land transitions; water plane at waterLevel
- [ ] Runtime `productHeightfieldInto` uses LOD stride + coast markers + water plane
- [ ] Draw budget caps triangles by LOD band without shifting feature positions
- [ ] Gate report `.qa/runs/atl2-d05-terrain-mesh.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Imagination-First (IV)

- [ ] **IV-01** Authority: mesh samples only UnifiedCanvasDoc.heightfield
- [ ] **IV-18** Canonical linkage: 2D overlay and 3D mesh share the same chunk

## Edge Cases

- [ ] Missing heightfield → empty plan (no invented geography)
- [ ] Far LOD stride reduces tris; near LOD includes coast edges

## Security Coverage

- No new auth surface

## Composition Gate

SKIPPED — visualization of existing heightfield SoT; no new producer→consumer hop

## Implementation Notes

- Domain: `atlas-terrain-mesh.ts`
- Runtime: `atlas-prototype-runtime.mjs` (`productTerrainLodStride`)
- Self-test: `scripts/atl2-d05-terrain-mesh.self-test.mjs`
