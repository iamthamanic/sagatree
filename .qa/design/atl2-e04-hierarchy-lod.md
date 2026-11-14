# ATL2-E04 — Hierarchy LOD / lazy child loads / transitions

**Issue:** #1222  
**Slug:** `atl2-e04`  
**Depends:** #1221 (E03), #1216 (D05)

## Purpose

Drill into child primary maps loads the **child dataset** (not a zoomed parent sheet).
Semantic feature visibility is per hierarchy band and independent of editor layer
toggles (editor may only hide further). Prefetch / fade / cancel-stale / cache
invalidation keep navigation consistent without inventing unlocated geography.

## Binding rules

1. Unlocated children never prefetch or scale-true drill (E02).
2. Load generations cancel superseded fetches on rapid breadcrumb/drill.
3. Soft cache invalidates on save (`cacheEpoch` bump + entry drop).
4. Transition opacity is domain-pure; UI may animate; reduced-motion → snap.
5. Failed / cancelled child load leaves the last ready parent navigable.

## APIs (`atlas-hierarchy-lod.ts`)

| API | Role |
| --- | --- |
| `lodBandFromBreadcrumbDepth` | Depth 1…6 → world…room band |
| `atlasSemanticFeatureVisible` / `atlasHierarchyLodLayerFlags` | Semantic ∧ editor |
| `beginAtlasMapLoad` / `shouldApplyAtlasMapLoad` / `complete` / `fail` / `cancel` | Generation FSM |
| `decidePrefetchChildMap` | Prefetch vs cache-hit vs unlocated skip |
| `atlasMapCacheKey` / `put` / `invalidate` / `isFresh` | Soft cache |
| `atlasLodTransitionOpacity` | Child/parent fade pair |
| `atlasParentGeoSuppressed` | No duplicate coarse geo on building/room tip |

## Evidence

- `scripts/atl2-e04-hierarchy-lod.self-test.mjs`
- `.qa/runs/atl2-e04-hierarchy-lod.md`
- Browser wrapper: `e2e/atl2-e04-hierarchy-lod.spec.ts`
