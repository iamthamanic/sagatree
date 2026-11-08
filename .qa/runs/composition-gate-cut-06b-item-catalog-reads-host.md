# Composition Gate — cut-06b-item-catalog-reads-host (#1160)

- HEAD_SHA: 4e2a6410d2bc701f58b52b1f13b2d191f58f9993
- BASE_SHA: 45f681e20a84671b13b81afd98b641320279785e
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: world `modules` JSON for character catalog composition remains defaults until broader world-modules parity

## Event

Character and world item catalog reads use host `GET /api/v1/library/items` with
server-side `worldProfileId` / `includeArchived` / `origin` filters via `InventoryPorts.listCatalog`.
No Soft-DENY empty success; ACL fail-closed.

## Hop chain

1. `CharacterInventoryV2Panel` → `loadCharacterItemCatalog(characterId, userId)`
2. → `resolveEffectiveWorldProfileId` (host character + adventure arcs + project)
3. → `GET /api/v1/library/items?worldProfileId=` via `fetchHostLibraryItems`
4. → `InventoryPorts.listCatalog` (ACL `canReadWorldProfile`; personal owner-scoped; standard)
5. → domain `composeCharacterInventoryAddCatalog` + Core/builtin local composition
6. → `InventoryCatalogDialog`

World authoring: `WorldItemCatalogSection` → same list route with `includeArchived=1&origin=world`.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger worldProfileId denied | Port ACL → 403 | pass |
| Invalid/missing | Missing ports / unauth / empty world | 503 / 401 / [] | pass |
| Two consumers / crash | Character add-catalog vs world authoring | Distinct query shapes; no Soft-DENY | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Evidence

- `scripts/cut-06b-item-catalog-reads.self-test.mjs`
- Matrix keys HOST_VERIFIED
