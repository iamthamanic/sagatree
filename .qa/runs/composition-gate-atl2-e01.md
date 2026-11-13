# Composition Gate — atl2-e01

- HEAD: a260606ed0854c841431eae3c09dbb0ebae06694 (pre-commit; WORKTREE matches uncommitted E01 scope)
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
