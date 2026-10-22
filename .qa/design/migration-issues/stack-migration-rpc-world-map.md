<!-- migration-contract:v2 localId=RPC-WORLD-MAP -->
# RPC-WORLD-MAP: Legacy-Weltkarte lesen und speichern

## Type

Task

## Intent

Legacy-Weltkarte lesen und speichern: get_world_map, save_world_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Legacy-Weltkarte lesen und speichern: get_world_map, save_world_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-map/get_world_map/index.ts, server/src/application/world-map/save_world_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/get_world_map.ts, server/src/application/commands/save_world_map.ts, server/src/application/world-map/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #813. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world/world-map-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/068_world_maps.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/get_world_map.md, .qa/intake/rpc-contracts/save_world_map.md.

### Nachher und Verhalten

Legacy-Weltkarte lesen und speichern: get_world_map, save_world_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-map/get_world_map/index.ts, server/src/application/world-map/save_world_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/get_world_map.ts, server/src/application/commands/save_world_map.ts, server/src/application/world-map/__tests__.

## Scope

- Quellpfade: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/world-map/get_world_map/index.ts`, `server/src/application/world-map/save_world_map/index.ts`, `server/src/modules/world/index.ts`, `server/src/application/commands/get_world_map.ts`, `server/src/application/commands/save_world_map.ts`, `server/src/application/world-map/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/get_world_map.md`, `.qa/intake/rpc-contracts/save_world_map.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

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

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-world-map`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-map.md`
- Status: blocked
- Reihenfolge: 36; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-036`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-map.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
