# Composition Gate — atl2-e01

- HEAD: 6f82fc626716bc7e18e5b2d2a4081a4bffc88b13
- Verdict: **CLEAR**

## Hop chain

| Producer | Record | Consumer |
|---|---|---|
| `createWorldNodeWithMaps` | world_places + primary world_place_map_links + world_atlas_maps parent chain | `listWorldPlaces` / `listWorldAtlasMaps` / `getWorldAtlasMap` / nav tree |
| `upsertWorldAtlasMap` (secondary) | non-primary map | `deleteWorldAtlasMap` |
| `deleteWorldAtlasMap` | removes secondary only | list maps (primary graph intact) |

## Simulations

| Sim | Expected | Result |
|---|---|---|
| N-actors | Owner create; stranger delete/create denied (42501) | pass (self-test) |
| Invalid/missing | skip parent, cross-world, bad subtype, delete primary/root | pass fail-closed |
| Two consumers | list places + list maps read same primary ids after create | pass |

No dual geometry SoT; primary parent_map_id locked on upsert.
