# Run — ATL2-G02 perf budgets

- Issue: #1230
- Slug: atl2-g02
- Script: `scripts/atl2-g02-perf-budgets.self-test.mjs`
- Verdict: PASS (local; CI via test-gate)

## Notes

Deterministic CI cell: `large` × `lite` draw-call estimate under budget.
Map-switch stress (25) + context-loss reclaim prove no unbounded live handles.
