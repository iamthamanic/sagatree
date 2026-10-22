<!-- migration-contract:v2 localId=RPC-SAGA-VERSION-READ -->
# RPC-SAGA-VERSION-READ: Saga-Versionen und native Katalogprojektion

## Type

Task

## Intent

Saga-Versionen und native Katalogprojektion: get_native_saga_definition_by_slug, get_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Versionen und native Katalogprojektion: get_native_saga_definition_by_slug, get_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts, server/src/application/saga-version-read/get_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/get_native_saga_definition_by_slug.ts, server/src/application/commands/get_saga_definition_version.ts, server/src/application/saga-version-read/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #815. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/saga/contracts/saga-definition.ts, src/infrastructure/saga/saga-definition-service.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/064_saga_editor_v1.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/get_native_saga_definition_by_slug.md, .qa/intake/rpc-contracts/get_saga_definition_version.md.

### Nachher und Verhalten

Saga-Versionen und native Katalogprojektion: get_native_saga_definition_by_slug, get_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts, server/src/application/saga-version-read/get_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/get_native_saga_definition_by_slug.ts, server/src/application/commands/get_saga_definition_version.ts, server/src/application/saga-version-read/__tests__.

## Scope

- Quellpfade: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts`, `server/src/application/saga-version-read/get_saga_definition_version/index.ts`, `server/src/modules/saga/index.ts`, `server/src/application/commands/get_native_saga_definition_by_slug.ts`, `server/src/application/commands/get_saga_definition_version.ts`, `server/src/application/saga-version-read/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/get_native_saga_definition_by_slug.md`, `.qa/intake/rpc-contracts/get_saga_definition_version.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
- [ ] Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
- [ ] Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
- [ ] Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #871 (RPC-SAGA-AUTHORING)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-saga-version-read`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-version-read.md`
- Status: blocked
- Reihenfolge: 23; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-023`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-version-read.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
