# Design — ATL3-R01B Three.js equal-fidelity PoC + GO/NO-GO (#1296)

**Slug:** `atl3-r01b-three-equal-fidelity-adr` · **Epic:** #1294 · **ADR:** `docs/architecture/ADR-ST-11-atl3-r01b-three-renderer-go.md`
**Binding until gates pass:** ADR-ST-10 (custom WebGL, NO-GO #1266) — immutable.

## 1. Scope / non-goals

- In: isolated PoC on stored Golden Dornhain + Krypta, same V01 cameras/canvas sizes/profiles, A/B against custom WebGL
  and the owner's V8 reference, measurements, ADR, `retireParallelIn` update (H01-3), three V01 leftovers.
- Out: no productive Three.js switch, no second productive mount, no quality-switch wiring, no map write path, no DB
  schema, no R02–R05 work, #1266 not reinterpreted.

## 2. PoC architecture

| Module | Role |
| --- | --- |
| `src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts` | V01 camera rig (same eye/up/distance per mode), perspective near `max(0.2, d·0.02)`, fog band |
| `…/r01b-poc-scene.ts` | `buildR01bScenePlan(doc)` on `buildAtlasProductGeometryPlan`: terrain grid with material groups, rooms, ribbons, walls with door gaps, `InstancedMesh` jambs, props, per-triangle IDs |
| `…/r01b-poc-runtime.ts` | `R01bThreePoc`: `MeshStandardMaterial` + V8 PBR atlas, PCF shadows (radius 3/1.5, map 2048/1024), ACES, hemisphere/sun/fill, GLSL water, CanvasTexture torch halo, picking, context loss/restore |
| `…/r01b-poc-harness.ts` | `window.__r01bThreePoc` test API (bundled into a blank page by the spec only) |
| `e2e/atl3-r01b-three-poc.spec.ts` | fingerprints, A/B captures, metrics, perf, parity, edit path, load error; hardware budgets enforced on real GPUs |
| `scripts/atl3-r01b-capture-v8.mjs` | research capture of the V8 reference (CDN three@0.160) |

H01 forbids `three` imports under `src/app/world/atlas/` except `AtlasSpatialViewport.tsx` — hence `src/infrastructure/`.
No product module imports the PoC (self-test).

## 3. V01 leftovers moved into R01B (fixed in the custom runtime — the product until R04)

| Leftover | Root cause | Fix | Criterion |
| --- | --- | --- | --- |
| (a) Krypta perspective Z1 floors in fog colour | fog from eye distance 0 | fog starts at d·0.75 (`uFogStart`) | K-ART-01 MET |
| (b) Z-fighting stripes outside the crypt | near 0.2 with far ≥ 8000 → ~0.1 depth precision | near `max(0.2, d·0.02)` + polygon offset on ocean/sheet | K-ART-01, D-ART-01 MET |
| (c) "underwater triangle" in the Dornhain plaza | ocean room (−0.48) vs plaza (−0.47) z-fight; terrain ≤ −0.5 everywhere (strides 1–6) | room layer spacing ≤ 0.075 + polygon offset | D-ART-01 MET; D-GEO-03 PARTIAL (faceted shading only) |

V01 baseline re-captured, repeat drift-free, digest `8c2a66b4a3e91bf7` (MET 13 · PARTIAL 4 · GAP 5 · NOT_RUN 2).

## 4. Measurements (SwiftShader — informational)

See `.qa/evidence/atl3-r01b-three-poc/results.json` and the ADR table. Summary: ID parity 13/13 + 201/201, picking 10/10,
edit path offset 0, quantitative A/B per pair (gradient-structure corr ≥ 0.25, ≥ 0.10 over the other scene, pair identified 28/28 — margin vs neighbouring zoom of the same camera only ≥ 0.010; richness ≥ custom), restore 85/128 ms, load-error reject 16 ms, heap ≈ 31.6 MB, 14–28 draw calls, image richness
(edge density median 3.8×, distinct colours median 5.2×). Frame times on SwiftShader vary ±40 % run to run and are
dominated by the CPU rasteriser (PCF shadow pass + per-pixel PBR); they prove nothing about GPUs either way.

## 5. Port / parity cost estimate (for R02–R05)

| Area | Estimate | Note |
| --- | --- | --- |
| Scene/geometry adapter (R02) | ~0.6–0.9 kLOC | promote R01B scene module; heightfield/rooms/walls/doors already 1:1 |
| Materials/light/shadow/instancing (R03) | ~0.4–0.6 kLOC + assets | texture provenance, KTX2/mip budget, per-profile shadow cost |
| Product integration (R04) | ~1.0–1.5 kLOC | `AtlasNative3dEditor` host swap: camera input, nav drill, tools/stamps, selection, WorldNode overlays, restore/reset, render reset |
| Acceptance (R05) | runs + matrix | hardware tiers, V01/G04/G05/H03 parity, #1300 |
| Custom engine alternative | ≥ 1.1 kLOC engine | PBR, normal/rough maps, PCF, tone mapping, instancing, texture pipeline — owned forever |

## 6. Risks

- Mobile/low-end GPUs: PCF + PBR cost — balanced profile must drop shadow map size/radius; lite stays AtlasLite3D.
- Shader compile stalls on first open (measured 2–8 ms software; must be re-measured on hardware/mobile).
- Texture provenance: V8 atlas images (data URLs) have unknown licence — must be cleared or regenerated before R03.
- Content density: V8's look depends on hand-authored scatter; renderer swap alone will not reach it.
- Bundle size: `three` is already a dependency; Atlas chunk impact to be measured in R02.

## 7. Decision log

| # | Date | Decision | Reason | Reversal |
| --- | --- | --- | --- | --- |
| R01B-1 | 2026-11-16 | Conditional GO (ADR-ST-11), not in force until owner approval + hardware evidence | fidelity gap closed on identical data; software WebGL not sole proof | `hardwareEvidence: 'failed'` → NO-GO ADR, ADR-ST-10 stays |
| R01B-2 | 2026-11-16 | `retireParallelIn = 'atl3-r02-adapter'` | SpatialViewport is not the reuse vehicle (H01-3) | revert value |
| R01B-3 | 2026-11-16 | Fix V01 leftovers in custom runtime | it stays productive until R04 | `git revert` |
| R01B-4 | 2026-11-16 | PoC not wired to the quality switch | #1296 non-goal (no second productive renderer) | — |
