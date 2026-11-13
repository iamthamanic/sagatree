# ATL2-E03 — Zoom / Breadcrumb / Back-nav (six levels)

**Issue:** #1221  
**Slug:** `atl2-e03`  
**Depends:** #1220, #1214

## Purpose

GM navigates `world > continent > country > place > building > room` via
map click (fly-to + child map), UI breadcrumbs, keyboard, and wheel-at-min;
back restores the parent map’s camera target/zoom/mode. Per-map camera
snapshots are session-local; hierarchy identity stays E01 primary links.

## Binding rules

1. No seamless infinite single-mesh world — each tip is its own primary map.
2. Unlocated children never invent scale-true drill (E02 gates stay closed).
3. Product 3D remains custom WebGL (D01); nav restores abstract camera views.
4. Sibling buildings (Taverne vs Krypta) are independent branches under place.

## APIs (`atlas-hierarchy-nav.ts`)

| API | Role |
| --- | --- |
| `buildMapBreadcrumb` | Cycle-safe parent_map_id chain |
| `enterChildMap` / `navigateToAncestor` / `navigateBack` | Snapshot + switch |
| `focusRectFromParentAnchor` | Fly-to rect from E02 anchor |
| `parseHierarchyNavKey` / `wheelRequestsHierarchyBack` | Keyboard / wheel intents |
| `assertIndependentBranches` | Sibling tip independence |

## Evidence

- `scripts/atl2-e03-hierarchy-nav.self-test.mjs`
- `.qa/runs/atl2-e03-hierarchy-nav.md`
- Browser wrapper: `e2e/atl2-e03-hierarchy-nav.spec.ts`
