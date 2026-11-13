# Composition Gate — atl2-c03

- Issue: #1208
- Feature slug: atl2-c03
- HEAD_SHA: d333444dfbcad93c54fb90f2f2fab8313dea67b7
- BASE_SHA: ec9b2f922aba0f50683bc371260f4c30d1578394
- Date: 2026-11-12
- Verdict: SKIPPED

## Skip reason

Editor selection/layer chrome on existing atlas upsert hop; no new hop.

## Event

Multi-select + layerLocks persist + hit-test gates (visibility drawings / lock interior).

## Hop chain

(none new)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | N/A | canEdit | skip |
| Locked layer | edit blocked | canEditFeatureKind | pass |
| Hidden layer | no hitProbe | canHitFeature drawings | pass |
| Stroke group move | translate points | translateSelected | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
