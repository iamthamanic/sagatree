<!-- migration-contract:v2 localId=RPC-ATLAS-MAPS -->
# RPC-ATLAS-MAPS: Atlas-Kartenprojektion und Revision

## Type

Task

## Intent

Atlas-Kartenprojektion und Revision: ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Atlas-Kartenprojektion und Revision: ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-atlas/ensure_world_atlas_root/index.ts, server/src/application/world-atlas/list_world_atlas_maps/index.ts, server/src/application/world-atlas/get_world_atlas_map/index.ts, server/src/application/world-atlas/upsert_world_atlas_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/ensure_world_atlas_root.ts, server/src/application/commands/list_world_atlas_maps.ts, server/src/application/commands/get_world_atlas_map.ts, server/src/application/commands/upsert_world_atlas_map.ts, server/src/application/world-atlas/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #813. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world/world-atlas-service.ts, src/lib/authenticatedUser.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/068_world_maps.sql, supabase/migrations/075_saga_permission_grants.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/092_fix_projects_rls_recursion.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/095_donalu_world_places.sql, supabase/migrations/101_world_places_select_editor_only.sql, supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql, supabase/migrations/106_atlas_get_map_overload_fix.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/ensure_world_atlas_root.md, .qa/intake/rpc-contracts/list_world_atlas_maps.md, .qa/intake/rpc-contracts/get_world_atlas_map.md, .qa/intake/rpc-contracts/upsert_world_atlas_map.md.

### Nachher und Verhalten

Atlas-Kartenprojektion und Revision: ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-atlas/ensure_world_atlas_root/index.ts, server/src/application/world-atlas/list_world_atlas_maps/index.ts, server/src/application/world-atlas/get_world_atlas_map/index.ts, server/src/application/world-atlas/upsert_world_atlas_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/ensure_world_atlas_root.ts, server/src/application/commands/list_world_atlas_maps.ts, server/src/application/commands/get_world_atlas_map.ts, server/src/application/commands/upsert_world_atlas_map.ts, server/src/application/world-atlas/__tests__.

## Scope

- Quellpfade: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`
- Änderbare Zielpfade: `server/src/application/world-atlas/ensure_world_atlas_root/index.ts`, `server/src/application/world-atlas/list_world_atlas_maps/index.ts`, `server/src/application/world-atlas/get_world_atlas_map/index.ts`, `server/src/application/world-atlas/upsert_world_atlas_map/index.ts`, `server/src/modules/world/index.ts`, `server/src/application/commands/ensure_world_atlas_root.ts`, `server/src/application/commands/list_world_atlas_maps.ts`, `server/src/application/commands/get_world_atlas_map.ts`, `server/src/application/commands/upsert_world_atlas_map.ts`, `server/src/application/world-atlas/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"}}
- {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Migration 106 wird berücksichtigt: get_world_atlas_map hat ausschließlich die dreiargumentige Signatur mit optionalem p_saga_public_id.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Player-Liste und Detail liefern nur im konkreten Saga-Kontext freigegebene kanonische Orte; GM-Daten, Parent-IDs und Azgaar-Pfade bleiben geschützt.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Root-Erzeugung ist bei Wiederholung stabil; Parent-Karte muss dieselbe Welt besitzen.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: GeoJSON-FeatureCollection, 1.500.000-Byte-Limit und Revision-Konflikt sind mit echten SQL- und Decoder-Fixtures abgenommen.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

## Acceptance

- [ ] Migration 106 wird berücksichtigt: get_world_atlas_map hat ausschließlich die dreiargumentige Signatur mit optionalem p_saga_public_id.
- [ ] Player-Liste und Detail liefern nur im konkreten Saga-Kontext freigegebene kanonische Orte; GM-Daten, Parent-IDs und Azgaar-Pfade bleiben geschützt.
- [ ] Root-Erzeugung ist bei Wiederholung stabil; Parent-Karte muss dieselbe Welt besitzen.
- [ ] GeoJSON-FeatureCollection, 1.500.000-Byte-Limit und Revision-Konflikt sind mit echten SQL- und Decoder-Fixtures abgenommen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #861 (RPC-WORLD-MAP)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-atlas-maps`
- Design: `.qa/design/migration-issues/stack-migration-rpc-atlas-maps.md`
- Status: blocked
- Reihenfolge: 37; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-037`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-atlas-maps.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
