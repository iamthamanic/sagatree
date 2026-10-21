# Edge / infrastructure implementation mapping

One exact parent ticket exists for every Edge entry and every infrastructure area. This table supersedes the earlier broad suggested clusters. It is a contract map, not approval to implement or expose a route.

## Edge mapping

| Contract | Parent | Disposition |
|---|---|---|
| [ai-gm](edge-ai-gm.md) | #817 | Preserve external 404; no automatic host route or public activation. |
| [ai-provider-credentials](edge-ai-provider-credentials.md) | #818 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [bestiary](edge-bestiary.md) | #819 | Preserve external 404; no automatic host route or public activation. |
| [character-avatar-meshy](edge-character-avatar-meshy.md) | #820 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [character-lore](edge-character-lore.md) | #821 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [characters](edge-characters.md) | #822 | Preserve external 404; no automatic host route or public activation. |
| [dm-tools](edge-dm-tools.md) | #823 | Preserve external 404; no automatic host route or public activation. |
| [export](edge-export.md) | #824 | Preserve external 404; no automatic host route or public activation. |
| [item-model3d](edge-item-model3d.md) | #825 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [item-thumbnail](edge-item-thumbnail.md) | #826 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [items](edge-items.md) | #827 | Preserve external 404; no automatic host route or public activation. |
| [look-reference-analysis](edge-look-reference-analysis.md) | #828 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [lorekeeper](edge-lorekeeper.md) | #829 | Preserve external 404; no automatic host route or public activation. |
| [main](edge-main.md) | #830 | Preserve exact dispatch boundary until host cutover. |
| [marketplace](edge-marketplace.md) | #831 | Preserve external 404; no automatic host route or public activation. |
| [media](edge-media.md) | #832 | Preserve external 404; no automatic host route or public activation. |
| [npcs](edge-npcs.md) | #833 | Preserve external 404; no automatic host route or public activation. |
| [quests](edge-quests.md) | #834 | Preserve external 404; no automatic host route or public activation. |
| [rulesets](edge-rulesets.md) | #835 | Preserve external 404; no automatic host route or public activation. |
| [session-media-token](edge-session-media-token.md) | #836 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [session-recap](edge-session-recap.md) | #837 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [sessions](edge-sessions.md) | #838 | Preserve external 404; no automatic host route or public activation. |
| [spellbook](edge-spellbook.md) | #839 | Preserve external 404; no automatic host route or public activation. |
| [world](edge-world.md) | #840 | Preserve external 404; no automatic host route or public activation. |

## Infrastructure mapping and complete dependency list

### ai — #800

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `ai-provider-credentials` | #818 |  |
| auth | `authenticated account/session transport` | #793 |  |

### character — #801

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `character-avatar-meshy` | #820 |  |
| edge | `character-lore` | #821 |  |
| table | `character_adventure_arcs` | #791 | Policy #792 |
| table | `character_avatar_artifacts` | #791 | Policy #792 |
| table | `character_avatar_export_assets` | #791 | Policy #792 |
| table | `character_avatar_import_assets` | #791 | Policy #792 |
| table | `character_presets` | #791 | Policy #792 |
| table | `characters` | #791 | Policy #792 |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| storage | `character-avatars` | #841 |  |
| storage | `character-portraits` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `inventory` | #802 |  |
| infra | `look` | #803 |  |
| infra | `media` | #805 |  |
| infra | `project` | #807 |  |
| infra | `session` | #810 |  |

### inventory — #802

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `item-model3d` | #825 |  |
| edge | `item-thumbnail` | #826 |  |
| table | `characters` | #791 | Policy #792 |
| table | `inventory_item_definitions` | #791 | Policy #792 |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |
| infra | `media` | #805 |  |

