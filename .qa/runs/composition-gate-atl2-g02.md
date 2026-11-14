# Composition Gate — atl2-g02

- Issue: #1230
- Feature slug: atl2-g02
- HEAD_SHA: 184083b9098c6cbf0fd604e514153424ceadf958
- BASE_SHA: 8df8589249cd73ec4abf5959669d18364ea0777a
- Date: 2026-11-14
- Verdict: CLEAR

## Event

Atlas runtime mounts large maps; budgets + resource sessions prevent unbounded
GPU/JS handle growth across switches and WebGL context loss.

## Hop chain

1. Scene fixture (small/medium/large) + graphics preset
2. `atlasPerfBudgetFor` → documented thresholds
3. Runtime observation (or CI estimate for draw calls)
4. `evaluateAtlasPerfBudget` → ok / violations
5. Optional `suggestAtlasPerfDegrade`
6. Resource session: allocate → dispose / context-loss → liveHandles = 0

Cardinality: one budget cell per scene×preset; one session per editor mount generation.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Large/lite | Under draw budget | estimate ≤ max | pass |
| 25 map switches | Reclaim each cycle | live=0, peak=per-map | pass |
| Context loss | Drop live handles | live=0 after loss | pass |
| Miss frame P95 | Degrade high→balanced | suggestAtlasPerfDegrade | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
