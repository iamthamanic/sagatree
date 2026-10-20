# Infrastructure `world`

## VORHER
- Area root: `src/infrastructure/world/`
  - `src/infrastructure/world/world-atlas-service.ts`
  - `src/infrastructure/world/world-map-service.ts`
  - `src/infrastructure/world/world-place-service.ts`
  - `src/infrastructure/world/world-profile-service.ts`
- RPCs: `archive_world_node_subtree`, `create_world_node_with_maps`, `delete_world_node`, `duplicate_world_node`, `ensure_world_atlas_root`, `get_world_atlas_map`, `get_world_map`, `list_world_atlas_maps`, `list_world_place_map_links`, `list_world_places`, `preview_world_node_consequences`, `rename_world_node`, `reparent_world_node`, `save_world_map`, `upsert_world_atlas_map`, `upsert_world_place`, `upsert_world_place_map_link`
- Tables `.from`: `inventory_item_definitions`, `npc_creature_definitions`, `world-map-pins`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/world/** → HTTP/client to server/src/application/world/
- Depends: GATE-01, RPC:archive_world_node_subtree, RPC:create_world_node_with_maps, RPC:delete_world_node, RPC:duplicate_world_node, RPC:ensure_world_atlas_root
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: archive_world_node_subtree, create_world_node_with_maps, delete_world_node, duplicate_world_node, ensure_world_atlas_root, get_world_atlas_map, get_world_map, list_world_atlas_maps…

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports
