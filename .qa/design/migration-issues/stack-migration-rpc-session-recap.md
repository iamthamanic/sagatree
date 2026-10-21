<!-- migration-contract:v2 localId=RPC-SESSION-RECAP -->
# RPC-SESSION-RECAP: Recap-Projektion und Zusammenfassung

## Type

Task

## Intent

Recap-Projektion und Zusammenfassung: get_session_recap, save_session_recap_summary als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Recap-Projektion und Zusammenfassung: get_session_recap, save_session_recap_summary als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/get_session_recap.ts, server/src/application/commands/save_session_recap_summary.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #814. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/session/contracts/session-prepare-recap.ts, src/infrastructure/session/session-recap-ai-service.ts, src/infrastructure/session/session-recap-service.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/051_session_director_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/062_session_recap_ai_summary.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/get_session_recap.md, .qa/intake/rpc-contracts/save_session_recap_summary.md.

### Nachher und Verhalten

Recap-Projektion und Zusammenfassung: get_session_recap, save_session_recap_summary als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/get_session_recap.ts, server/src/application/commands/save_session_recap_summary.ts.

## Scope

- Quellpfade: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/commands/get_session_recap.ts`, `server/src/application/commands/save_session_recap_summary.ts`
- Quellverträge: `.qa/intake/rpc-contracts/get_session_recap.md`, `.qa/intake/rpc-contracts/save_session_recap_summary.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-OVERLOAD-RECAP-AMBIGUITY","severity":"Medium","status":"blocked-successor-acceptance","summary":"Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen.","sourceEvidence":"supabase/migrations/061_session_recaps_and_handover.sql und 062_session_recap_ai_summary.sql; BASELINE-RPC-RECAP-OVERLOAD reproduziert für public.save_session_recap_summary(uuid, text) den Fehler function is not unique / ambiguous_function.","requiredSuccessorAcceptance":"Nachfolger besitzt eine eindeutig auflösbare Signatur. Der vorhandene Client sendet drei benannteParameter inklusivep_status; diesen Pfad erhalten und Zweierpfad bewusst beseitigen/kompatibel behandeln.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-RPC-RECAP-OVERLOAD"}}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_session_recap, save_session_recap_summary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_session_recap, save_session_recap_summary ausführt
- Dann: GM sieht Draft; Player erhält ausschließlich freigegebene Zusammenfassung und redigierte Highlights.
- Quelle: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_session_recap, save_session_recap_summary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_session_recap, save_session_recap_summary ausführt
- Dann: Beide SQL-Overloads und die mögliche Zweiparameter-Auflösungsambiguität werden gegen PostgreSQL geprüft; Zielaufruf ist eindeutig.
- Quelle: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_session_recap, save_session_recap_summary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_session_recap, save_session_recap_summary ausführt
- Dann: Draft/approved/none-Speicherung verändert nur Summary-Felder eines vorhandenen Recaps und erhält Highlights/Snapshot.
- Quelle: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_session_recap, save_session_recap_summary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_session_recap, save_session_recap_summary ausführt
- Dann: Fremdprojekt, nicht teilnehmender Akteur und ungültiger Status scheitern ohne Summary-Änderung.
- Quelle: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] GM sieht Draft; Player erhält ausschließlich freigegebene Zusammenfassung und redigierte Highlights.
- [ ] Beide SQL-Overloads und die mögliche Zweiparameter-Auflösungsambiguität werden gegen PostgreSQL geprüft; Zielaufruf ist eindeutig.
- [ ] Draft/approved/none-Speicherung verändert nur Summary-Felder eines vorhandenen Recaps und erhält Highlights/Snapshot.
- [ ] Fremdprojekt, nicht teilnehmender Akteur und ungültiger Status scheitern ohne Summary-Änderung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #868 (RPC-SESSION-LIFECYCLE)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-session-recap`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-recap.md`
- Status: blocked
- Reihenfolge: 32; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-032`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-recap.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
