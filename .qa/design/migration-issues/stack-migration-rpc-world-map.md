<!-- migration-contract:v2 localId=RPC-WORLD-MAP -->
# RPC-WORLD-MAP: Legacy-Weltkarte lesen und speichern

## Type

feature

## Intent

Legacy-Weltkarte lesen und speichern: get_world_map, save_world_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Legacy-Weltkarte lesen und speichern: get_world_map, save_world_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-map/get_world_map/index.ts, server/src/application/world-map/save_world_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/get_world_map.ts, server/src/application/commands/save_world_map.ts, server/src/application/world-map/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_world_map.md`, `.qa/intake/rpc-contracts/save_world_map.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #813.

## Scope

In:
- `server/src/application/world-map/get_world_map/index.ts`
- `server/src/application/world-map/save_world_map/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/get_world_map.ts`
- `server/src/application/commands/save_world_map.ts`
- `server/src/application/world-map/__tests__`

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

### Bekannte Legacy-Defekte / negative Regressionen

- {"id":"RPC-SEC-LEGACY-MAP-FLAG","severity":"High","status":"blocked-successor-acceptance","summary":"Nicht-Editor mit Welt-Leserecht kann undiscovered Pins mit p_player_view=false lesen.","sourceEvidence":"supabase/migrations/068_world_maps.sql: get_world_map filtert nur innerhalb IF p_player_view; current_user_can_read_world_profile erlaubt Projekt-Player.","requiredSuccessorAcceptance":"Player-Filter serverseitig anhand Editor-Recht erzwingen; true/false/NULL als Player prüfen. Unsicheren Legacy-Response nicht als Parität übernehmen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-LEGACY-MAP"}}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_world_map, save_world_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_world_map, save_world_map ausführt
- Dann: Leere Weltkarte liefert revision 0 und size 24; gespeicherte JSON-Payload und Client-Decoding sind belegt.
- Quelle: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_world_map, save_world_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_world_map, save_world_map ausführt
- Dann: Nur Welt-Editoren speichern; Größe 1–60, Bildpfad-Grenzen und JSON-Objekt-Validierung bleiben geprüft.
- Quelle: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_world_map, save_world_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_world_map, save_world_map ausführt
- Dann: Revision-Konflikt führt zu SQLSTATE 40001 ohne Teilupdate; expliziter Legacy-Bypass bei NULL/negativer Erwartungsrevision ist entschieden.
- Quelle: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_world_map, save_world_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_world_map, save_world_map ausführt
- Dann: Player-Ansicht schützt verborgene Pins serverseitig unabhängig von einem manipulierbaren p_player_view-Flag; unsichere Legacy-Parität ist gesperrt.
- Quelle: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Leere Weltkarte liefert revision 0 und size 24; gespeicherte JSON-Payload und Client-Decoding sind belegt.
2. Nur Welt-Editoren speichern; Größe 1–60, Bildpfad-Grenzen und JSON-Objekt-Validierung bleiben geprüft.
3. Revision-Konflikt führt zu SQLSTATE 40001 ohne Teilupdate; expliziter Legacy-Bypass bei NULL/negativer Erwartungsrevision ist entschieden.
4. Player-Ansicht schützt verborgene Pins serverseitig unabhängig von einem manipulierbaren p_player_view-Flag; unsichere Legacy-Parität ist gesperrt.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Leere Weltkarte liefert revision 0 und size 24; gespeicherte JSON-Payload und Client-Decoding sind belegt.
- [ ] Nur Welt-Editoren speichern; Größe 1–60, Bildpfad-Grenzen und JSON-Objekt-Validierung bleiben geprüft.
- [ ] Revision-Konflikt führt zu SQLSTATE 40001 ohne Teilupdate; expliziter Legacy-Bypass bei NULL/negativer Erwartungsrevision ist entschieden.
- [ ] Player-Ansicht schützt verborgene Pins serverseitig unabhängig von einem manipulierbaren p_player_view-Flag; unsichere Legacy-Parität ist gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-world-map`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-map.md`
- Status: blocked
- Reihenfolge: 36; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-036`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-map.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

