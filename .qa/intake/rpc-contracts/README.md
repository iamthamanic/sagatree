# RPC command contracts (PREP-04 #777)

Count: **55**. Missing SQL defs: **1**.

| RPC | SQL files | Call sites | SECURITY DEFINER | Successor |
|---|---|---|---|---|
| `apply_session_runtime_command` | 9 | 1 | True | `server/src/application/commands/apply_session_runtime_command.ts` |
| `archive_world_node_subtree` | 1 | 1 | True | `server/src/application/commands/archive_world_node_subtree.ts` |
| `assign_npc_creature_controller` | 1 | 1 | True | `server/src/application/commands/assign_npc_creature_controller.ts` |
| `clear_npc_creature_instance_temp_controllers_for_session` | 1 | 1 | True | `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts` |
| `copy_native_saga_definition` | 1 | 1 | True | `server/src/application/commands/copy_native_saga_definition.ts` |
| `create_play_session` | 1 | 1 | True | `server/src/application/commands/create_play_session.ts` |
| `create_project_from_saga_version` | 1 | 1 | True | `server/src/application/commands/create_project_from_saga_version.ts` |
| `create_project_session` | 3 | 1 | True | `server/src/application/commands/create_project_session.ts` |
| `create_session_invite` | 1 | 1 | True | `server/src/application/commands/create_session_invite.ts` |
| `create_user_saga_definition` | 1 | 1 | True | `server/src/application/commands/create_user_saga_definition.ts` |
| `create_world_node_with_maps` | 1 | 1 | True | `server/src/application/commands/create_world_node_with_maps.ts` |
| `delete_world_node` | 1 | 1 | True | `server/src/application/commands/delete_world_node.ts` |
| `duplicate_saga_playthrough` | 1 | 1 | True | `server/src/application/commands/duplicate_saga_playthrough.ts` |
| `duplicate_world_node` | 1 | 1 | True | `server/src/application/commands/duplicate_world_node.ts` |
| `ensure_native_starter_project` | 3 | 1 | True | `server/src/application/commands/ensure_native_starter_project.ts` |
| `ensure_world_atlas_root` | 2 | 1 | True | `server/src/application/commands/ensure_world_atlas_root.ts` |
| `get_my_saga_permissions` | 1 | 1 | True | `server/src/application/commands/get_my_saga_permissions.ts` |
| `get_native_saga_definition_by_slug` | 1 | 1 | True | `server/src/application/commands/get_native_saga_definition_by_slug.ts` |
| `get_saga_definition_editor` | 1 | 1 | True | `server/src/application/commands/get_saga_definition_editor.ts` |
| `get_saga_definition_version` | 1 | 1 | True | `server/src/application/commands/get_saga_definition_version.ts` |
| `get_saga_lore_timeline` | 1 | 1 | True | `server/src/application/commands/get_saga_lore_timeline.ts` |
| `get_saga_overview` | 8 | 1 | True | `server/src/application/commands/get_saga_overview.ts` |
| `get_session_recap` | 2 | 1 | True | `server/src/application/commands/get_session_recap.ts` |
| `get_session_runtime_snapshot` | 3 | 1 | True | `server/src/application/commands/get_session_runtime_snapshot.ts` |
| `get_world_atlas_map` | 5 | 1 | True | `server/src/application/commands/get_world_atlas_map.ts` |
| `get_world_map` | 1 | 1 | True | `server/src/application/commands/get_world_map.ts` |
| `increment_marketplace_downloads` | 0 | 1 | False | `server/src/application/commands/increment_marketplace_downloads.ts` |
| `join_project_by_code` | 2 | 1 | True | `server/src/application/commands/join_project_by_code.ts` |
| `join_session_by_code` | 2 | 1 | True | `server/src/application/commands/join_session_by_code.ts` |
| `leave_play_session` | 2 | 1 | True | `server/src/application/commands/leave_play_session.ts` |
| `list_saga_bindings` | 2 | 1 | True | `server/src/application/commands/list_saga_bindings.ts` |
| `list_saga_member_permission_state` | 1 | 1 | True | `server/src/application/commands/list_saga_member_permission_state.ts` |
| `list_world_atlas_maps` | 2 | 1 | True | `server/src/application/commands/list_world_atlas_maps.ts` |
| `list_world_place_map_links` | 2 | 1 | True | `server/src/application/commands/list_world_place_map_links.ts` |
| `list_world_places` | 2 | 1 | True | `server/src/application/commands/list_world_places.ts` |
| `preview_world_node_consequences` | 1 | 1 | True | `server/src/application/commands/preview_world_node_consequences.ts` |
| `publish_saga_definition_version` | 1 | 1 | True | `server/src/application/commands/publish_saga_definition_version.ts` |
| `remove_npc_creature_instance` | 1 | 1 | True | `server/src/application/commands/remove_npc_creature_instance.ts` |
| `rename_world_node` | 1 | 1 | True | `server/src/application/commands/rename_world_node.ts` |
| `reparent_world_node` | 1 | 1 | True | `server/src/application/commands/reparent_world_node.ts` |
| `resolve_session_invite` | 1 | 1 | True | `server/src/application/commands/resolve_session_invite.ts` |
| `revoke_session_invite` | 1 | 1 | True | `server/src/application/commands/revoke_session_invite.ts` |
| `save_saga_definition_draft` | 1 | 1 | True | `server/src/application/commands/save_saga_definition_draft.ts` |
| `save_session_recap_summary` | 3 | 1 | True | `server/src/application/commands/save_session_recap_summary.ts` |
| `save_world_map` | 1 | 1 | True | `server/src/application/commands/save_world_map.ts` |
| `set_my_project_character` | 2 | 1 | True | `server/src/application/commands/set_my_project_character.ts` |
| `set_saga_binding_reveal` | 1 | 1 | True | `server/src/application/commands/set_saga_binding_reveal.ts` |
| `set_saga_member_bundle` | 1 | 1 | True | `server/src/application/commands/set_saga_member_bundle.ts` |
| `set_session_player_presence` | 1 | 1 | True | `server/src/application/commands/set_session_player_presence.ts` |
| `set_session_status` | 3 | 1 | True | `server/src/application/commands/set_session_status.ts` |
| `spawn_npc_creature_instance` | 1 | 1 | True | `server/src/application/commands/spawn_npc_creature_instance.ts` |
| `update_npc_creature_instance_runtime` | 1 | 1 | True | `server/src/application/commands/update_npc_creature_instance_runtime.ts` |
| `upsert_world_atlas_map` | 1 | 1 | True | `server/src/application/commands/upsert_world_atlas_map.ts` |
| `upsert_world_place` | 1 | 1 | True | `server/src/application/commands/upsert_world_place.ts` |
| `upsert_world_place_map_link` | 1 | 1 | True | `server/src/application/commands/upsert_world_place_map_link.ts` |
