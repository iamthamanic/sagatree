<!-- migration-contract:v2 localId=MIG-351 -->
# MIG-351: Replace Postgres RPC cluster: session/runtime RPCs

## Type

Coordination

## Intent

Die 13 RPCs dieses Bereichs über 4 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.

## Goal

Die 13 RPCs dieses Bereichs über 4 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/session-runtime/apply_session_runtime_command/index.ts, server/src/application/session-runtime/get_session_runtime_snapshot/index.ts, server/src/application/session-runtime/set_session_player_presence/index.ts, server/src/modules/session/index.ts, server/src/application/commands/apply_session_runtime_command.ts, server/src/application/commands/get_session_runtime_snapshot.ts, server/src/application/commands/set_session_player_presence.ts, server/src/application/session-runtime/__tests__, server/src/application/session-lifecycle/create_play_session/index.ts, server/src/application/session-lifecycle/create_project_session/index.ts, server/src/application/session-lifecycle/set_session_status/index.ts, server/src/application/commands/create_play_session.ts, server/src/application/commands/create_project_session.ts, server/src/application/commands/set_session_status.ts, server/src/application/session-lifecycle/__tests__, server/src/application/session-access/join_session_by_code/index.ts, server/src/application/session-access/leave_play_session/index.ts, server/src/application/session-access/create_session_invite/index.ts, server/src/application/session-access/resolve_session_invite/index.ts, server/src/application/session-access/revoke_session_invite/index.ts, server/src/application/commands/join_session_by_code.ts, server/src/application/commands/leave_play_session.ts, server/src/application/commands/create_session_invite.ts, server/src/application/commands/resolve_session_invite.ts, server/src/application/commands/revoke_session_invite.ts, server/src/application/session-access/__tests__, server/src/application/session-recap/get_session_recap/index.ts, server/src/application/session-recap/save_session_recap_summary/index.ts, server/src/application/commands/get_session_recap.ts, server/src/application/commands/save_session_recap_summary.ts, server/src/application/session-recap/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/session/contracts/session-lifecycle.ts, src/domains/session/contracts/session-runtime.ts, src/infrastructure/session/session-runtime-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/002_character_trait_arrays.sql, supabase/migrations/005_character_ruleset_metadata.sql, supabase/migrations/007_sagadrive_character_profile.sql, supabase/migrations/010_characters_v3_columns.sql, supabase/migrations/014_character_abilities_emotion_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/016_character_inventory_v2.sql, supabase/migrations/023_npc_creature_instances.sql, supabase/migrations/029_character_sheet_status.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/042_session_shared_rolls.sql, supabase/migrations/043_session_shared_scene_presentation.sql, supabase/migrations/044_session_combat_encounter.sql, supabase/migrations/047_session_program_presentation.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/049_session_death_lifecycle.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/051_session_director_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/065_saga_simulation_ops.sql, supabase/migrations/066_saga_between_sessions_bote.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/079_drop_sagadrive_aliases.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql, supabase/migrations/089_gm_presence_character_type.sql, supabase/migrations/092_fix_projects_rls_recursion.sql, src/domains/project/contracts/project.types.ts, src/domains/session/contracts/session.types.ts, src/infrastructure/project/project-service.ts, src/infrastructure/session/session-service.ts, supabase/migrations/046_look_profiles.sql, supabase/migrations/062_session_recap_ai_summary.sql, supabase/migrations/084_look_profiles_public_id.sql, src/domains/session/contracts/session-invite.ts, supabase/migrations/022_npc_creature_controller_assignments.sql, supabase/migrations/055_session_invites.sql, src/domains/session/contracts/session-prepare-recap.ts, src/infrastructure/session/session-recap-ai-service.ts, src/infrastructure/session/session-recap-service.ts, src/lib/networkTimeout.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/apply_session_runtime_command.md, .qa/intake/rpc-contracts/get_session_runtime_snapshot.md, .qa/intake/rpc-contracts/set_session_player_presence.md, .qa/intake/rpc-contracts/create_play_session.md, .qa/intake/rpc-contracts/create_project_session.md, .qa/intake/rpc-contracts/set_session_status.md, .qa/intake/rpc-contracts/join_session_by_code.md, .qa/intake/rpc-contracts/leave_play_session.md, .qa/intake/rpc-contracts/create_session_invite.md, .qa/intake/rpc-contracts/resolve_session_invite.md, .qa/intake/rpc-contracts/revoke_session_invite.md, .qa/intake/rpc-contracts/get_session_recap.md, .qa/intake/rpc-contracts/save_session_recap_summary.md.

