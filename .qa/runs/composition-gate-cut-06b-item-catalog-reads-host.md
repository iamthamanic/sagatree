# Composition Gate — cut-06b-item-catalog-reads-host (#1160)

- HEAD_SHA: e4ee6dafc2fd1d1d32361790b5a86442577d7b11
- Verdict: CLEAR
- Date: 2026-11-08

## Hop chain

1. `CharacterInventoryV2Panel` → `loadCharacterItemCatalog(characterId, userId)`
2. → `resolveEffectiveWorldProfileId` (host character + adventure arcs + project)
3. → `GET /api/v1/library/items?worldProfileId=` via `fetchHostLibraryItems`
4. → `InventoryPorts.listCatalog` (ACL `canReadWorldProfile`; personal owner-scoped; standard)
5. → domain `composeCharacterInventoryAddCatalog` + Core/builtin local composition
6. → `InventoryCatalogDialog`

1. `WorldItemCatalogSection` → `loadWorldProfileItemCatalog(worldProfileId)`
2. → `GET /api/v1/library/items?worldProfileId=&includeArchived=1&origin=world`
3. → `InventoryPorts.listCatalog` (world-only + archived; ACL fail-closed)
4. → UI filter / archive / restore (CUT-06 mutations unchanged)

## Simulations

| Simulation | Result | Notes |
| --- | --- | --- |
| N-actors | pass | Stranger worldProfileId → 403; personal rows owner-scoped |
| Invalid / missing | pass | Missing ports → 503; unauth → 401; empty world id → [] |
| Two consumers / crash | pass | Character add-catalog vs world authoring use distinct query shapes; no Soft-DENY empty list |

## Evidence

- `scripts/cut-06b-item-catalog-reads.self-test.mjs`
- Matrix keys HOST_VERIFIED
