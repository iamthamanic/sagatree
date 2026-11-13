# Feature: ATL2-D02 — Canonical Atlas features as editable 3D geometry (#1213)

<!-- atlas-v2-epic: #1196; slice: D02; slug: atl2-d02 -->

## Intent

Project areas, paths, walls, doors, rooms, props and building footprints from
the shared `UnifiedCanvasDoc` into the productive custom WebGL 3D runtime
(ATL2-D01) without a second geometry store.

## Preconditions

- #1212 ATL2-D01 CLEAR (custom WebGL product target locked)

## Happy Path

- [ ] Domain `buildAtlasProductGeometryPlan` covers rooms/areas, strokes/paths,
      walls, doors, props, building footprints from Golden + door fixtures
- [ ] Bridge `syncCanvasDocIntoWebglRuntime` projects `doors[]` into ephemeral seed
- [ ] Productive runtime `productDoorInto` + `buildProductGeometry` renders doors
- [ ] Scene-diff fingerprint skips unchanged mesh rebuilds in the product path
- [ ] Delete/move/height/elevation still round-trip via UnifiedCanvasDoc SoT
- [ ] Gate report `.qa/runs/atl2-d02-canonical-3d-geometry.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Imagination-First (IV)

- [ ] **IV-01** Authority: 3D meshes visualize canonical cartography only
- [ ] **IV-07** Hidden-info safety: door/wall geometry does not invent secrets
- [ ] **IV-18** Canonical linkage: controlled seed/persist binds meshes to
      `unifiedCanvas` (no localStorage SoT; no WebGL geometry shadow on persist)

## Edge Cases

- [ ] Orphan doors (missing wall) omitted from plan and bridge
- [ ] Concave room polygons triangulate via domain `triangulatePolygon`
- [ ] WebGL unavailable → AtlasLite3D still draws the same door/wall plan

## Security Coverage

- No new auth surface; persist remains host upsert / owner policy

## Composition Gate

SKIPPED — geometry projection only; no new producer→consumer hop
(see `.qa/runs/composition-gate-atl2-d02.md`)

## Implementation Notes

- Domain: `atlas-product-geometry-plan.ts`, `webgl-runtime-bridge.ts`
- Runtime: `atlas-prototype-runtime.mjs` (`productDoorInto`, fingerprint)
- Self-test: `scripts/atl2-d02-canonical-3d-geometry.self-test.mjs`
- Productive 3D target remains custom WebGL — not SpatialViewport / Three product chrome