### Nachher und Verhalten

Die 13 RPCs dieses Bereichs über 4 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/session-runtime/apply_session_runtime_command/index.ts, server/src/application/session-runtime/get_session_runtime_snapshot/index.ts, server/src/application/session-runtime/set_session_player_presence/index.ts, server/src/modules/session/index.ts, server/src/application/commands/apply_session_runtime_command.ts, server/src/application/commands/get_session_runtime_snapshot.ts, server/src/application/commands/set_session_player_presence.ts, server/src/application/session-runtime/__tests__, server/src/application/session-lifecycle/create_play_session/index.ts, server/src/application/session-lifecycle/create_project_session/index.ts, server/src/application/session-lifecycle/set_session_status/index.ts, server/src/application/commands/create_play_session.ts, server/src/application/commands/create_project_session.ts, server/src/application/commands/set_session_status.ts, server/src/application/session-lifecycle/__tests__, server/src/application/session-access/join_session_by_code/index.ts, server/src/application/session-access/leave_play_session/index.ts, server/src/application/session-access/create_session_invite/index.ts, server/src/application/session-access/resolve_session_invite/index.ts, server/src/application/session-access/revoke_session_invite/index.ts, server/src/application/commands/join_session_by_code.ts, server/src/application/commands/leave_play_session.ts, server/src/application/commands/create_session_invite.ts, server/src/application/commands/resolve_session_invite.ts, server/src/application/commands/revoke_session_invite.ts, server/src/application/session-access/__tests__, server/src/application/session-recap/get_session_recap/index.ts, server/src/application/session-recap/save_session_recap_summary/index.ts, server/src/application/commands/get_session_recap.ts, server/src/application/commands/save_session_recap_summary.ts, server/src/application/session-recap/__tests__.

## Scope

