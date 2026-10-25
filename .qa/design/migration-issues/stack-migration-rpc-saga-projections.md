<!-- migration-contract:v2 localId=RPC-SAGA-PROJECTIONS -->
# RPC-SAGA-PROJECTIONS: Saga-Übersicht, Lore und Outcome-Übernahme

## Type

feature

## Intent

Saga-Übersicht, Lore und Outcome-Übernahme: get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Übersicht, Lore und Outcome-Übernahme: get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-projections/get_saga_overview/index.ts, server/src/application/saga-projections/get_saga_lore_timeline/index.ts, server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts, server/src/application/saga-projections/promote_session_outcome_to_world/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/get_saga_overview.ts, server/src/application/commands/get_saga_lore_timeline.ts, server/src/application/commands/promote_session_outcome_to_saga.ts, server/src/application/commands/promote_session_outcome_to_world.ts, server/src/application/saga-projections/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`, `supabase/migrations/095_donalu_world_places.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_saga_overview.md`, `.qa/intake/rpc-contracts/get_saga_lore_timeline.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_saga.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_world.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #815.

## Scope

In:
- `server/src/application/saga-projections/get_saga_overview/index.ts`
- `server/src/application/saga-projections/get_saga_lore_timeline/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_world/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/get_saga_overview.ts`
- `server/src/application/commands/get_saga_lore_timeline.ts`
- `server/src/application/commands/promote_session_outcome_to_saga.ts`
- `server/src/application/commands/promote_session_outcome_to_world.ts`
- `server/src/application/saga-projections/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world ausführt
- Dann: Übersicht und Lore berücksichtigen aktive Mitgliedschaft, geheimen Inhalt und freigegebenen Session-/Adventure-Fortschritt.
- Quelle: `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`, `supabase/migrations/095_donalu_world_places.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world ausführt
- Dann: Beide Promotion-Namen werden über die TypeScript-Literal-Union vollständig erfasst; Request p_session_id/p_consequence_id und Decoder bleiben belegt.
- Quelle: `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`, `supabase/migrations/095_donalu_world_places.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world ausführt
- Dann: Outcome-Übernahme ergänzt genau die gewählte Konsequenz im Saga-Draft bzw. Weltmodul; nur ein neuer Saga-Fact erhöht draft_revision, die Session-Revision bleibt unverändert.
- Quelle: `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`, `supabase/migrations/095_donalu_world_places.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world ausführt
- Dann: Nicht-GM, fehlende Konsequenz und Wiederholung haben explizite Fixtures ohne fremde Zustandsänderung.
- Quelle: `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`, `supabase/migrations/095_donalu_world_places.sql`

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
- Quelle: `.qa/intake/rpc-contracts/get_saga_overview.md`, `.qa/intake/rpc-contracts/get_saga_lore_timeline.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_saga.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_world.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Übersicht und Lore berücksichtigen aktive Mitgliedschaft, geheimen Inhalt und freigegebenen Session-/Adventure-Fortschritt.
2. Beide Promotion-Namen werden über die TypeScript-Literal-Union vollständig erfasst; Request p_session_id/p_consequence_id und Decoder bleiben belegt.
3. Outcome-Übernahme ergänzt genau die gewählte Konsequenz im Saga-Draft bzw. Weltmodul; nur ein neuer Saga-Fact erhöht draft_revision, die Session-Revision bleibt unverändert.
4. Nicht-GM, fehlende Konsequenz und Wiederholung haben explizite Fixtures ohne fremde Zustandsänderung.
5. Verpflichtende Legacy-Regression: {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/saga-projections/get_saga_overview/index.ts`, `server/src/application/saga-projections/get_saga_lore_timeline/index.ts`, `server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #875 (RPC-SAGA-GOVERNANCE)
- Depends on #870 (RPC-SESSION-RECAP)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-saga-projections`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-projections.md`
- Status: waiting
- Reihenfolge: 34; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-034`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-projections.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

