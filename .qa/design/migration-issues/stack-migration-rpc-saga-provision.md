<!-- migration-contract:v2 localId=RPC-SAGA-PROVISION -->
# RPC-SAGA-PROVISION: Spielgruppe aus Version und Starter-Provisionierung

## Type

feature

## Intent

Spielgruppe aus Version und Starter-Provisionierung: create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Spielgruppe aus Version und Starter-Provisionierung: create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-provision/create_project_from_saga_version/index.ts, server/src/application/saga-provision/duplicate_saga_playthrough/index.ts, server/src/application/saga-provision/ensure_native_starter_project/index.ts, server/src/modules/project/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/create_project_from_saga_version.ts, server/src/application/commands/duplicate_saga_playthrough.ts, server/src/application/commands/ensure_native_starter_project.ts, server/src/application/saga-provision/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/project/project-service.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/create_project_from_saga_version.md`, `.qa/intake/rpc-contracts/duplicate_saga_playthrough.md`, `.qa/intake/rpc-contracts/ensure_native_starter_project.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #815.

## Scope

In:
- `server/src/application/saga-provision/create_project_from_saga_version/index.ts`
- `server/src/application/saga-provision/duplicate_saga_playthrough/index.ts`
- `server/src/application/saga-provision/ensure_native_starter_project/index.ts`
- `server/src/modules/project/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/create_project_from_saga_version.ts`
- `server/src/application/commands/duplicate_saga_playthrough.ts`
- `server/src/application/commands/ensure_native_starter_project.ts`
- `server/src/application/saga-provision/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-POLICY-USER-PUBLISHED","severity":"Medium","status":"blocked-successor-acceptance","summary":"Veröffentlichte User-Sagas können von anderen authentifizierten Nutzern als eigene GM-Spielgruppe instanziert werden.","sourceEvidence":"supabase/migrations/063_saga_definitions.sql: create_project_from_saga_version erlaubt origin IN (native,user), während get_saga_definition_version einen anderen Lesescope hat.","requiredSuccessorAcceptance":"Öffentlichkeits-/Lizenzregel für user-Veröffentlichungen explizit festlegen; die durch neue GM-Mitgliedschaft erweiterte Payload-Lesbarkeit im Negativ-/Positivtest abnehmen.","deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project ausführt
- Dann: Neue Spielgruppe bindet passende veröffentlichte Saga-Version und Actor-GM-Mitgliedschaft in derselben Transaktion.
- Quelle: `src/infrastructure/project/project-service.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project ausführt
- Dann: fresh und with_progress erzeugen neue Projekte; nur with_progress übernimmt laufenden Fortschritt, keine Session-Identitäten werden wiederverwendet.
- Quelle: `src/infrastructure/project/project-service.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project ausführt
- Dann: Dornhain-Starter-Aufrufe liefern dieselbe vorhandene Spielgruppe und reparieren definierte Seed-/Binding-/Charakterdaten idempotent.
- Quelle: `src/infrastructure/project/project-service.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project ausführt
- Dann: Fremde private_backfill-Versionen, unpassende Saga/Version und unzulässige Duplizierung werden abgewiesen; Zugriffsregel für user-Veröffentlichungen ist ausdrücklich entschieden.
- Quelle: `src/infrastructure/project/project-service.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-POLICY-USER-PUBLISHED","severity":"Medium","status":"blocked-successor-acceptance","summary":"Veröffentlichte User-Sagas können von anderen authentifizierten Nutzern als eigene GM-Spielgruppe instanziert werden.","sourceEvidence":"supabase/migrations/063_saga_definitions.sql: create_project_from_saga_version erlaubt origin IN (native,user), während get_saga_definition_version einen anderen Lesescope hat.","requiredSuccessorAcceptance":"Öffentlichkeits-/Lizenzregel für user-Veröffentlichungen explizit festlegen; die durch neue GM-Mitgliedschaft erweiterte Payload-Lesbarkeit im Negativ-/Positivtest abnehmen.","deployedExploitVerified":false}
- Quelle: `.qa/intake/rpc-contracts/create_project_from_saga_version.md`, `.qa/intake/rpc-contracts/duplicate_saga_playthrough.md`, `.qa/intake/rpc-contracts/ensure_native_starter_project.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Neue Spielgruppe bindet passende veröffentlichte Saga-Version und Actor-GM-Mitgliedschaft in derselben Transaktion.
2. fresh und with_progress erzeugen neue Projekte; nur with_progress übernimmt laufenden Fortschritt, keine Session-Identitäten werden wiederverwendet.
3. Dornhain-Starter-Aufrufe liefern dieselbe vorhandene Spielgruppe und reparieren definierte Seed-/Binding-/Charakterdaten idempotent.
4. Fremde private_backfill-Versionen, unpassende Saga/Version und unzulässige Duplizierung werden abgewiesen; Zugriffsregel für user-Veröffentlichungen ist ausdrücklich entschieden.
5. Verpflichtende Legacy-Regression: {"id":"RPC-POLICY-USER-PUBLISHED","severity":"Medium","status":"blocked-successor-acceptance","summary":"Veröffentlichte User-Sagas können von anderen authentifizierten Nutzern als eigene GM-Spielgruppe instanziert werden.","sourceEvidence":"supabase/migrations/063_saga_definitions.sql: create_project_from_saga_version erlaubt origin IN (native,user), während get_saga_definition_version einen anderen Lesescope hat.","requiredSuccessorAcceptance":"Öffentlichkeits-/Lizenzregel für user-Veröffentlichungen explizit festlegen; die durch neue GM-Mitgliedschaft erweiterte Payload-Lesbarkeit im Negativ-/Positivtest abnehmen.","deployedExploitVerified":false}
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/saga-provision/create_project_from_saga_version/index.ts`, `server/src/application/saga-provision/duplicate_saga_playthrough/index.ts`, `server/src/application/saga-provision/ensure_native_starter_project/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #872 (RPC-SAGA-VERSION-READ)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-saga-provision`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-provision.md`
- Status: ready
- Reihenfolge: 24; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-024`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-provision.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

