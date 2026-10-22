<!-- migration-contract:v2 localId=RPC-SESSION-RUNTIME -->
# RPC-SESSION-RUNTIME: Session-Runtime, Snapshot und Presence

## Type

Task

## Intent

Session-Runtime, Snapshot und Presence: apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Session-Runtime, Snapshot und Presence: apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-runtime/apply_session_runtime_command/index.ts, server/src/application/session-runtime/get_session_runtime_snapshot/index.ts, server/src/application/session-runtime/set_session_player_presence/index.ts, server/src/modules/session/index.ts, server/src/application/commands/apply_session_runtime_command.ts, server/src/application/commands/get_session_runtime_snapshot.ts, server/src/application/commands/set_session_player_presence.ts, server/src/application/session-runtime/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #814. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/session/contracts/session-lifecycle.ts, src/domains/session/contracts/session-runtime.ts, src/infrastructure/session/session-runtime-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/002_character_trait_arrays.sql, supabase/migrations/005_character_ruleset_metadata.sql, supabase/migrations/007_sagadrive_character_profile.sql, supabase/migrations/010_characters_v3_columns.sql, supabase/migrations/014_character_abilities_emotion_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/016_character_inventory_v2.sql, supabase/migrations/023_npc_creature_instances.sql, supabase/migrations/029_character_sheet_status.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/042_session_shared_rolls.sql, supabase/migrations/043_session_shared_scene_presentation.sql, supabase/migrations/044_session_combat_encounter.sql, supabase/migrations/047_session_program_presentation.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/049_session_death_lifecycle.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/051_session_director_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/065_saga_simulation_ops.sql, supabase/migrations/066_saga_between_sessions_bote.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/079_drop_sagadrive_aliases.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql, supabase/migrations/089_gm_presence_character_type.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/apply_session_runtime_command.md, .qa/intake/rpc-contracts/get_session_runtime_snapshot.md, .qa/intake/rpc-contracts/set_session_player_presence.md.

### Nachher und Verhalten

Session-Runtime, Snapshot und Presence: apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-runtime/apply_session_runtime_command/index.ts, server/src/application/session-runtime/get_session_runtime_snapshot/index.ts, server/src/application/session-runtime/set_session_player_presence/index.ts, server/src/modules/session/index.ts, server/src/application/commands/apply_session_runtime_command.ts, server/src/application/commands/get_session_runtime_snapshot.ts, server/src/application/commands/set_session_player_presence.ts, server/src/application/session-runtime/__tests__.

## Scope

- Quellpfade: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/session-runtime/apply_session_runtime_command/index.ts`, `server/src/application/session-runtime/get_session_runtime_snapshot/index.ts`, `server/src/application/session-runtime/set_session_player_presence/index.ts`, `server/src/modules/session/index.ts`, `server/src/application/commands/apply_session_runtime_command.ts`, `server/src/application/commands/get_session_runtime_snapshot.ts`, `server/src/application/commands/set_session_player_presence.ts`, `server/src/application/session-runtime/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/apply_session_runtime_command.md`, `.qa/intake/rpc-contracts/get_session_runtime_snapshot.md`, `.qa/intake/rpc-contracts/set_session_player_presence.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-RUNTIME-ROLL-OWNER-COLUMN","severity":"High","status":"blocked-successor-acceptance","summary":"Nicht-GM-Roll-Aufruf greift auf v_character.user_id zu, obwohl characters.owner_user_id die wirksame Spalte ist; Baseline scheitert statt zu würfeln.","sourceEvidence":"supabase/migrations/042_session_shared_rolls.sql:212; spätere073/079/085 benennen den Helper um, korrigieren aber nicht den Feldzugriff. Isolierter PostgreSQL15-Player-Roll reproduziert record has no field user_id.","requiredSuccessorAcceptance":"Owner-Prüfung gegen owner_user_id; positiver eigenerPlayer-Roll und negativerFremdcharakter-Roll müssen vor Runtime-Abnahme bestehen. Fehler darf keine Revision/Event erzeugen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"PAR-08"}}
- {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
- {"id":"RPC-SEC-ANON-ADVENTURE-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann im öffentlichen Adventure-Helper p_is_gm=true behaupten und fremde Projekt-Adventure-Daten schreiben.","sourceEvidence":"supabase/migrations/065_saga_simulation_ops.sql plus 073/079/085-Transformationen; Helper vertraut übergebenem GM-Boolean bei erhaltenen anon-Defaultprivilegien.","requiredSuccessorAcceptance":"Helper nicht öffentlich exponieren oder Actor/Projekt-GM selbst prüfen; frei gelieferte Booleans dürfen kein Recht verleihen. Anon/Fremdnutzer-Flags müssen unverändert bleiben.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-ADVENTURE-HELPER-ANON"},"deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
- [ ] Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
- [ ] Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
- [ ] GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-session-runtime`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-runtime.md`
- Status: blocked
- Reihenfolge: 27; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-027`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-runtime.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
