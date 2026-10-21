<!-- migration-contract:v2 localId=RPC-NPC-INSTANCES -->
# RPC-NPC-INSTANCES: NPC-Instanzen und Controller-Zuordnung

## Type

Task

## Intent

NPC-Instanzen und Controller-Zuordnung: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

NPC-Instanzen und Controller-Zuordnung: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #816. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/npc-creature/npc-creature-controller.persistence.ts, src/infrastructure/npc-creature/npc-creature-instance.persistence.ts, src/infrastructure/npc-creature/npc-creature-service.ts, src/infrastructure/npc-creature/npc-creature.persistence.ts, src/infrastructure/npc-creature/supabase-npc-creature.repository.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/021_npc_creature_definitions.sql, supabase/migrations/022_npc_creature_controller_assignments.sql, supabase/migrations/023_npc_creature_instances.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/assign_npc_creature_controller.md, .qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md, .qa/intake/rpc-contracts/spawn_npc_creature_instance.md, .qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md, .qa/intake/rpc-contracts/remove_npc_creature_instance.md.

### Nachher und Verhalten

NPC-Instanzen und Controller-Zuordnung: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts.

## Scope

- Quellpfade: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/commands/assign_npc_creature_controller.ts`, `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts`, `server/src/application/commands/spawn_npc_creature_instance.ts`, `server/src/application/commands/update_npc_creature_instance_runtime.ts`, `server/src/application/commands/remove_npc_creature_instance.ts`
- Quellverträge: `.qa/intake/rpc-contracts/assign_npc_creature_controller.md`, `.qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md`, `.qa/intake/rpc-contracts/spawn_npc_creature_instance.md`, `.qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md`, `.qa/intake/rpc-contracts/remove_npc_creature_instance.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance ausführt
- Dann: Instanzerzeugung/Entfernung verlangen den belegten GM-Scope und überprüfen Projekt-/Session-Zugehörigkeit.
- Quelle: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance ausführt
- Dann: Runtime-Updates sind GM-exklusiv, ersetzen das vollständige Runtime-Objekt und lassen den Snapshot unverändert; permanente oder temporäre Controller erhalten dadurch keine Schreibberechtigung.
- Quelle: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance ausführt
- Dann: Controller-Zuordnung verlangt aktives Projektmitglied; gespeicherte Definitionen müssen aktiv und full-sheet sein.
- Quelle: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance ausführt
- Dann: Session-Cleanup entfernt ausschließlich deren temporäre Controller und liefert die exakte Anzahl geänderter Instanzen.
- Quelle: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] Instanzerzeugung/Entfernung verlangen den belegten GM-Scope und überprüfen Projekt-/Session-Zugehörigkeit.
- [ ] Runtime-Updates sind GM-exklusiv, ersetzen das vollständige Runtime-Objekt und lassen den Snapshot unverändert; permanente oder temporäre Controller erhalten dadurch keine Schreibberechtigung.
- [ ] Controller-Zuordnung verlangt aktives Projektmitglied; gespeicherte Definitionen müssen aktiv und full-sheet sein.
- [ ] Session-Cleanup entfernt ausschließlich deren temporäre Controller und liefert die exakte Anzahl geänderter Instanzen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #868 (RPC-SESSION-LIFECYCLE)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-npc-instances`
- Design: `.qa/design/migration-issues/stack-migration-rpc-npc-instances.md`
- Status: blocked
- Reihenfolge: 29; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-029`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-npc-instances.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
