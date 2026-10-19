# Composition Gate — atlas-worldbuilder-structure-bind

- HEAD_SHA: 13b23b098cbbb8ab81713353447a5b9684cb05ca
- BASE_SHA: b8fda6e121e26f711ccb28ec3f500c234902ee1d
- Date: 2026-10-19
- Verdict: CLEAR

## Event

GM opens atlas → listPlaces/listMapLinks → buildAtlasPlaceNav → left rail / panel select → setActiveMapId(primary).

## Hop chain

1. Workbench reloadPlaceNav (JWT list RPCs, saga projection when player)
2. Domain buildAtlasPlaceNav prefers primary links
3. Rail/panel click → editor.setActiveMapId
4. Rename → rename_world_node RPC

## Simulations

| Case | Intended | Result |
|------|----------|--------|
| N-actors | Two worlds | worldProfileId scoped lists |
| Invalid/missing | No primary link | place omitted from nav |
| Two consumers / crash | Reload placeNav | idempotent read |

## Flags

(none) — residual: WebGL prototype NAV_CHILDREN demo ids remain for internal 3D seed geometry; product rail uses DB places when present.
