<!-- migration-contract:v2 localId=RPC-SESSION-LIFECYCLE -->
# RPC-SESSION-LIFECYCLE: Session anlegen und Status wechseln

## Type

Task

## Intent

Session anlegen und Status wechseln: create_play_session, create_project_session, set_session_status als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Session anlegen und Status wechseln: create_play_session, create_project_session, set_session_status als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/create_play_session.ts, server/src/application/commands/create_project_session.ts, server/src/application/commands/set_session_status.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #814. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/project/contracts/project.types.ts, src/domains/session/contracts/session-lifecycle.ts, src/domains/session/contracts/session.types.ts, src/infrastructure/project/project-service.ts, src/infrastructure/session/session-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/046_look_profiles.sql, supabase/migrations/047_session_program_presentation.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/051_session_director_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/062_session_recap_ai_summary.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/084_look_profiles_public_id.sql, supabase/migrations/085_fix_function_bodies_sagatree.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/create_play_session.md, .qa/intake/rpc-contracts/create_project_session.md, .qa/intake/rpc-contracts/set_session_status.md.

### Nachher und Verhalten

Session anlegen und Status wechseln: create_play_session, create_project_session, set_session_status als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/create_play_session.ts, server/src/application/commands/create_project_session.ts, server/src/application/commands/set_session_status.ts.

## Scope

- Quellpfade: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/commands/create_play_session.ts`, `server/src/application/commands/create_project_session.ts`, `server/src/application/commands/set_session_status.ts`
- Quellverträge: `.qa/intake/rpc-contracts/create_play_session.md`, `.qa/intake/rpc-contracts/create_project_session.md`, `.qa/intake/rpc-contracts/set_session_status.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für create_play_session, create_project_session, set_session_status und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_play_session, create_project_session, set_session_status ausführt
- Dann: create_play_session verlangt GM; create_project_session erlaubt den im Quellcode belegten aktiven GM-/Player-Mitgliedschaftspfad.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für create_play_session, create_project_session, set_session_status und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_play_session, create_project_session, set_session_status ausführt
- Dann: Parallele Erzeugung vergibt eindeutige Session-Nummern und Join-Codes; scheduled/waiting und Kopie des letzten Abschlusswissens bleiben korrekt.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für create_play_session, create_project_session, set_session_status und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_play_session, create_project_session, set_session_status ausführt
- Dann: Nur erlaubte waiting/active/paused/completed-Übergänge verändern Status und Revision; completed ist terminal.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für create_play_session, create_project_session, set_session_status und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_play_session, create_project_session, set_session_status ausführt
- Dann: Abschluss erzeugt Recap/Handover und Status-Event atomar; Fehler in einem Helper rollen alles zurück.
- Quelle: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] create_play_session verlangt GM; create_project_session erlaubt den im Quellcode belegten aktiven GM-/Player-Mitgliedschaftspfad.
- [ ] Parallele Erzeugung vergibt eindeutige Session-Nummern und Join-Codes; scheduled/waiting und Kopie des letzten Abschlusswissens bleiben korrekt.
- [ ] Nur erlaubte waiting/active/paused/completed-Übergänge verändern Status und Revision; completed ist terminal.
- [ ] Abschluss erzeugt Recap/Handover und Status-Event atomar; Fehler in einem Helper rollen alles zurück.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #867 (RPC-SESSION-RUNTIME)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-session-lifecycle`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-lifecycle.md`
- Status: blocked
- Reihenfolge: 28; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-028`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-lifecycle.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
