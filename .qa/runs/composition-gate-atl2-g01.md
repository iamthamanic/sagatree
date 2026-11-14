# Composition Gate — atl2-g01

- Issue: #1229
- Feature slug: atl2-g01
- HEAD_SHA: 24ae9529630d172322f7653fc74ee9324d15d0c7
- BASE_SHA: 11efd6ffb5fc80d0324cc72eb0a23495f9a00e3e
- Date: 2026-11-14
- Verdict: CLEAR

## Event

GM/owner atlas maps carry secrets; playerView / non-editor projections strip GM-only
geometry, meta, and dungeon seed; writes stay owner-scoped.

## Hop chain

1. Actor → Policy / `canReadWorld` / `canEditWorld` (owner vs member)
2. `listMaps` / `getMap` with `partyOnly = !canEdit || playerView`
3. Saga membership → `partyRevealedMapIds` (reveal=`party` bindings)
4. `#toVm`: `filterPartyLayers` + `redactPartyMeta` (unifiedCanvas + dungeon theme-only)
5. `upsertMap` / `ensureRoot` / `deleteMap` require `canEditWorld` → `42501` otherwise

Cardinality: one redacted VM per get; one allowed map-id set per saga project.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner + player | partyOnly projection | pass |
| Invalid/missing | Foreign saga / unrevealed map | 42501 / P0002 | pass |
| Two consumers | Editor vs player same mapId | secrets diverge | pass |
| Write | Player upsert | 42501 | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
