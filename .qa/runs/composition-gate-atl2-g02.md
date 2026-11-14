# Composition Gate — atl2-g02

- Issue: #1230
- Feature slug: atl2-g02
- HEAD_SHA: 2c1fac4faccd65b8123a65857c8de6d862e53f19
- BASE_SHA: 8df8589249cd73ec4abf5959669d18364ea0777a
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none

## Event

Large atlas/dungeon scenes are planned under documented quality budgets; GPU
resources are released on context-loss and map teardown so repeated switches
cannot grow unbounded. Productive 3D remains Custom WebGL (R01 NO-GO).

## Hop chain

1. Fixture (small|medium|large) → generateDungeon + rasterize + commit features
2. `measureAtlasPerfPlan` → product geometry plan + dungeon look plan
3. Compare instances/batches/coldPlanMs vs `ATLAS_PERF_BUDGET_THRESHOLDS`
4. Runtime: webglcontextlost → AtlasGL.dispose → restore → activate3D
5. Domain session: mapSwitch × N → releaseAll → liveHandles == 0

Cardinality: one plan measurement per fixture; one GPU session per mount.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM edit + player view | same budgets, different auth | pass |
| Invalid/missing | empty doc | 0 instances | pass |
| Two consumers / crash | look + geometry fingerprints | independent; teardown zeros handles | pass |
| Context loss | lost then restore | handles reset | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
