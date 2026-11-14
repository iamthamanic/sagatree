# Composition Gate — atl2-g02

- Issue: #1230
- Feature slug: atl2-g02
- HEAD_SHA: 4ec972b0970a21c6ac9814178cec8f4f9a83ea2c
- BASE_SHA: 8df8589249cd73ec4abf5959669d18364ea0777a
- Date: 2026-11-14
- Verdict: CLEAR

## Event

Large atlas/dungeon scenes are planned under documented quality budgets; GPU
resources are released on context-loss and map teardown so repeated switches
cannot grow unbounded.

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
| Two consumers | look + geometry fingerprints | independent | pass |
| Context loss | lost then restore | handles reset | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