- Quellpfade: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `src/domains/session/contracts/session-invite.ts`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/055_session_invites.sql`, `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`
- Änderbare Zielpfade: `server/src/application/session-runtime/apply_session_runtime_command/index.ts`, `server/src/application/session-runtime/get_session_runtime_snapshot/index.ts`, `server/src/application/session-runtime/set_session_player_presence/index.ts`, `server/src/modules/session/index.ts`, `server/src/application/commands/apply_session_runtime_command.ts`, `server/src/application/commands/get_session_runtime_snapshot.ts`, `server/src/application/commands/set_session_player_presence.ts`, `server/src/application/session-runtime/__tests__`, `server/src/application/session-lifecycle/create_play_session/index.ts`, `server/src/application/session-lifecycle/create_project_session/index.ts`, `server/src/application/session-lifecycle/set_session_status/index.ts`, `server/src/application/commands/create_play_session.ts`, `server/src/application/commands/create_project_session.ts`, `server/src/application/commands/set_session_status.ts`, `server/src/application/session-lifecycle/__tests__`, `server/src/application/session-access/join_session_by_code/index.ts`, `server/src/application/session-access/leave_play_session/index.ts`, `server/src/application/session-access/create_session_invite/index.ts`, `server/src/application/session-access/resolve_session_invite/index.ts`, `server/src/application/session-access/revoke_session_invite/index.ts`, `server/src/application/commands/join_session_by_code.ts`, `server/src/application/commands/leave_play_session.ts`, `server/src/application/commands/create_session_invite.ts`, `server/src/application/commands/resolve_session_invite.ts`, `server/src/application/commands/revoke_session_invite.ts`, `server/src/application/session-access/__tests__`, `server/src/application/session-recap/get_session_recap/index.ts`, `server/src/application/session-recap/save_session_recap_summary/index.ts`, `server/src/application/commands/get_session_recap.ts`, `server/src/application/commands/save_session_recap_summary.ts`, `server/src/application/session-recap/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/apply_session_runtime_command.md`, `.qa/intake/rpc-contracts/get_session_runtime_snapshot.md`, `.qa/intake/rpc-contracts/set_session_player_presence.md`, `.qa/intake/rpc-contracts/create_play_session.md`, `.qa/intake/rpc-contracts/create_project_session.md`, `.qa/intake/rpc-contracts/set_session_status.md`, `.qa/intake/rpc-contracts/join_session_by_code.md`, `.qa/intake/rpc-contracts/leave_play_session.md`, `.qa/intake/rpc-contracts/create_session_invite.md`, `.qa/intake/rpc-contracts/resolve_session_invite.md`, `.qa/intake/rpc-contracts/revoke_session_invite.md`, `.qa/intake/rpc-contracts/get_session_recap.md`, `.qa/intake/rpc-contracts/save_session_recap_summary.md`

## Security & Data

Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.

## Edge Cases

### Fall 1

- Gegeben: Die RPC-Liste apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence, create_play_session, create_project_session, set_session_status, join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite, get_session_recap, save_session_recap_summary
- Wenn: Die implementierten Untertickets werden gegen das AST-Inventar abgeglichen
- Dann: Alle 13 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-SESSION-RUNTIME, RPC-SESSION-LIFECYCLE, RPC-SESSION-ACCESS, RPC-SESSION-RECAP; kein RPC wird doppelt implementiert oder ausgelassen.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

### Fall 2

- Gegeben: Abgeschlossene einzelne RPC-Ports
- Wenn: Die bereichsübergreifende Alt/Neu-Suite mit echter Persistenz läuft
- Dann: Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- Quelle: `.qa/intake/rpc-contracts/apply_session_runtime_command.md`, `.qa/intake/rpc-contracts/get_session_runtime_snapshot.md`, `.qa/intake/rpc-contracts/set_session_player_presence.md`, `.qa/intake/rpc-contracts/create_play_session.md`, `.qa/intake/rpc-contracts/create_project_session.md`, `.qa/intake/rpc-contracts/set_session_status.md`, `.qa/intake/rpc-contracts/join_session_by_code.md`, `.qa/intake/rpc-contracts/leave_play_session.md`, `.qa/intake/rpc-contracts/create_session_invite.md`, `.qa/intake/rpc-contracts/resolve_session_invite.md`, `.qa/intake/rpc-contracts/revoke_session_invite.md`, `.qa/intake/rpc-contracts/get_session_recap.md`, `.qa/intake/rpc-contracts/save_session_recap_summary.md`

### Fall 3

- Gegeben: Ein offenes Unterticket oder fehlender DB-/Transportnachweis
- Wenn: Der Koordinator geschlossen werden soll
- Dann: Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

## Acceptance

- [ ] Alle 13 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-SESSION-RUNTIME, RPC-SESSION-LIFECYCLE, RPC-SESSION-ACCESS, RPC-SESSION-RECAP; kein RPC wird doppelt implementiert oder ausgelassen.
- [ ] Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- [ ] Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #867 (RPC-SESSION-RUNTIME)
- Depends on #868 (RPC-SESSION-LIFECYCLE)
- Depends on #869 (RPC-SESSION-ACCESS)
- Depends on #870 (RPC-SESSION-RECAP)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-351`
- Design: `.qa/design/migration-issues/stack-migration-mig-351.md`
- Status: blocked
- Reihenfolge: 33; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-033`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-351.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
