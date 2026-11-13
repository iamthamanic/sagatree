# Composition Gate — atl2-f02

- Issue: #1225
- Feature slug: atl2-f02
- HEAD_SHA: pending
- BASE_SHA: aa9e325012fc3564337abbcdf354ae1ca86a11e4
- Date: 2026-11-13
- Verdict: CLEAR

## Event

`generateDungeon` → `rasterizeDungeonLayout` → canvas rooms/walls/doors with stable IDs.

## Hop chain

1. Graph generator (F01) produces rooms/edges
2. Rasterizer stamps floor/corridor/wall/doorway cells
3. BFS passability from entrance over floor cells
4. Export UnifiedCanvasDoc entities (edit-ready)

Cardinality: one rasterize per generate result; one feature ID per wall/door/room.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM | Domain-only | pass |
| Invalid/missing | Bad gen / disconnected floor | `valid`/`passable` false | pass |
| Two consumers | Rasterize twice same seed | Identical IDs/cells | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
