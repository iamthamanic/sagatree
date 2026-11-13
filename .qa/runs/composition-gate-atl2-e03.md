# Composition Gate — atl2-e03

- Issue: #1221
- Feature slug: atl2-e03
- HEAD_SHA: 3ba2a964dbb1735ccf7f383a525a407388bacebd
- BASE_SHA: 68eefe04e892f958da964a3b44fc6d10f5823d07
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1222 ATL2-E04 LOD; Gate E #1223

## Event

GM enters a child primary map (fly-to + switch) or navigates breadcrumb/back;
session stores per-map camera snapshots; editor restores target/zoom/mode and
consumes pending focus. Hierarchy identity remains parent_map_id (E01).

## Hop chain

1. **Producer (UI):** pin / tree / breadcrumb / Escape / wheel-at-min
2. **Domain:** `enterChildMap` / `navigateToAncestor` / `navigateBack`
3. **Session state:** `AtlasHierarchyNavState.snapshots` + `pendingFocus`
4. **Consumer (editor):** `navRestoreView` / `navPendingFocus` → cam + `goToRect`
5. **Self-test:** `scripts/atl2-e03-hierarchy-nav.self-test.mjs`

Cardinality: one active map; sibling tips (Taverne vs Krypta) stay independent.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Session-local snapshots only; host map GET stays owner-scoped | no new write hop | pass |
| Invalid/missing | unlocated block, cycle breadcrumb, root back no-op, skip off-chain | fail-closed reasons | pass |
| Two consumers / crash | breadcrumb + editor restore same snapshot after back | snapshots map + pendingFocus | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Skip reason

n/a
