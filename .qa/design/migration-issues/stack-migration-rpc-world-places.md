<!-- migration-contract:v2 localId=RPC-WORLD-PLACES -->
# RPC-WORLD-PLACES: Orte und Kartenverknüpfungen

## Type

Task

## Intent

Orte und Kartenverknüpfungen: list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Orte und Kartenverknüpfungen: list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/list_world_places.ts, server/src/application/commands/list_world_place_map_links.ts, server/src/application/commands/upsert_world_place.ts, server/src/application/commands/upsert_world_place_map_link.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #813. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world/world-place-service.ts, src/lib/authenticatedUser.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/075_saga_permission_grants.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/092_fix_projects_rls_recursion.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/095_donalu_world_places.sql, supabase/migrations/096_donalu_place_map_link_rpc.sql, supabase/migrations/097_donalu_player_place_projection.sql, supabase/migrations/101_world_places_select_editor_only.sql, supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/list_world_places.md, .qa/intake/rpc-contracts/list_world_place_map_links.md, .qa/intake/rpc-contracts/upsert_world_place.md, .qa/intake/rpc-contracts/upsert_world_place_map_link.md.

### Nachher und Verhalten

Orte und Kartenverknüpfungen: list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/list_world_places.ts, server/src/application/commands/list_world_place_map_links.ts, server/src/application/commands/upsert_world_place.ts, server/src/application/commands/upsert_world_place_map_link.ts.

## Scope

- Quellpfade: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`
- Änderbare Zielpfade: `server/src/application/commands/list_world_places.ts`, `server/src/application/commands/list_world_place_map_links.ts`, `server/src/application/commands/upsert_world_place.ts`, `server/src/application/commands/upsert_world_place_map_link.ts`
- Quellverträge: `.qa/intake/rpc-contracts/list_world_places.md`, `.qa/intake/rpc-contracts/list_world_place_map_links.md`, `.qa/intake/rpc-contracts/upsert_world_place.md`, `.qa/intake/rpc-contracts/upsert_world_place_map_link.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Editor- und Party-Projektionen werden getrennt durch vorhandene Rechte erzwungen; fehlender Saga-Kontext liefert leere Party-Listen.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert die belegten JSON-Felder.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Trigger für kanonische Hierarchie, Primary-Link und Kartenabgleich sind Teil der Transaktion und der Nachfolger-Tests.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

## Acceptance

- [ ] Editor- und Party-Projektionen werden getrennt durch vorhandene Rechte erzwungen; fehlender Saga-Kontext liefert leere Party-Listen.
- [ ] Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
- [ ] UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert die belegten JSON-Felder.
- [ ] Trigger für kanonische Hierarchie, Primary-Link und Kartenabgleich sind Teil der Transaktion und der Nachfolger-Tests.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #862 (RPC-ATLAS-MAPS)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-world-places`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-places.md`
- Status: blocked
- Reihenfolge: 38; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-038`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-places.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
