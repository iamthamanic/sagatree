<!-- migration-contract:v2 localId=MIG-353 -->
# MIG-353: Replace Postgres RPC cluster: remaining RPCs

## Type

Coordination

## Intent

Die 6 RPCs dieses Bereichs über 2 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.

## Goal

Die 6 RPCs dieses Bereichs über 2 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts, server/src/application/commands/increment_marketplace_downloads.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/npc-creature/npc-creature-controller.persistence.ts, src/infrastructure/npc-creature/npc-creature-instance.persistence.ts, src/infrastructure/npc-creature/npc-creature-service.ts, src/infrastructure/npc-creature/npc-creature.persistence.ts, src/infrastructure/npc-creature/supabase-npc-creature.repository.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/021_npc_creature_definitions.sql, supabase/migrations/022_npc_creature_controller_assignments.sql, supabase/migrations/023_npc_creature_instances.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/092_fix_projects_rls_recursion.sql, src/infrastructure/marketplace/marketplace-service.ts, src/supabase/add_marketplace_rpc.sql, src/supabase/deploy_marketplace.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/assign_npc_creature_controller.md, .qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md, .qa/intake/rpc-contracts/spawn_npc_creature_instance.md, .qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md, .qa/intake/rpc-contracts/remove_npc_creature_instance.md, .qa/intake/rpc-contracts/increment_marketplace_downloads.md.

### Nachher und Verhalten

Die 6 RPCs dieses Bereichs über 2 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts, server/src/application/commands/increment_marketplace_downloads.ts.

## Scope

- Quellpfade: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `src/infrastructure/marketplace/marketplace-service.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`
- Änderbare Zielpfade: `server/src/application/commands/assign_npc_creature_controller.ts`, `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts`, `server/src/application/commands/spawn_npc_creature_instance.ts`, `server/src/application/commands/update_npc_creature_instance_runtime.ts`, `server/src/application/commands/remove_npc_creature_instance.ts`, `server/src/application/commands/increment_marketplace_downloads.ts`
- Quellverträge: `.qa/intake/rpc-contracts/assign_npc_creature_controller.md`, `.qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md`, `.qa/intake/rpc-contracts/spawn_npc_creature_instance.md`, `.qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md`, `.qa/intake/rpc-contracts/remove_npc_creature_instance.md`, `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`

## Security & Data

Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.

## Edge Cases

### Fall 1

- Gegeben: Die RPC-Liste assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance, increment_marketplace_downloads
- Wenn: Die implementierten Untertickets werden gegen das AST-Inventar abgeglichen
- Dann: Alle 6 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-NPC-INSTANCES, RPC-MARKETPLACE-COUNT; kein RPC wird doppelt implementiert oder ausgelassen.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

### Fall 2

- Gegeben: Abgeschlossene einzelne RPC-Ports
- Wenn: Die bereichsübergreifende Alt/Neu-Suite mit echter Persistenz läuft
- Dann: Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- Quelle: `.qa/intake/rpc-contracts/assign_npc_creature_controller.md`, `.qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md`, `.qa/intake/rpc-contracts/spawn_npc_creature_instance.md`, `.qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md`, `.qa/intake/rpc-contracts/remove_npc_creature_instance.md`, `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`

### Fall 3

- Gegeben: Ein offenes Unterticket oder fehlender DB-/Transportnachweis
- Wenn: Der Koordinator geschlossen werden soll
- Dann: Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

## Acceptance

- [ ] Alle 6 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-NPC-INSTANCES, RPC-MARKETPLACE-COUNT; kein RPC wird doppelt implementiert oder ausgelassen.
- [ ] Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- [ ] Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #877 (RPC-NPC-INSTANCES)
- Depends on #878 (RPC-MARKETPLACE-COUNT)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-353`
- Design: `.qa/design/migration-issues/stack-migration-mig-353.md`
- Status: blocked
- Reihenfolge: 30; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-030`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-353.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-blocked
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
