# RPC split tickets (PREP-04 #777)

Each row is a **PR-sized** implementation issue to create/replace the old MIG-350..353 clusters after GATE-01/04.

| Ticket id (local) | RPCs | Depends |
| --- | --- | --- |
| RPC-SESSION-RUNTIME | `apply_session_runtime_command`, `get_session_runtime_snapshot` | GATE-04, MIG-022 |
| RPC-SESSION-JOIN | `join_session_by_code`, `leave_play_session`, `create_session_invite`, `create_play_session` | GATE-02 |
| RPC-WORLD-ATLAS-READ | `ensure_world_atlas_root`, `list_world_atlas_maps` (if present), `get_world_atlas_map`, `get_world_map` | GATE-01 |
| RPC-WORLD-NODE-WRITE | `create_world_node_with_maps`, `delete_world_node`, `duplicate_world_node`, `rename_world_node`, `reparent_world_node`, `archive_world_node_subtree` | GATE-01 |
| RPC-PLACE-LINKS | place/map link RPCs from inventory | GATE-01 |
| RPC-SAGA-PROJECT | saga/project create/copy/join RPCs | GATE-01 |
| RPC-MARKETPLACE | `increment_marketplace_downloads` (**SQL def missing — BLOCKED**) + related | needs SQL locate |
| RPC-REMAINING | all other names in `inventory.json` not listed above | GATE-01 |

Rule: one PR lands one ticket id unless a pair is inseparable transactionally.
