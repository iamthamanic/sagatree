# Composition Gate — atl2-e02

- Issue: #1220
- Feature slug: atl2-e02
- HEAD_SHA: PLACEHOLDER_WILL_REPLACE
- BASE_SHA: 46885289400b6a091f1d6b6b39e7fc9ebdef8ddb
- Date: 2026-11-13
- Verdict: SKIPPED

## Skip reason

Stabilize/evidence lock for ParentSpatialAnchor locate + invertible transforms —
no new producer→consumer hop beyond existing atlas upsert/get.

## Event

Locate persists on SQLite host via generatorMeta.mapFrame; LOD gates unlocated.

## Hop chain

(none)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | n/a | protocol | pass |
| Invalid/missing | zero extent / neg mpu | reject/null | pass |
| Two consumers / crash | getMap reload | same SoT | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
