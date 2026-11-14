# Feature: ATL2-G05 — Security / Perf / A11y / Visual quality gate (#1233)

<!-- atlas-v2-epic: #1196; slice: G05; slug: atl2-g05 -->

## Intent

Cross-cutting produktive Qualität wird **mit realer Host-/Browser-/GPU-Messung**
abgenommen — nicht nur mit synthetischen Plan-Kosten (G02). Unrun tests bleiben
`NOT_RUN` und werden nie als PASS gewertet.

## Preconditions

- #1229 G01, #1230 G02, #1231 G03, #1232 G04 MERGED
- Productive 3D: `custom-webgl-prototype-runtime` (R01 NO-GO Three.js)

## Happy Path

- [ ] Owner-/Player-Policy + Secret-Negativproben API+UI grün
- [ ] Frame p50/p95 under real rAF load for small/medium/large scenes vs budgets
- [ ] Map-switch + WebGL context-loss teardown; JS-heap soak without unbounded growth
- [ ] Camera / zoom / orbit / pick on desktop + tablet + phone
- [ ] Screenshots + evidence JSON + repro env documented
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Software/SwiftShader CI path uses documented wider p95 ceiling
- [ ] Missing evidence rows stay `NOT_RUN` (rollup never silent PASS)
- [ ] Context-loss without restore → FAIL

## Security Coverage

- SC-01 Owner atlas payload retains editor secrets where expected
- SC-02 `playerView` strips `editorSecret` / GM-only paths (G01 projection)
- SC-03 No client-invented elevated origin

## Imagination-First (IV)

- [ ] **IV-01** Perf samples measure productive Custom-WebGL surface only
- [ ] **IV-02** Visual screenshot is atmospheric proof, not a second renderer

## Adaptive UI (AU)

- [ ] **AU-01** Device matrix desktop / tablet / phone recomposes workstation
- [ ] **AU-CONTENT-WIDTH** Atlas remains usable at phone band (≥44px chrome)
- [ ] **AU-04** Touch sheet chrome; no hover-only dead ends for G05 probes

## Composition Gate

- Verdict: CLEAR (when HEAD matches)
- Proof: `.qa/runs/composition-gate-atl2-g05.md`

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-gate-g05.ts`
- Runtime hooks: `__sagatreeAtlas.sampleFrameTimes` / `forceContextLoss` (ATL2-G05)
- Evidence: `.qa/evidence/atl2-g05/` (Browser E2E HOST)
- Self-test: `scripts/atl2-g05-quality-gate.self-test.mjs`
- E2E: `e2e/atl2-g05-quality-gate.spec.ts`
- Non-goals: guaranteed 60 FPS on every laptop; Three.js product path
