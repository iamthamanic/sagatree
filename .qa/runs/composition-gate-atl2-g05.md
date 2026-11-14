# Composition Gate — atl2-g05

- Issue: #1233
- Feature slug: atl2-g05
- HEAD_SHA: d82bd8e7bd2a3e948269e8a6e2ed6da25ca103d4
- BASE_SHA: 9009014e3881249ec295cc8dc265108f08c13d04
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none

## Event

Cross-cutting GATE G: real Browser E2E / GPU frame samples, map-switch +
context-loss teardown, device matrix, GM/Player secret negatives, and
screenshots — evidence rows stay NOT_RUN until HOST e2e fills them.

## Hop chain

1. Domain `atlas-gate-g05` → check ids + percentile / budget helpers
2. Runtime `__sagatreeAtlas.sampleFrameTimes` / `forceContextLoss`
3. Browser E2E HOST → Dornhain atlas → frames / devices / secrets
4. Evidence JSON → `buildAtlasG05ChecksFromEvidence` → rollup PASS|FAIL|NOT_RUN
5. Node self-test → wiring + fail-closed rollup (never silent PASS)

Cardinality: 13 required checks; 3 scene sizes; 3 device bands; one evidence file.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Missing evidence | NOT_RUN rollup | emptyAtlasG05Checks | pass |
| Soft budget webgl | p95 ≤ 33.3 | summarizeAtlasG05FrameSample | pass |
| CI software | p95 ≤ 120 | atlasG05FrameBudgetMs(software) | pass |
| Player leak | FAIL | playerSecretsAbsent=false | pass |
| Map switch | liveMeshes=0 after cycles | teardown check | pass |

## Notes

Replace HEAD_SHA on ship tip before Composition Gate CI.
