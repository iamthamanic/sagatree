<!-- migration-contract:v2 localId=RPC-NPC-INSTANCES -->
# RPC-NPC-INSTANCES: NPC-Instanzen und Controller-Zuordnung

## Type

feature

## Intent

NPC-Instanzen und Controller-Zuordnung: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

NPC-Instanzen und Controller-Zuordnung: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, spawn_npc_creature_instance, update_npc_creature_instance_runtime, remove_npc_creature_instance als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/npc-instances/assign_npc_creature_controller/index.ts, server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts, server/src/application/npc-instances/spawn_npc_creature_instance/index.ts, server/src/application/npc-instances/update_npc_creature_instance_runtime/index.ts, server/src/application/npc-instances/remove_npc_creature_instance/index.ts, server/src/modules/npc-creature/index.ts, server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts, server/src/application/npc-instances/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/assign_npc_creature_controller.md`, `.qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md`, `.qa/intake/rpc-contracts/spawn_npc_creature_instance.md`, `.qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md`, `.qa/intake/rpc-contracts/remove_npc_creature_instance.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #816.

## Scope

In:
- `server/src/application/npc-instances/assign_npc_creature_controller/index.ts`
- `server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts`
- `server/src/application/npc-instances/spawn_npc_creature_instance/index.ts`
- `server/src/application/npc-instances/update_npc_creature_instance_runtime/index.ts`
- `server/src/application/npc-instances/remove_npc_creature_instance/index.ts`
- `server/src/modules/npc-creature/index.ts`
- `server/src/application/commands/assign_npc_creature_controller.ts`
- `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts`
- `server/src/application/commands/spawn_npc_creature_instance.ts`
- `server/src/application/commands/update_npc_creature_instance_runtime.ts`
- `server/src/application/commands/remove_npc_creature_instance.ts`
- `server/src/application/npc-instances/__tests__`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Instanzerzeugung/Entfernung verlangen den belegten GM-Scope und überprüfen Projekt-/Session-Zugehörigkeit.
2. Runtime-Updates sind GM-exklusiv, ersetzen das vollständige Runtime-Objekt und lassen den Snapshot unverändert; permanente oder temporäre Controller erhalten dadurch keine Schreibberechtigung.
3. Controller-Zuordnung verlangt aktives Projektmitglied; gespeicherte Definitionen müssen aktiv und full-sheet sein.
4. Session-Cleanup entfernt ausschließlich deren temporäre Controller und liefert die exakte Anzahl geänderter Instanzen.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Instanzerzeugung/Entfernung verlangen den belegten GM-Scope und überprüfen Projekt-/Session-Zugehörigkeit.
- [ ] Runtime-Updates sind GM-exklusiv, ersetzen das vollständige Runtime-Objekt und lassen den Snapshot unverändert; permanente oder temporäre Controller erhalten dadurch keine Schreibberechtigung.
- [ ] Controller-Zuordnung verlangt aktives Projektmitglied; gespeicherte Definitionen müssen aktiv und full-sheet sein.
- [ ] Session-Cleanup entfernt ausschließlich deren temporäre Controller und liefert die exakte Anzahl geänderter Instanzen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/npc-instances/assign_npc_creature_controller/index.ts`, `server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts`, `server/src/application/npc-instances/spawn_npc_creature_instance/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-301..313 / MIG-311 session adapters as applicable |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #868 (RPC-SESSION-LIFECYCLE)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-npc-instances`
- Design: `.qa/design/migration-issues/stack-migration-rpc-npc-instances.md`
- Status: ready
- Reihenfolge: 29; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-029`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-npc-instances.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

