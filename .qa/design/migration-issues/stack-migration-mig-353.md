<!-- migration-contract:v2 localId=MIG-353 -->
# MIG-353: Replace Postgres RPC cluster: remaining RPCs

## Type

chore

## Intent

Die 6 RPCs dieses Bereichs über 2 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.

## Goal

Die 6 RPCs dieses Bereichs über 2 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/npc-instances/assign_npc_creature_controller/index.ts, server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts, server/src/application/npc-instances/spawn_npc_creature_instance/index.ts, server/src/application/npc-instances/update_npc_creature_instance_runtime/index.ts, server/src/application/npc-instances/remove_npc_creature_instance/index.ts, server/src/modules/npc-creature/index.ts, server/src/application/commands/assign_npc_creature_controller.ts, server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts, server/src/application/commands/spawn_npc_creature_instance.ts, server/src/application/commands/update_npc_creature_instance_runtime.ts, server/src/application/commands/remove_npc_creature_instance.ts, server/src/application/npc-instances/__tests__, server/src/application/marketplace-count/increment_marketplace_downloads/index.ts, server/src/modules/marketplace/index.ts, server/src/application/commands/increment_marketplace_downloads.ts, server/src/application/marketplace-count/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/021_npc_creature_definitions.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `src/infrastructure/marketplace/marketplace-service.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/assign_npc_creature_controller.md`, `.qa/intake/rpc-contracts/clear_npc_creature_instance_temp_controllers_for_session.md`, `.qa/intake/rpc-contracts/spawn_npc_creature_instance.md`, `.qa/intake/rpc-contracts/update_npc_creature_instance_runtime.md`, `.qa/intake/rpc-contracts/remove_npc_creature_instance.md`, `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

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
- `server/src/application/marketplace-count/increment_marketplace_downloads/index.ts`
- `server/src/modules/marketplace/index.ts`
- `server/src/application/commands/increment_marketplace_downloads.ts`
- `server/src/application/marketplace-count/__tests__`

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

- Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Alle 6 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-NPC-INSTANCES, RPC-MARKETPLACE-COUNT; kein RPC wird doppelt implementiert oder ausgelassen.
2. Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
3. Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 6 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-NPC-INSTANCES, RPC-MARKETPLACE-COUNT; kein RPC wird doppelt implementiert oder ausgelassen.
- [ ] Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- [ ] Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #877 (RPC-NPC-INSTANCES)
- Depends on #878 (RPC-MARKETPLACE-COUNT)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-353`
- Design: `.qa/design/migration-issues/stack-migration-mig-353.md`
- Status: blocked
- Reihenfolge: 30; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-030`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-353.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-blocked
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

