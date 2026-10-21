# Legacy → Host: vollständige Quellzuordnung

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellverifikation ist keine Bestätigung des produktiven Deploy-Zustands. Die dynamischen Promotion-Aufrufe sind in den 57 RPCs enthalten. 18 Untertickets besitzen je eine exklusive Teilmenge; die vier früheren Sammeltickets koordinieren deren Abnahme.

## Querschnitt

| Quelle / Verhalten | Nachfolger-Vertrag | Abnahme |
| --- | --- | --- |
| SQL-Schema, FKs, JSON, UUIDs, Zeitstempel | MIG-011 #790 / MIG-503 #844 | Versionierte Migration, Rollback, kanonische Zeilen-/FK-Prüfung |
| RLS und effektive EXECUTE-ACL | MIG-013 #792 / MIG-600 #845 | Owner/GM/Spieler/anon getrennt; direkte Helper-Bypässe negativ prüfen |
| GoTrue / Actor-Kontext | MIG-014 #793 / MIG-015 #794 | Remote-Sitzung, Widerruf, Loopback-Grenze |
| Supabase Realtime und Lobby Broadcast | MIG-021 #796 / MIG-024 #799 | Snapshot/Delta/Ready/Resync und Rollenprojektion |
| Supabase Storage | MIG-500 #841 / MIG-501 #842 | Autorisierung, Byte-/Metadaten-Commit, optionales Resume |
| Export/Import | MIG-502 #843 | Version, Prüfsummen, IDs, Restore-Drill |
| AI Provider / Secrets / Quotas | Einzelne Edge-Verträge | Aktuelle Grenze zwischen persistenten und flüchtigen Quotas; kein Credential-Leak |
| LiveKit | MIG-420 #836 / MIG-306 #805 | Aktive Projekt-Membership, Rollen-Normalisierung, TTL, SDK-Lifecycle |
| Docker und Betrieb | MIG-601 #846 / MIG-603 #848 | Persistente Volumes, Backup, Restore und Update-Rollback |
| Atlas Produktpfad | Atlas #770 | Echter Browser plus isolierte SQL-Zustandsassertions |

## 57 Frontend-RPCs

