<!-- migration-contract:v2 localId=RPC-SAGA-AUTHORING -->
# RPC-SAGA-AUTHORING: Saga-Entwurf, Kopie und Veröffentlichung

## Type

Task

## Intent

Saga-Entwurf, Kopie und Veröffentlichung: create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Entwurf, Kopie und Veröffentlichung: create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-authoring/create_user_saga_definition/index.ts, server/src/application/saga-authoring/copy_native_saga_definition/index.ts, server/src/application/saga-authoring/get_saga_definition_editor/index.ts, server/src/application/saga-authoring/save_saga_definition_draft/index.ts, server/src/application/saga-authoring/publish_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/create_user_saga_definition.ts, server/src/application/commands/copy_native_saga_definition.ts, server/src/application/commands/get_saga_definition_editor.ts, server/src/application/commands/save_saga_definition_draft.ts, server/src/application/commands/publish_saga_definition_version.ts, server/src/application/saga-authoring/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #815. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/saga/contracts/saga-definition.ts, src/infrastructure/saga/saga-definition-service.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/063_saga_definitions.sql, supabase/migrations/064_saga_editor_v1.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/create_user_saga_definition.md, .qa/intake/rpc-contracts/copy_native_saga_definition.md, .qa/intake/rpc-contracts/get_saga_definition_editor.md, .qa/intake/rpc-contracts/save_saga_definition_draft.md, .qa/intake/rpc-contracts/publish_saga_definition_version.md.

### Nachher und Verhalten

Saga-Entwurf, Kopie und Veröffentlichung: create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-authoring/create_user_saga_definition/index.ts, server/src/application/saga-authoring/copy_native_saga_definition/index.ts, server/src/application/saga-authoring/get_saga_definition_editor/index.ts, server/src/application/saga-authoring/save_saga_definition_draft/index.ts, server/src/application/saga-authoring/publish_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/create_user_saga_definition.ts, server/src/application/commands/copy_native_saga_definition.ts, server/src/application/commands/get_saga_definition_editor.ts, server/src/application/commands/save_saga_definition_draft.ts, server/src/application/commands/publish_saga_definition_version.ts, server/src/application/saga-authoring/__tests__.

## Scope

- Quellpfade: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`
- Änderbare Zielpfade: `server/src/application/saga-authoring/create_user_saga_definition/index.ts`, `server/src/application/saga-authoring/copy_native_saga_definition/index.ts`, `server/src/application/saga-authoring/get_saga_definition_editor/index.ts`, `server/src/application/saga-authoring/save_saga_definition_draft/index.ts`, `server/src/application/saga-authoring/publish_saga_definition_version/index.ts`, `server/src/modules/saga/index.ts`, `server/src/application/commands/create_user_saga_definition.ts`, `server/src/application/commands/copy_native_saga_definition.ts`, `server/src/application/commands/get_saga_definition_editor.ts`, `server/src/application/commands/save_saga_definition_draft.ts`, `server/src/application/commands/publish_saga_definition_version.ts`, `server/src/application/saga-authoring/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/create_user_saga_definition.md`, `.qa/intake/rpc-contracts/copy_native_saga_definition.md`, `.qa/intake/rpc-contracts/get_saga_definition_editor.md`, `.qa/intake/rpc-contracts/save_saga_definition_draft.md`, `.qa/intake/rpc-contracts/publish_saga_definition_version.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version ausführt
- Dann: Owner-Scope schützt Entwurf und Veröffentlichung; native Definitionen bleiben unveränderlich.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version ausführt
- Dann: Editor-Lesen kann fehlenden Draft anlegen; wiederholtes Lesen erzeugt keinen zweiten Draft.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version ausführt
- Dann: Save/Publish sperren die Definition und prüfen erwartete Revision; Konflikt 40001 hinterlässt keine neue Veröffentlichung.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version ausführt
- Dann: Native Kopie erzeugt eigene Definition mit korrekten Draft-/Published-Versionen; Veröffentlichung überschreibt keine bestehende Version.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`

## Acceptance

- [ ] Owner-Scope schützt Entwurf und Veröffentlichung; native Definitionen bleiben unveränderlich.
- [ ] Editor-Lesen kann fehlenden Draft anlegen; wiederholtes Lesen erzeugt keinen zweiten Draft.
- [ ] Save/Publish sperren die Definition und prüfen erwartete Revision; Konflikt 40001 hinterlässt keine neue Veröffentlichung.
- [ ] Native Kopie erzeugt eigene Definition mit korrekten Draft-/Published-Versionen; Veröffentlichung überschreibt keine bestehende Version.
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

- Feature slug: `stack-migration-rpc-saga-authoring`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-authoring.md`
- Status: blocked
- Reihenfolge: 22; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-022`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-authoring.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
