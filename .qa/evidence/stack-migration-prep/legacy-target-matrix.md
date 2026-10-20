# Legacy → Target Mapping Matrix

> Draft for freigabe. Baseline `4bc40a31`. No cutover.

| ALTES SYSTEM | BESTEHENDER CODEPFAD | FACHLICHE VERANTWORTUNG | NEUER BAUSTEIN | NEUER CODEPFAD | MIGRATION | TEST |
|---|---|---|---|---|---|---|
| GoTrue / supabase.auth | `src/lib/auth-context.tsx`, `src/lib/supabase.ts` | Identität / Session | Better Auth (PROPOSED) | `server/src/auth/**` | MIG-014 / GATE-02 | Login/logout/session negatives |
| PostgreSQL + migrations | `supabase/migrations/**` (106) | Persistenz | SQLite + Drizzle (PROPOSED pending GATE-01) | `server/src/persistence/**` | MIG-011 / GATE-01 | Schema parity + FK |
| RLS / policies | SQL policies (~227 markers) | Autorisierung | SagaTree Policy Service | `server/src/permissions/**` | MIG-013 | Negative authz suite |
| SECURITY DEFINER RPCs | SQL functions (~181 DEFINER) | Privileged commands | TypeScript domain commands | `server/src/application/commands/**` | MIG-350..353 | Per-RPC parity |
| PostgREST `.from()` | `src/infrastructure/**` | CRUD reads/writes | Host HTTP + repositories | `server/src/api/**` + infra adapters | MIG-3xx | Area journey tests |
| Realtime channels | `src/infrastructure/session/session-runtime-channel.ts` | Live events | Colyseus (PROPOSED pending GATE-03) | `server/src/realtime/**` | MIG-021 | Resync/replay |
| Storage buckets | media/export functions + policies | Assets | Local protected asset service (+ optional tus) | `server/src/assets/**` | MIG-500/501 | Unauthorized fetch fail-closed |
| Edge Functions (Deno) | `supabase/functions/**` | Server workflows | Node TS services | `server/src/services/<fn>/**` | MIG-4xx | Per-function parity |
| Redis | dm-tools / cache usages | Ephemeral cache | In-process cache only if safe | `server/src/**` | wave-4 | Restart must not lose canon |
| Neo4j / lorekeeper | `supabase/functions/lorekeeper/**` | Lore graph | SQL relations / optional graph port | `server/src/services/lorekeeper/**` | MIG-4xx lorekeeper | Lore consistency |
| Ollama / AI providers | `supabase/functions/ai-gm/**`, `ai-provider-credentials` | Optional AI | Provider adapters | `server/src/ai/**` | MIG-4xx ai-* | Play without AI |
| LiveKit | session-media-token + media plane docs | A/V media plane | Keep LiveKit | existing + host token mint | media issues | CE media regressions |
| Docker Compose | `deployment/**`, compose files | Ops | Simplified host-centric compose | `deployment/**` | MIG-601 | Install/dev smoke |
| Tauri | (not present as product path) | Desktop shell | Tauri only pre external desktop test | desktop packaging | MIG-703 / GATE-05 | Packaging PoC |
| Edge `ai-gm` | `supabase/functions/ai-gm/**` | Function `ai-gm` | Node service | `server/src/services/ai-gm/**` | MIG-4xx | Function parity + authz |
| Edge `ai-provider-credentials` | `supabase/functions/ai-provider-credentials/**` | Function `ai-provider-credentials` | Node service | `server/src/services/ai-provider-credentials/**` | MIG-4xx | Function parity + authz |
| Edge `bestiary` | `supabase/functions/bestiary/**` | Function `bestiary` | Node service | `server/src/services/bestiary/**` | MIG-4xx | Function parity + authz |
| Edge `character-avatar-meshy` | `supabase/functions/character-avatar-meshy/**` | Function `character-avatar-meshy` | Node service | `server/src/services/character-avatar-meshy/**` | MIG-4xx | Function parity + authz |
| Edge `character-lore` | `supabase/functions/character-lore/**` | Function `character-lore` | Node service | `server/src/services/character-lore/**` | MIG-4xx | Function parity + authz |
| Edge `characters` | `supabase/functions/characters/**` | Function `characters` | Node service | `server/src/services/characters/**` | MIG-4xx | Function parity + authz |
| Edge `dm-tools` | `supabase/functions/dm-tools/**` | Function `dm-tools` | Node service | `server/src/services/dm-tools/**` | MIG-4xx | Function parity + authz |
| Edge `export` | `supabase/functions/export/**` | Function `export` | Node service | `server/src/services/export/**` | MIG-4xx | Function parity + authz |
| Edge `item-model3d` | `supabase/functions/item-model3d/**` | Function `item-model3d` | Node service | `server/src/services/item-model3d/**` | MIG-4xx | Function parity + authz |
| Edge `item-thumbnail` | `supabase/functions/item-thumbnail/**` | Function `item-thumbnail` | Node service | `server/src/services/item-thumbnail/**` | MIG-4xx | Function parity + authz |
| Edge `items` | `supabase/functions/items/**` | Function `items` | Node service | `server/src/services/items/**` | MIG-4xx | Function parity + authz |
| Edge `look-reference-analysis` | `supabase/functions/look-reference-analysis/**` | Function `look-reference-analysis` | Node service | `server/src/services/look-reference-analysis/**` | MIG-4xx | Function parity + authz |
| Edge `lorekeeper` | `supabase/functions/lorekeeper/**` | Function `lorekeeper` | Node service | `server/src/services/lorekeeper/**` | MIG-4xx | Function parity + authz |
| Edge `main` | `supabase/functions/main/**` | Function `main` | Node service | `server/src/services/main/**` | MIG-4xx | Function parity + authz |
| Edge `marketplace` | `supabase/functions/marketplace/**` | Function `marketplace` | Node service | `server/src/services/marketplace/**` | MIG-4xx | Function parity + authz |
| Edge `media` | `supabase/functions/media/**` | Function `media` | Node service | `server/src/services/media/**` | MIG-4xx | Function parity + authz |
| Edge `npcs` | `supabase/functions/npcs/**` | Function `npcs` | Node service | `server/src/services/npcs/**` | MIG-4xx | Function parity + authz |
| Edge `quests` | `supabase/functions/quests/**` | Function `quests` | Node service | `server/src/services/quests/**` | MIG-4xx | Function parity + authz |
| Edge `rulesets` | `supabase/functions/rulesets/**` | Function `rulesets` | Node service | `server/src/services/rulesets/**` | MIG-4xx | Function parity + authz |
| Edge `session-media-token` | `supabase/functions/session-media-token/**` | Function `session-media-token` | Node service | `server/src/services/session-media-token/**` | MIG-4xx | Function parity + authz |
| Edge `session-recap` | `supabase/functions/session-recap/**` | Function `session-recap` | Node service | `server/src/services/session-recap/**` | MIG-4xx | Function parity + authz |
| Edge `sessions` | `supabase/functions/sessions/**` | Function `sessions` | Node service | `server/src/services/sessions/**` | MIG-4xx | Function parity + authz |
| Edge `spellbook` | `supabase/functions/spellbook/**` | Function `spellbook` | Node service | `server/src/services/spellbook/**` | MIG-4xx | Function parity + authz |
| Edge `world` | `supabase/functions/world/**` | Function `world` | Node service | `server/src/services/world/**` | MIG-4xx | Function parity + authz |
| RPC `apply_session_runtime_command` | SQL + `src/infrastructure/**` `.rpc` | Command `apply_session_runtime_command` | TS command | `server/src/application/commands/apply_session_runtime_command.ts` | MIG-350..353 | Happy+negative parity |
| RPC `archive_world_node_subtree` | SQL + `src/infrastructure/**` `.rpc` | Command `archive_world_node_subtree` | TS command | `server/src/application/commands/archive_world_node_subtree.ts` | MIG-350..353 | Happy+negative parity |
| RPC `assign_npc_creature_controller` | SQL + `src/infrastructure/**` `.rpc` | Command `assign_npc_creature_controller` | TS command | `server/src/application/commands/assign_npc_creature_controller.ts` | MIG-350..353 | Happy+negative parity |
| RPC `clear_npc_creature_instance_temp_controllers_for_session` | SQL + `src/infrastructure/**` `.rpc` | Command `clear_npc_creature_instance_temp_controllers_for_session` | TS command | `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts` | MIG-350..353 | Happy+negative parity |
| RPC `copy_native_saga_definition` | SQL + `src/infrastructure/**` `.rpc` | Command `copy_native_saga_definition` | TS command | `server/src/application/commands/copy_native_saga_definition.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_play_session` | SQL + `src/infrastructure/**` `.rpc` | Command `create_play_session` | TS command | `server/src/application/commands/create_play_session.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_project_from_saga_version` | SQL + `src/infrastructure/**` `.rpc` | Command `create_project_from_saga_version` | TS command | `server/src/application/commands/create_project_from_saga_version.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_project_session` | SQL + `src/infrastructure/**` `.rpc` | Command `create_project_session` | TS command | `server/src/application/commands/create_project_session.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_session_invite` | SQL + `src/infrastructure/**` `.rpc` | Command `create_session_invite` | TS command | `server/src/application/commands/create_session_invite.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_user_saga_definition` | SQL + `src/infrastructure/**` `.rpc` | Command `create_user_saga_definition` | TS command | `server/src/application/commands/create_user_saga_definition.ts` | MIG-350..353 | Happy+negative parity |
| RPC `create_world_node_with_maps` | SQL + `src/infrastructure/**` `.rpc` | Command `create_world_node_with_maps` | TS command | `server/src/application/commands/create_world_node_with_maps.ts` | MIG-350..353 | Happy+negative parity |
| RPC `delete_world_node` | SQL + `src/infrastructure/**` `.rpc` | Command `delete_world_node` | TS command | `server/src/application/commands/delete_world_node.ts` | MIG-350..353 | Happy+negative parity |
| RPC `duplicate_saga_playthrough` | SQL + `src/infrastructure/**` `.rpc` | Command `duplicate_saga_playthrough` | TS command | `server/src/application/commands/duplicate_saga_playthrough.ts` | MIG-350..353 | Happy+negative parity |
| RPC `duplicate_world_node` | SQL + `src/infrastructure/**` `.rpc` | Command `duplicate_world_node` | TS command | `server/src/application/commands/duplicate_world_node.ts` | MIG-350..353 | Happy+negative parity |
| RPC `ensure_native_starter_project` | SQL + `src/infrastructure/**` `.rpc` | Command `ensure_native_starter_project` | TS command | `server/src/application/commands/ensure_native_starter_project.ts` | MIG-350..353 | Happy+negative parity |
| RPC `ensure_world_atlas_root` | SQL + `src/infrastructure/**` `.rpc` | Command `ensure_world_atlas_root` | TS command | `server/src/application/commands/ensure_world_atlas_root.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_my_saga_permissions` | SQL + `src/infrastructure/**` `.rpc` | Command `get_my_saga_permissions` | TS command | `server/src/application/commands/get_my_saga_permissions.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_native_saga_definition_by_slug` | SQL + `src/infrastructure/**` `.rpc` | Command `get_native_saga_definition_by_slug` | TS command | `server/src/application/commands/get_native_saga_definition_by_slug.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_saga_definition_editor` | SQL + `src/infrastructure/**` `.rpc` | Command `get_saga_definition_editor` | TS command | `server/src/application/commands/get_saga_definition_editor.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_saga_definition_version` | SQL + `src/infrastructure/**` `.rpc` | Command `get_saga_definition_version` | TS command | `server/src/application/commands/get_saga_definition_version.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_saga_lore_timeline` | SQL + `src/infrastructure/**` `.rpc` | Command `get_saga_lore_timeline` | TS command | `server/src/application/commands/get_saga_lore_timeline.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_saga_overview` | SQL + `src/infrastructure/**` `.rpc` | Command `get_saga_overview` | TS command | `server/src/application/commands/get_saga_overview.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_session_recap` | SQL + `src/infrastructure/**` `.rpc` | Command `get_session_recap` | TS command | `server/src/application/commands/get_session_recap.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_session_runtime_snapshot` | SQL + `src/infrastructure/**` `.rpc` | Command `get_session_runtime_snapshot` | TS command | `server/src/application/commands/get_session_runtime_snapshot.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_world_atlas_map` | SQL + `src/infrastructure/**` `.rpc` | Command `get_world_atlas_map` | TS command | `server/src/application/commands/get_world_atlas_map.ts` | MIG-350..353 | Happy+negative parity |
| RPC `get_world_map` | SQL + `src/infrastructure/**` `.rpc` | Command `get_world_map` | TS command | `server/src/application/commands/get_world_map.ts` | MIG-350..353 | Happy+negative parity |
| RPC `increment_marketplace_downloads` | SQL + `src/infrastructure/**` `.rpc` | Command `increment_marketplace_downloads` | TS command | `server/src/application/commands/increment_marketplace_downloads.ts` | MIG-350..353 | Happy+negative parity |
| RPC `join_project_by_code` | SQL + `src/infrastructure/**` `.rpc` | Command `join_project_by_code` | TS command | `server/src/application/commands/join_project_by_code.ts` | MIG-350..353 | Happy+negative parity |
| RPC `join_session_by_code` | SQL + `src/infrastructure/**` `.rpc` | Command `join_session_by_code` | TS command | `server/src/application/commands/join_session_by_code.ts` | MIG-350..353 | Happy+negative parity |
| RPC `leave_play_session` | SQL + `src/infrastructure/**` `.rpc` | Command `leave_play_session` | TS command | `server/src/application/commands/leave_play_session.ts` | MIG-350..353 | Happy+negative parity |
| RPC `list_saga_bindings` | SQL + `src/infrastructure/**` `.rpc` | Command `list_saga_bindings` | TS command | `server/src/application/commands/list_saga_bindings.ts` | MIG-350..353 | Happy+negative parity |
| RPC `list_saga_member_permission_state` | SQL + `src/infrastructure/**` `.rpc` | Command `list_saga_member_permission_state` | TS command | `server/src/application/commands/list_saga_member_permission_state.ts` | MIG-350..353 | Happy+negative parity |
| RPC `list_world_atlas_maps` | SQL + `src/infrastructure/**` `.rpc` | Command `list_world_atlas_maps` | TS command | `server/src/application/commands/list_world_atlas_maps.ts` | MIG-350..353 | Happy+negative parity |
| RPC `list_world_place_map_links` | SQL + `src/infrastructure/**` `.rpc` | Command `list_world_place_map_links` | TS command | `server/src/application/commands/list_world_place_map_links.ts` | MIG-350..353 | Happy+negative parity |
| RPC `list_world_places` | SQL + `src/infrastructure/**` `.rpc` | Command `list_world_places` | TS command | `server/src/application/commands/list_world_places.ts` | MIG-350..353 | Happy+negative parity |
| RPC `preview_world_node_consequences` | SQL + `src/infrastructure/**` `.rpc` | Command `preview_world_node_consequences` | TS command | `server/src/application/commands/preview_world_node_consequences.ts` | MIG-350..353 | Happy+negative parity |
| RPC `publish_saga_definition_version` | SQL + `src/infrastructure/**` `.rpc` | Command `publish_saga_definition_version` | TS command | `server/src/application/commands/publish_saga_definition_version.ts` | MIG-350..353 | Happy+negative parity |
| RPC `remove_npc_creature_instance` | SQL + `src/infrastructure/**` `.rpc` | Command `remove_npc_creature_instance` | TS command | `server/src/application/commands/remove_npc_creature_instance.ts` | MIG-350..353 | Happy+negative parity |
| RPC `rename_world_node` | SQL + `src/infrastructure/**` `.rpc` | Command `rename_world_node` | TS command | `server/src/application/commands/rename_world_node.ts` | MIG-350..353 | Happy+negative parity |
| RPC `reparent_world_node` | SQL + `src/infrastructure/**` `.rpc` | Command `reparent_world_node` | TS command | `server/src/application/commands/reparent_world_node.ts` | MIG-350..353 | Happy+negative parity |
| RPC `resolve_session_invite` | SQL + `src/infrastructure/**` `.rpc` | Command `resolve_session_invite` | TS command | `server/src/application/commands/resolve_session_invite.ts` | MIG-350..353 | Happy+negative parity |
| RPC `revoke_session_invite` | SQL + `src/infrastructure/**` `.rpc` | Command `revoke_session_invite` | TS command | `server/src/application/commands/revoke_session_invite.ts` | MIG-350..353 | Happy+negative parity |
| RPC `save_saga_definition_draft` | SQL + `src/infrastructure/**` `.rpc` | Command `save_saga_definition_draft` | TS command | `server/src/application/commands/save_saga_definition_draft.ts` | MIG-350..353 | Happy+negative parity |
| RPC `save_session_recap_summary` | SQL + `src/infrastructure/**` `.rpc` | Command `save_session_recap_summary` | TS command | `server/src/application/commands/save_session_recap_summary.ts` | MIG-350..353 | Happy+negative parity |
| RPC `save_world_map` | SQL + `src/infrastructure/**` `.rpc` | Command `save_world_map` | TS command | `server/src/application/commands/save_world_map.ts` | MIG-350..353 | Happy+negative parity |
| RPC `set_my_project_character` | SQL + `src/infrastructure/**` `.rpc` | Command `set_my_project_character` | TS command | `server/src/application/commands/set_my_project_character.ts` | MIG-350..353 | Happy+negative parity |
| RPC `set_saga_binding_reveal` | SQL + `src/infrastructure/**` `.rpc` | Command `set_saga_binding_reveal` | TS command | `server/src/application/commands/set_saga_binding_reveal.ts` | MIG-350..353 | Happy+negative parity |
| RPC `set_saga_member_bundle` | SQL + `src/infrastructure/**` `.rpc` | Command `set_saga_member_bundle` | TS command | `server/src/application/commands/set_saga_member_bundle.ts` | MIG-350..353 | Happy+negative parity |
| RPC `set_session_player_presence` | SQL + `src/infrastructure/**` `.rpc` | Command `set_session_player_presence` | TS command | `server/src/application/commands/set_session_player_presence.ts` | MIG-350..353 | Happy+negative parity |
| RPC `set_session_status` | SQL + `src/infrastructure/**` `.rpc` | Command `set_session_status` | TS command | `server/src/application/commands/set_session_status.ts` | MIG-350..353 | Happy+negative parity |
| RPC `spawn_npc_creature_instance` | SQL + `src/infrastructure/**` `.rpc` | Command `spawn_npc_creature_instance` | TS command | `server/src/application/commands/spawn_npc_creature_instance.ts` | MIG-350..353 | Happy+negative parity |
| RPC `update_npc_creature_instance_runtime` | SQL + `src/infrastructure/**` `.rpc` | Command `update_npc_creature_instance_runtime` | TS command | `server/src/application/commands/update_npc_creature_instance_runtime.ts` | MIG-350..353 | Happy+negative parity |
| RPC `upsert_world_atlas_map` | SQL + `src/infrastructure/**` `.rpc` | Command `upsert_world_atlas_map` | TS command | `server/src/application/commands/upsert_world_atlas_map.ts` | MIG-350..353 | Happy+negative parity |
| RPC `upsert_world_place` | SQL + `src/infrastructure/**` `.rpc` | Command `upsert_world_place` | TS command | `server/src/application/commands/upsert_world_place.ts` | MIG-350..353 | Happy+negative parity |
| RPC `upsert_world_place_map_link` | SQL + `src/infrastructure/**` `.rpc` | Command `upsert_world_place_map_link` | TS command | `server/src/application/commands/upsert_world_place_map_link.ts` | MIG-350..353 | Happy+negative parity |
| Infra `ai` | `src/infrastructure/ai/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/ai/**` | MIG-3xx | Journey + negatives |
| Infra `character` | `src/infrastructure/character/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/character/**` | MIG-3xx | Journey + negatives |
| Infra `inventory` | `src/infrastructure/inventory/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/inventory/**` | MIG-3xx | Journey + negatives |
| Infra `look` | `src/infrastructure/look/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/look/**` | MIG-3xx | Journey + negatives |
| Infra `marketplace` | `src/infrastructure/marketplace/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/marketplace/**` | MIG-3xx | Journey + negatives |
| Infra `media` | `src/infrastructure/media/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/media/**` | MIG-3xx | Journey + negatives |
| Infra `npc-creature` | `src/infrastructure/npc-creature/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/npc-creature/**` | MIG-3xx | Journey + negatives |
| Infra `project` | `src/infrastructure/project/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/project/**` | MIG-3xx | Journey + negatives |
| Infra `rulesets` | `src/infrastructure/rulesets/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/rulesets/**` | MIG-3xx | Journey + negatives |
| Infra `saga` | `src/infrastructure/saga/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/saga/**` | MIG-3xx | Journey + negatives |
| Infra `session` | `src/infrastructure/session/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/session/**` | MIG-3xx | Journey + negatives |
| Infra `user-profile` | `src/infrastructure/user-profile/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/user-profile/**` | MIG-3xx | Journey + negatives |
| Infra `world` | `src/infrastructure/world/**` | Adapter area | Host-backed adapter | same facade + `server/src/application/world/**` | MIG-3xx | Journey + negatives |
