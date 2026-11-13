# Composition Gate — atl2-e02

- Issue: #1220
- Feature slug: atl2-e02
- HEAD_SHA: dee7c4cc92f1e34445370912b5136b76661f99cd
- BASE_SHA: fe652e1521b34966ba9f0df015774d5bb3b9253b
- Date: 2026-11-13
- Verdict: CLEAR
- Acceptance tier: host+domain
- Deferred integration: none — locate/calibrate consume generator_meta; LOD/drill gates fail closed

## Event

ParentSpatialAnchor locate + optional metersPerUnit persist through host upsert and
reload; unlocated children cannot claim scale-true drill.

## Hop chain

1. Draufsicht / editor `locateChildOnParent` → domain `locateChildMapFrame` (+ calibration)
2. `mergeMapFrameIntoGeneratorMeta` → host `upsertWorldAtlasMap` (owner-scoped)
3. Consumers: extract/LOD/drill gates + invertible transforms / overlap AABB

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | owner locate | stranger deny | pass |
| Invalid/missing | zero extent / ≤0 mpu / unlocated | fail-closed | pass |
| Two consumers / crash | Draufsicht + custom WebGL LOD | same generator_meta SoT | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