### look — #803

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `look-reference-analysis` | #828 |  |
| table | `look_profile_versions` | #791 | Policy #792 |
| table | `look_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |

### marketplace — #804

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `increment_marketplace_downloads` | #816 | RPC-MARKETPLACE-COUNT |
| table | `marketplace_items` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

### media — #805

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### npc-creature — #806

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `assign_npc_creature_controller` | #816 | RPC-NPC-INSTANCES |
| rpc | `clear_npc_creature_instance_temp_controllers_for_session` | #816 | RPC-NPC-INSTANCES |
| rpc | `remove_npc_creature_instance` | #816 | RPC-NPC-INSTANCES |
| rpc | `spawn_npc_creature_instance` | #816 | RPC-NPC-INSTANCES |
| rpc | `update_npc_creature_instance_runtime` | #816 | RPC-NPC-INSTANCES |
| table | `npc_creature_controller_assignments` | #791 | Policy #792 |
| table | `npc_creature_definitions` | #791 | Policy #792 |
| table | `npc_creature_instances` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

### project — #807

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `create_project_session` | #814 | RPC-SESSION-LIFECYCLE |
| rpc | `ensure_native_starter_project` | #815 | RPC-SAGA-PROVISION |
| rpc | `get_my_saga_permissions` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `get_saga_lore_timeline` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `get_saga_overview` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `join_project_by_code` | #815 | RPC-PROJECT-MEMBERSHIP |
| rpc | `list_saga_bindings` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `list_saga_member_permission_state` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `set_my_project_character` | #815 | RPC-PROJECT-MEMBERSHIP |
| rpc | `set_saga_binding_reveal` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `set_saga_member_bundle` | #815 | RPC-SAGA-GOVERNANCE |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

### rulesets — #808

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| table | `rulesets` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

### saga — #809

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `copy_native_saga_definition` | #815 | RPC-SAGA-AUTHORING |
| rpc | `create_project_from_saga_version` | #815 | RPC-SAGA-PROVISION |
| rpc | `create_user_saga_definition` | #815 | RPC-SAGA-AUTHORING |
| rpc | `duplicate_saga_playthrough` | #815 | RPC-SAGA-PROVISION |
| rpc | `get_native_saga_definition_by_slug` | #815 | RPC-SAGA-VERSION-READ |
| rpc | `get_saga_definition_editor` | #815 | RPC-SAGA-AUTHORING |
| rpc | `get_saga_definition_version` | #815 | RPC-SAGA-VERSION-READ |
| rpc | `promote_session_outcome_to_saga` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `promote_session_outcome_to_world` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `publish_saga_definition_version` | #815 | RPC-SAGA-AUTHORING |
| rpc | `save_saga_definition_draft` | #815 | RPC-SAGA-AUTHORING |
| auth | `authenticated account/session transport` | #793 |  |

### session — #810

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `apply_session_runtime_command` | #814 | RPC-SESSION-RUNTIME |
| rpc | `create_play_session` | #814 | RPC-SESSION-LIFECYCLE |
| rpc | `create_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `get_session_recap` | #814 | RPC-SESSION-RECAP |
| rpc | `get_session_runtime_snapshot` | #814 | RPC-SESSION-RUNTIME |
| rpc | `join_session_by_code` | #814 | RPC-SESSION-ACCESS |
| rpc | `leave_play_session` | #814 | RPC-SESSION-ACCESS |
| rpc | `resolve_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `revoke_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `save_session_recap_summary` | #814 | RPC-SESSION-RECAP |
| rpc | `set_session_player_presence` | #814 | RPC-SESSION-RUNTIME |
| rpc | `set_session_status` | #814 | RPC-SESSION-LIFECYCLE |
| edge | `session-media-token` | #836 |  |
| edge | `session-recap` | #837 |  |
| table | `projects` | #791 | Policy #792 |
| table | `session_players` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| realtime | `postgres_changes channels and cleanup` | #796 |  |
| auth | `authenticated account/session transport` | #793 |  |

### user-profile — #811

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| table | `user_profiles` | #791 | Policy #792 |
| storage | `user-avatars` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `media` | #805 |  |

### world — #812

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `archive_world_node_subtree` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `create_world_node_with_maps` | #813 | RPC-WORLD-CREATE |
| rpc | `delete_world_node` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `duplicate_world_node` | #813 | RPC-WORLD-RESTRUCTURE |
| rpc | `ensure_world_atlas_root` | #813 | RPC-ATLAS-MAPS |
| rpc | `get_world_atlas_map` | #813 | RPC-ATLAS-MAPS |
| rpc | `get_world_map` | #813 | RPC-WORLD-MAP |
| rpc | `list_world_atlas_maps` | #813 | RPC-ATLAS-MAPS |
| rpc | `list_world_place_map_links` | #813 | RPC-WORLD-PLACES |
| rpc | `list_world_places` | #813 | RPC-WORLD-PLACES |
| rpc | `preview_world_node_consequences` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `rename_world_node` | #813 | RPC-WORLD-CREATE |
| rpc | `reparent_world_node` | #813 | RPC-WORLD-RESTRUCTURE |
| rpc | `save_world_map` | #813 | RPC-WORLD-MAP |
| rpc | `upsert_world_atlas_map` | #813 | RPC-ATLAS-MAPS |
| rpc | `upsert_world_place` | #813 | RPC-WORLD-PLACES |
| rpc | `upsert_world_place_map_link` | #813 | RPC-WORLD-PLACES |
| table | `inventory_item_definitions` | #791 | Policy #792 |
| table | `npc_creature_definitions` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| storage | `world-atlas` | #841 |  |
| storage | `world-map-pins` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `media` | #805 |  |


## RPC binding rule

Use the exclusive groups in `../rpc-contracts/split-groups.json`: world/atlas #813; session lifecycle/runtime/invites/recap #814; saga/project including both outcome promotions #815; NPC/controller plus marketplace #816. No name-prefix heuristic and no duplicate primary parent.

Internal quota RPCs remain explicit prerequisites of their owning Edge issue; they are not silently dropped because they are outside the 57 browser-call RPC names.

## Implementation exit conditions

- Architecture decisions and host dependencies must be accepted before successor implementation.
- Every exact request/result/error and side-effect fixture must pass against the source-backed contract; live and successor parity evidence are recorded separately.
- Unmounted workers keep404. Removing a legacy file or adding an internal replacement requires the corresponding ticket decision; this contract does not create a new public API.
- No owner key access broadening, speculative RLS, silent provider retries, untested partial persistence guarantees or changed secret exposure.