| RPC | Beleg | Primärer Nachfolger | Source-Status |
| --- | --- | --- | --- |
| apply_session_runtime_command | [Quellvertrag](../../intake/rpc-contracts/apply_session_runtime_command.md) | RPC-SESSION-RUNTIME #867 | source-verified |
| archive_world_node_subtree | [Quellvertrag](../../intake/rpc-contracts/archive_world_node_subtree.md) | RPC-WORLD-DESTRUCTIVE #866 | source-verified |
| assign_npc_creature_controller | [Quellvertrag](../../intake/rpc-contracts/assign_npc_creature_controller.md) | RPC-NPC-INSTANCES #877 | source-verified |
| clear_npc_creature_instance_temp_controllers_for_session | [Quellvertrag](../../intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md) | RPC-NPC-INSTANCES #877 | source-verified |
| copy_native_saga_definition | [Quellvertrag](../../intake/rpc-contracts/copy_native_saga_definition.md) | RPC-SAGA-AUTHORING #871 | source-verified |
| create_play_session | [Quellvertrag](../../intake/rpc-contracts/create_play_session.md) | RPC-SESSION-LIFECYCLE #868 | source-verified |
| create_project_from_saga_version | [Quellvertrag](../../intake/rpc-contracts/create_project_from_saga_version.md) | RPC-SAGA-PROVISION #873 | source-verified |
| create_project_session | [Quellvertrag](../../intake/rpc-contracts/create_project_session.md) | RPC-SESSION-LIFECYCLE #868 | source-verified |
| create_session_invite | [Quellvertrag](../../intake/rpc-contracts/create_session_invite.md) | RPC-SESSION-ACCESS #869 | source-verified |
| create_user_saga_definition | [Quellvertrag](../../intake/rpc-contracts/create_user_saga_definition.md) | RPC-SAGA-AUTHORING #871 | source-verified |
| create_world_node_with_maps | [Quellvertrag](../../intake/rpc-contracts/create_world_node_with_maps.md) | RPC-WORLD-CREATE #864 | source-verified |
| delete_world_node | [Quellvertrag](../../intake/rpc-contracts/delete_world_node.md) | RPC-WORLD-DESTRUCTIVE #866 | source-verified |
| duplicate_saga_playthrough | [Quellvertrag](../../intake/rpc-contracts/duplicate_saga_playthrough.md) | RPC-SAGA-PROVISION #873 | source-verified |
| duplicate_world_node | [Quellvertrag](../../intake/rpc-contracts/duplicate_world_node.md) | RPC-WORLD-RESTRUCTURE #865 | source-verified |
| ensure_native_starter_project | [Quellvertrag](../../intake/rpc-contracts/ensure_native_starter_project.md) | RPC-SAGA-PROVISION #873 | source-verified |
| ensure_world_atlas_root | [Quellvertrag](../../intake/rpc-contracts/ensure_world_atlas_root.md) | RPC-ATLAS-MAPS #862 | source-verified |
| get_my_saga_permissions | [Quellvertrag](../../intake/rpc-contracts/get_my_saga_permissions.md) | RPC-SAGA-GOVERNANCE #875 | source-verified |
| get_native_saga_definition_by_slug | [Quellvertrag](../../intake/rpc-contracts/get_native_saga_definition_by_slug.md) | RPC-SAGA-VERSION-READ #872 | source-verified |
| get_saga_definition_editor | [Quellvertrag](../../intake/rpc-contracts/get_saga_definition_editor.md) | RPC-SAGA-AUTHORING #871 | source-verified |
| get_saga_definition_version | [Quellvertrag](../../intake/rpc-contracts/get_saga_definition_version.md) | RPC-SAGA-VERSION-READ #872 | source-verified |
| get_saga_lore_timeline | [Quellvertrag](../../intake/rpc-contracts/get_saga_lore_timeline.md) | RPC-SAGA-PROJECTIONS #876 | source-verified |
| get_saga_overview | [Quellvertrag](../../intake/rpc-contracts/get_saga_overview.md) | RPC-SAGA-PROJECTIONS #876 | source-verified |
| get_session_recap | [Quellvertrag](../../intake/rpc-contracts/get_session_recap.md) | RPC-SESSION-RECAP #870 | source-verified |
| get_session_runtime_snapshot | [Quellvertrag](../../intake/rpc-contracts/get_session_runtime_snapshot.md) | RPC-SESSION-RUNTIME #867 | source-verified |
| get_world_atlas_map | [Quellvertrag](../../intake/rpc-contracts/get_world_atlas_map.md) | RPC-ATLAS-MAPS #862 | source-verified |
| get_world_map | [Quellvertrag](../../intake/rpc-contracts/get_world_map.md) | RPC-WORLD-MAP #861 | source-verified |
| increment_marketplace_downloads | [Quellvertrag](../../intake/rpc-contracts/increment_marketplace_downloads.md) | RPC-MARKETPLACE-COUNT #878 | source-blocked |
| join_project_by_code | [Quellvertrag](../../intake/rpc-contracts/join_project_by_code.md) | RPC-PROJECT-MEMBERSHIP #874 | source-verified |
| join_session_by_code | [Quellvertrag](../../intake/rpc-contracts/join_session_by_code.md) | RPC-SESSION-ACCESS #869 | source-verified |
| leave_play_session | [Quellvertrag](../../intake/rpc-contracts/leave_play_session.md) | RPC-SESSION-ACCESS #869 | source-verified |
| list_saga_bindings | [Quellvertrag](../../intake/rpc-contracts/list_saga_bindings.md) | RPC-SAGA-GOVERNANCE #875 | source-verified |
| list_saga_member_permission_state | [Quellvertrag](../../intake/rpc-contracts/list_saga_member_permission_state.md) | RPC-SAGA-GOVERNANCE #875 | source-verified |
| list_world_atlas_maps | [Quellvertrag](../../intake/rpc-contracts/list_world_atlas_maps.md) | RPC-ATLAS-MAPS #862 | source-verified |
| list_world_place_map_links | [Quellvertrag](../../intake/rpc-contracts/list_world_place_map_links.md) | RPC-WORLD-PLACES #863 | source-verified |
| list_world_places | [Quellvertrag](../../intake/rpc-contracts/list_world_places.md) | RPC-WORLD-PLACES #863 | source-verified |
| preview_world_node_consequences | [Quellvertrag](../../intake/rpc-contracts/preview_world_node_consequences.md) | RPC-WORLD-DESTRUCTIVE #866 | source-verified |
| promote_session_outcome_to_saga | [Quellvertrag](../../intake/rpc-contracts/promote_session_outcome_to_saga.md) | RPC-SAGA-PROJECTIONS #876 | source-verified |
| promote_session_outcome_to_world | [Quellvertrag](../../intake/rpc-contracts/promote_session_outcome_to_world.md) | RPC-SAGA-PROJECTIONS #876 | source-verified |
| publish_saga_definition_version | [Quellvertrag](../../intake/rpc-contracts/publish_saga_definition_version.md) | RPC-SAGA-AUTHORING #871 | source-verified |
| remove_npc_creature_instance | [Quellvertrag](../../intake/rpc-contracts/remove_npc_creature_instance.md) | RPC-NPC-INSTANCES #877 | source-verified |
| rename_world_node | [Quellvertrag](../../intake/rpc-contracts/rename_world_node.md) | RPC-WORLD-CREATE #864 | source-verified |
| reparent_world_node | [Quellvertrag](../../intake/rpc-contracts/reparent_world_node.md) | RPC-WORLD-RESTRUCTURE #865 | source-verified |
| resolve_session_invite | [Quellvertrag](../../intake/rpc-contracts/resolve_session_invite.md) | RPC-SESSION-ACCESS #869 | source-verified |
| revoke_session_invite | [Quellvertrag](../../intake/rpc-contracts/revoke_session_invite.md) | RPC-SESSION-ACCESS #869 | source-verified |
| save_saga_definition_draft | [Quellvertrag](../../intake/rpc-contracts/save_saga_definition_draft.md) | RPC-SAGA-AUTHORING #871 | source-verified |
| save_session_recap_summary | [Quellvertrag](../../intake/rpc-contracts/save_session_recap_summary.md) | RPC-SESSION-RECAP #870 | source-verified |
| save_world_map | [Quellvertrag](../../intake/rpc-contracts/save_world_map.md) | RPC-WORLD-MAP #861 | source-verified |
| set_my_project_character | [Quellvertrag](../../intake/rpc-contracts/set_my_project_character.md) | RPC-PROJECT-MEMBERSHIP #874 | source-verified |
| set_saga_binding_reveal | [Quellvertrag](../../intake/rpc-contracts/set_saga_binding_reveal.md) | RPC-SAGA-GOVERNANCE #875 | source-verified |
| set_saga_member_bundle | [Quellvertrag](../../intake/rpc-contracts/set_saga_member_bundle.md) | RPC-SAGA-GOVERNANCE #875 | source-verified |
| set_session_player_presence | [Quellvertrag](../../intake/rpc-contracts/set_session_player_presence.md) | RPC-SESSION-RUNTIME #867 | source-verified |
| set_session_status | [Quellvertrag](../../intake/rpc-contracts/set_session_status.md) | RPC-SESSION-LIFECYCLE #868 | source-verified |
| spawn_npc_creature_instance | [Quellvertrag](../../intake/rpc-contracts/spawn_npc_creature_instance.md) | RPC-NPC-INSTANCES #877 | source-verified |
| update_npc_creature_instance_runtime | [Quellvertrag](../../intake/rpc-contracts/update_npc_creature_instance_runtime.md) | RPC-NPC-INSTANCES #877 | source-verified |
| upsert_world_atlas_map | [Quellvertrag](../../intake/rpc-contracts/upsert_world_atlas_map.md) | RPC-ATLAS-MAPS #862 | source-verified |
| upsert_world_place | [Quellvertrag](../../intake/rpc-contracts/upsert_world_place.md) | RPC-WORLD-PLACES #863 | source-verified |
| upsert_world_place_map_link | [Quellvertrag](../../intake/rpc-contracts/upsert_world_place_map_link.md) | RPC-WORLD-PLACES #863 | source-verified |

