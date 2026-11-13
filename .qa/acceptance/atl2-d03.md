# Feature: ATL2-D03 — Product camera modes (ortho / diorama / perspective) (#1214)

<!-- atlas-v2-epic: #1196; slice: D03; slug: atl2-d03 -->

## Intent

View the same productive WebGL dataset as ortho top-down, oblique diorama, and
perspective without rebuilding meshes (ATL2-D01 target).

## Preconditions

- #1212 D01 CLEAR; #1213 D02 CLEAR

## Happy Path

- [ ] Domain camera modes: `ortho-topdown` | `diorama-oblique` | `perspective`
- [ ] Runtime cycles modes via inspector control; shared target/span/yaw
- [ ] `cameraMatrix` uses ortho for top-down/diorama and `glm.perspective` for perspective
- [ ] Mode transitions animate pitch; pitch clamps per mode
- [ ] Camera snapshot persists as `webglRuntimeV3.camera` presentation extra (not geometry)
- [ ] Cursor-anchored zoom / pan / yaw remain available in all modes
- [ ] Gate report `.qa/runs/atl2-d03-product-camera-modes.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Imagination-First (IV)

- [ ] **IV-01** Authority: camera is presentation only; cartography SoT unchanged
- [ ] **IV-18** Canonical linkage: camera extras never dual-write geometry

## Edge Cases

- [ ] Missing seed camera → default top-down
- [ ] Edit tools do not change map identity on zoom
- [ ] WebGL fail → AtlasLite3D uses same angles

## Composition Gate

SKIPPED — view matrix only; no new hop
(see `.qa/runs/composition-gate-atl2-d03.md`)

## Implementation Notes

- Domain: `atlas-product-camera.ts`
- Runtime: `atlas-prototype-runtime.mjs` (`setCameraMode`, `glm.perspective`)
- Self-test: `scripts/atl2-d03-product-camera-modes.self-test.mjs`
