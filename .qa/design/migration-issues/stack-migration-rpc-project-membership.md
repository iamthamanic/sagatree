<!-- migration-contract:v2 localId=RPC-PROJECT-MEMBERSHIP -->
# RPC-PROJECT-MEMBERSHIP: Projektbeitritt und eigener Charakter

## Type

Task

## Intent

Projektbeitritt und eigener Charakter: join_project_by_code, set_my_project_character als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Projektbeitritt und eigener Charakter: join_project_by_code, set_my_project_character als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/project-membership/join_project_by_code/index.ts, server/src/application/project-membership/set_my_project_character/index.ts, server/src/modules/project/index.ts, server/src/application/commands/join_project_by_code.ts, server/src/application/commands/set_my_project_character.ts, server/src/application/project-membership/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #815. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/project/contracts/project.types.ts, src/infrastructure/project/project-member-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/002_character_trait_arrays.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/005_character_ruleset_metadata.sql, supabase/migrations/007_sagadrive_character_profile.sql, supabase/migrations/010_characters_v3_columns.sql, supabase/migrations/014_character_abilities_emotion_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/016_character_inventory_v2.sql, supabase/migrations/029_character_sheet_status.sql, supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/079_drop_sagadrive_aliases.sql, supabase/migrations/089_gm_presence_character_type.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/join_project_by_code.md, .qa/intake/rpc-contracts/set_my_project_character.md.

### Nachher und Verhalten

Projektbeitritt und eigener Charakter: join_project_by_code, set_my_project_character als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/project-membership/join_project_by_code/index.ts, server/src/application/project-membership/set_my_project_character/index.ts, server/src/modules/project/index.ts, server/src/application/commands/join_project_by_code.ts, server/src/application/commands/set_my_project_character.ts, server/src/application/project-membership/__tests__.

## Scope

- Quellpfade: `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/project-membership/join_project_by_code/index.ts`, `server/src/application/project-membership/set_my_project_character/index.ts`, `server/src/modules/project/index.ts`, `server/src/application/commands/join_project_by_code.ts`, `server/src/application/commands/set_my_project_character.ts`, `server/src/application/project-membership/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/join_project_by_code.md`, `.qa/intake/rpc-contracts/set_my_project_character.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für join_project_by_code, set_my_project_character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_project_by_code, set_my_project_character ausführt
- Dann: Projektbeitritt normalisiert Join-Code und erzeugt genau eine aktive Player-Mitgliedschaft.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für join_project_by_code, set_my_project_character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_project_by_code, set_my_project_character ausführt
- Dann: Vorhandene Mitgliedschaft und unbekannter Code folgen den belegten Fehlerfällen ohne doppelte Zeile.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für join_project_by_code, set_my_project_character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_project_by_code, set_my_project_character ausführt
- Dann: Nur vollständiger eigener Charakter darf zugeordnet werden; NULL entfernt die Zuordnung.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für join_project_by_code, set_my_project_character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_project_by_code, set_my_project_character ausführt
- Dann: Änderung der Figur erfordert die eigene aktive Projektmitgliedschaft und verändert keine fremde Mitgliedschaft.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] Projektbeitritt normalisiert Join-Code und erzeugt genau eine aktive Player-Mitgliedschaft.
- [ ] Vorhandene Mitgliedschaft und unbekannter Code folgen den belegten Fehlerfällen ohne doppelte Zeile.
- [ ] Nur vollständiger eigener Charakter darf zugeordnet werden; NULL entfernt die Zuordnung.
- [ ] Änderung der Figur erfordert die eigene aktive Projektmitgliedschaft und verändert keine fremde Mitgliedschaft.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #873 (RPC-SAGA-PROVISION)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-project-membership`
- Design: `.qa/design/migration-issues/stack-migration-rpc-project-membership.md`
- Status: blocked
- Reihenfolge: 25; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-025`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-project-membership.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