## 24 Edge-Verzeichnisse

Erreichbarkeit: acht erlaubte Worker, 15 nicht eingebundene Legacy-Worker und main als Dispatcher. Ein vorhandener Legacy-Handler ist keine Aktivierungsfreigabe.

| Funktion | Beleg | Nachfolger-Ticket | Aktuelle Einbindung |
| --- | --- | --- | --- |
| ai-gm | [Quellvertrag](../../intake/edge-infra-contracts/edge-ai-gm.md) | #817 | legacy-unmounted |
| ai-provider-credentials | [Quellvertrag](../../intake/edge-infra-contracts/edge-ai-provider-credentials.md) | #818 | allowlisted-worker |
| bestiary | [Quellvertrag](../../intake/edge-infra-contracts/edge-bestiary.md) | #819 | legacy-unmounted |
| character-avatar-meshy | [Quellvertrag](../../intake/edge-infra-contracts/edge-character-avatar-meshy.md) | #820 | allowlisted-worker |
| character-lore | [Quellvertrag](../../intake/edge-infra-contracts/edge-character-lore.md) | #821 | allowlisted-worker |
| characters | [Quellvertrag](../../intake/edge-infra-contracts/edge-characters.md) | #822 | legacy-unmounted |
| dm-tools | [Quellvertrag](../../intake/edge-infra-contracts/edge-dm-tools.md) | #823 | legacy-unmounted |
| export | [Quellvertrag](../../intake/edge-infra-contracts/edge-export.md) | #824 | legacy-unmounted |
| item-model3d | [Quellvertrag](../../intake/edge-infra-contracts/edge-item-model3d.md) | #825 | allowlisted-worker |
| item-thumbnail | [Quellvertrag](../../intake/edge-infra-contracts/edge-item-thumbnail.md) | #826 | allowlisted-worker |
| items | [Quellvertrag](../../intake/edge-infra-contracts/edge-items.md) | #827 | legacy-unmounted |
| look-reference-analysis | [Quellvertrag](../../intake/edge-infra-contracts/edge-look-reference-analysis.md) | #828 | allowlisted-worker |
| lorekeeper | [Quellvertrag](../../intake/edge-infra-contracts/edge-lorekeeper.md) | #829 | legacy-unmounted |
| main | [Quellvertrag](../../intake/edge-infra-contracts/edge-main.md) | #830 | dispatcher |
| marketplace | [Quellvertrag](../../intake/edge-infra-contracts/edge-marketplace.md) | #831 | legacy-unmounted |
| media | [Quellvertrag](../../intake/edge-infra-contracts/edge-media.md) | #832 | legacy-unmounted |
| npcs | [Quellvertrag](../../intake/edge-infra-contracts/edge-npcs.md) | #833 | legacy-unmounted |
| quests | [Quellvertrag](../../intake/edge-infra-contracts/edge-quests.md) | #834 | legacy-unmounted |
| rulesets | [Quellvertrag](../../intake/edge-infra-contracts/edge-rulesets.md) | #835 | legacy-unmounted |
| session-media-token | [Quellvertrag](../../intake/edge-infra-contracts/edge-session-media-token.md) | #836 | allowlisted-worker |
| session-recap | [Quellvertrag](../../intake/edge-infra-contracts/edge-session-recap.md) | #837 | allowlisted-worker |
| sessions | [Quellvertrag](../../intake/edge-infra-contracts/edge-sessions.md) | #838 | legacy-unmounted |
| spellbook | [Quellvertrag](../../intake/edge-infra-contracts/edge-spellbook.md) | #839 | legacy-unmounted |
| world | [Quellvertrag](../../intake/edge-infra-contracts/edge-world.md) | #840 | legacy-unmounted |

