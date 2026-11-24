# Composition Gate — atl3-r01b-three-equal-fidelity-adr

- Issue: #1296
- Feature slug: atl3-r01b-three-equal-fidelity-adr
- HEAD_SHA: 44e47b53d4c3062586ec90eddc7f0815724ff542
- BASE_SHA: 651c90afd8b203aa6f096470a09c62aec02b6083
- Date: 2026-11-16
- Verdict: CLEAR
- Acceptance tier: browser-host (stored Golden data → isolated Three PoC + productive custom WebGL captures)
- Deferred integration: product integration of Three.js is R04 (#1269) — closed until ADR-ST-11 gates pass (by design, #1296 non-goal)

## Event

ATL3-R01B: an isolated Three.js PoC renders the same stored Golden Dornhain + Krypta as the productive custom WebGL
runtime, at the exact V01 cameras, and is compared/measured; ADR-ST-11 records a conditional GO that stays fail-closed
(`atlasR01bAllowsFollowOnRendererWork() === false`) until owner approval + hardware evidence. Three V01 leftovers are
fixed in the productive custom runtime (perspective fog start, near-plane depth precision, ocean/plaza z-fighting).

## Hop chain

1. Host seed / ensure-starter → stored maps → host API `/api/v1/worlds/:id/atlas/maps` (unchanged).
2. Product: `AtlasNative3dEditor` → `atlas-prototype-runtime.mjs` (custom WebGL, still the only productive renderer)
   → V01 captures/baseline (re-captured, drift-free repeat, matrix re-pinned `8c2a66b4a3e91bf7`).
3. Test-only: e2e fetches the same stored docs (fingerprints == V01 contract) → `parseUnifiedCanvasDoc` →
   `buildAtlasProductGeometryPlan` → `buildR01bScenePlan` → `R01bThreePoc` (bundled into a blank page; never
   imported by a product module — self-test).
4. Edit path: product 2D surface stamp → autosave PUT held by route (no DB write) → body → PoC `setDoc` → same new ID,
   centroid offset 0.
5. Decision: `ATLAS_R01B_RENDERER_DECISION` (domain) → self-test → docs index/AGENTS/README; R02–R05 remain closed.

Cardinality: 2 golden scenes × 1 stored map; 28 PoC captures paired 1:1 with V01 custom captures; 1 productive renderer.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Same data | PoC and product read identical stored objects | fingerprints 3ec9b21f…/a44b49a7… in both | pass |
| ID stability | every canonical doc ID exists in 3D | 13/13, 201/201; picking 10/10 | pass |
| Edit path | 2D edit appears in 3D with same ID, nothing persisted | new ID present, offset 0, writes aborted + offline teardown; stored fingerprints re-verified (shared DB: R01B then V01) | pass |
| Render reset | context loss → restore | restored 85/128 ms, non-blank | pass |
| Load error | corrupt texture | rejects in 16 ms, no partial scene | pass |
| Gate bypass | GO with one gate pending/failed | `atlasR01bAllowsFollowOnRendererWork` false (self-test matrix) | pass |
| Second productive mount | PoC imported by product code | self-test FAIL (import scan) | pass |
| Software-only proof | SwiftShader or unknown renderer as GO evidence | informational only; hardware = positive GPU match, budgets enforced only there | pass |
| Unrelated image | PoC renders something varied but wrong | quantitative A/B per pair fails (structure, unrelated-scene margin, own view) | pass |
| Leftover regressions | V01 views after fixes | repeat capture drift 0; D-ART-01/K-ART-01 MET | pass |

## Flags

- Product 3D: custom-webgl-prototype-runtime (unchanged owner; three leftover fixes)
- Three.js: isolated PoC only; ADR-ST-11 proposed, not in force; ADR-ST-10 binding
- Perf numbers: SwiftShader software rendering, informational; hardware run = ADR-ST-11 gate 2
