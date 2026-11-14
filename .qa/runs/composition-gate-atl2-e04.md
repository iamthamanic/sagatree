# Composition Gate — atl2-e04

- Issue: #1222
- Feature slug: atl2-e04
- HEAD_SHA: 21edbb8bbdc6b54ab40de3cd333ff90132bf7c16
- BASE_SHA: 95d0d8d48a733bba3113991f92e62330e0826f8d
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: Gate E #1223

## Event

GM drills into a located child primary map; load generation begins; editor applies
semantic LOD layer flags for the breadcrumb band; stale loads cancel; failed
loads leave the prior map navigable.

## Hop chain

1. **Producer (UI):** tree / pin / breadcrumb enter-child
2. **Domain:** `beginAtlasMapLoad` + `decidePrefetchChildMap` + semantic flags
3. **Infrastructure:** host `getMap` (owner-scoped)
4. **Consumer (UI):** `UnifiedAtlasEditor` `hierarchyLodBand` ∧ editor layers

## Notes

Proof pin for feature tip 21edbb8bbdc6b54ab40de3cd333ff90132bf7c16.