## 13 Infrastruktur-Bereiche

Vollständige Abhängigkeiten einschließlich dynamischer Imports, SDK-Aufrufe und gegenseitiger Adapterbeziehungen stehen in den Quellverträgen. integrationWith bezeichnet Integration über die bestehenden Ports; harte Ausführungsvorgänger stehen im Dependency-Plan.

| Bereich | Beleg | Nachfolger-Ticket | Quellabhängigkeiten |
| --- | --- | --- | --- |
| ai | [Quellvertrag](../../intake/edge-infra-contracts/infra-ai.md) | #800 | 0 RPC / 0 Tabellen / 1 Edge-Aufrufe |
| character | [Quellvertrag](../../intake/edge-infra-contracts/infra-character.md) | #801 | 0 RPC / 9 Tabellen / 2 Edge-Aufrufe |
| inventory | [Quellvertrag](../../intake/edge-infra-contracts/infra-inventory.md) | #802 | 0 RPC / 5 Tabellen / 2 Edge-Aufrufe |
| look | [Quellvertrag](../../intake/edge-infra-contracts/infra-look.md) | #803 | 0 RPC / 2 Tabellen / 1 Edge-Aufrufe |
| marketplace | [Quellvertrag](../../intake/edge-infra-contracts/infra-marketplace.md) | #804 | 1 RPC / 1 Tabellen / 0 Edge-Aufrufe |
| media | [Quellvertrag](../../intake/edge-infra-contracts/infra-media.md) | #805 | 0 RPC / 0 Tabellen / 0 Edge-Aufrufe |
| npc-creature | [Quellvertrag](../../intake/edge-infra-contracts/infra-npc-creature.md) | #806 | 5 RPC / 4 Tabellen / 0 Edge-Aufrufe |
| project | [Quellvertrag](../../intake/edge-infra-contracts/infra-project.md) | #807 | 11 RPC / 3 Tabellen / 0 Edge-Aufrufe |
| rulesets | [Quellvertrag](../../intake/edge-infra-contracts/infra-rulesets.md) | #808 | 0 RPC / 1 Tabellen / 0 Edge-Aufrufe |
| saga | [Quellvertrag](../../intake/edge-infra-contracts/infra-saga.md) | #809 | 11 RPC / 0 Tabellen / 0 Edge-Aufrufe |
| session | [Quellvertrag](../../intake/edge-infra-contracts/infra-session.md) | #810 | 12 RPC / 3 Tabellen / 2 Edge-Aufrufe |
| user-profile | [Quellvertrag](../../intake/edge-infra-contracts/infra-user-profile.md) | #811 | 0 RPC / 1 Tabellen / 0 Edge-Aufrufe |
| world | [Quellvertrag](../../intake/edge-infra-contracts/infra-world.md) | #812 | 17 RPC / 3 Tabellen / 0 Edge-Aufrufe |
