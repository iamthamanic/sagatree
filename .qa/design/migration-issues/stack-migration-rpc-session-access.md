<!-- migration-contract:v2 localId=RPC-SESSION-ACCESS -->
# RPC-SESSION-ACCESS: Session-Beitritt, Austritt und Einladung

## Type

Task

## Intent

Session-Beitritt, Austritt und Einladung: join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Session-Beitritt, Austritt und Einladung: join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-access/join_session_by_code/index.ts, server/src/application/session-access/leave_play_session/index.ts, server/src/application/session-access/create_session_invite/index.ts, server/src/application/session-access/resolve_session_invite/index.ts, server/src/application/session-access/revoke_session_invite/index.ts, server/src/modules/session/index.ts, server/src/application/commands/join_session_by_code.ts, server/src/application/commands/leave_play_session.ts, server/src/application/commands/create_session_invite.ts, server/src/application/commands/resolve_session_invite.ts, server/src/application/commands/revoke_session_invite.ts, server/src/application/session-access/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #814. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/session/contracts/session-invite.ts, src/domains/session/contracts/session-lifecycle.ts, src/domains/session/contracts/session.types.ts, src/infrastructure/session/session-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/002_character_trait_arrays.sql, supabase/migrations/005_character_ruleset_metadata.sql, supabase/migrations/007_sagadrive_character_profile.sql, supabase/migrations/010_characters_v3_columns.sql, supabase/migrations/014_character_abilities_emotion_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/016_character_inventory_v2.sql, supabase/migrations/022_npc_creature_controller_assignments.sql, supabase/migrations/023_npc_creature_instances.sql, supabase/migrations/029_character_sheet_status.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/047_session_program_presentation.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/051_session_director_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/053_sessions_look_override.sql, supabase/migrations/055_session_invites.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/072_dornhain_seed_and_character_rls.sql, supabase/migrations/073_sagatree_schema_rename_compat.sql, supabase/migrations/079_drop_sagadrive_aliases.sql, supabase/migrations/089_gm_presence_character_type.sql, supabase/migrations/092_fix_projects_rls_recursion.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/join_session_by_code.md, .qa/intake/rpc-contracts/leave_play_session.md, .qa/intake/rpc-contracts/create_session_invite.md, .qa/intake/rpc-contracts/resolve_session_invite.md, .qa/intake/rpc-contracts/revoke_session_invite.md.

### Nachher und Verhalten

Session-Beitritt, Austritt und Einladung: join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-access/join_session_by_code/index.ts, server/src/application/session-access/leave_play_session/index.ts, server/src/application/session-access/create_session_invite/index.ts, server/src/application/session-access/resolve_session_invite/index.ts, server/src/application/session-access/revoke_session_invite/index.ts, server/src/modules/session/index.ts, server/src/application/commands/join_session_by_code.ts, server/src/application/commands/leave_play_session.ts, server/src/application/commands/create_session_invite.ts, server/src/application/commands/resolve_session_invite.ts, server/src/application/commands/revoke_session_invite.ts, server/src/application/session-access/__tests__.

## Scope

- Quellpfade: `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/055_session_invites.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`
- Änderbare Zielpfade: `server/src/application/session-access/join_session_by_code/index.ts`, `server/src/application/session-access/leave_play_session/index.ts`, `server/src/application/session-access/create_session_invite/index.ts`, `server/src/application/session-access/resolve_session_invite/index.ts`, `server/src/application/session-access/revoke_session_invite/index.ts`, `server/src/modules/session/index.ts`, `server/src/application/commands/join_session_by_code.ts`, `server/src/application/commands/leave_play_session.ts`, `server/src/application/commands/create_session_invite.ts`, `server/src/application/commands/resolve_session_invite.ts`, `server/src/application/commands/revoke_session_invite.ts`, `server/src/application/session-access/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/join_session_by_code.md`, `.qa/intake/rpc-contracts/leave_play_session.md`, `.qa/intake/rpc-contracts/create_session_invite.md`, `.qa/intake/rpc-contracts/resolve_session_invite.md`, `.qa/intake/rpc-contracts/revoke_session_invite.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
- {"id":"RPC-SEC-LEAVE-FOREIGN","severity":"High","status":"blocked-successor-acceptance","summary":"Authentifizierter Fremdnutzer kann bei bekannter Session-UUID Revision erhöhen und leave-Event einfügen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql: leave_play_session prüft keine Teilnahme; append_session_event ist SECURITY DEFINER ohne eigene Akteurprüfung.","requiredSuccessorAcceptance":"Nachfolger blockiert den Fremdnutzer vor jeglichem Event-/Revision-Write; isolierter Negativtest und getrennte Sicherheitsfreigabe erforderlich.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-FOREIGN-LEAVE"}}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite ausführt
- Dann: Beitritt normalisiert Codes, prüft vollständigen eigenen Charakter und verbindet Projektmitgliedschaft, Roster, Revision und Join-Event atomar.
- Quelle: `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/055_session_invites.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite ausführt
- Dann: Fremdnutzer-Austritt darf weder Session-Revision noch Events verändern; der bekannte Legacy-Defekt ist explizit behoben.
- Quelle: `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/055_session_invites.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite ausführt
- Dann: Einladung erzeugen/widerrufen verlangt Session-GM; Erneuern widerruft vorherige aktive Tokens.
- Quelle: `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/055_session_invites.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für join_session_by_code, leave_play_session, create_session_invite, resolve_session_invite, revoke_session_invite ausführt
- Dann: Abgelaufenes/widerrufenes/fehlendes Token und abgeschlossene Session liefern die belegten Fehlercodes; reine Auflösung tritt der Session nicht bei.
- Quelle: `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/055_session_invites.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Acceptance

- [ ] Beitritt normalisiert Codes, prüft vollständigen eigenen Charakter und verbindet Projektmitgliedschaft, Roster, Revision und Join-Event atomar.
- [ ] Fremdnutzer-Austritt darf weder Session-Revision noch Events verändern; der bekannte Legacy-Defekt ist explizit behoben.
- [ ] Einladung erzeugen/widerrufen verlangt Session-GM; Erneuern widerruft vorherige aktive Tokens.
- [ ] Abgelaufenes/widerrufenes/fehlendes Token und abgeschlossene Session liefern die belegten Fehlercodes; reine Auflösung tritt der Session nicht bei.
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

- Feature slug: `stack-migration-rpc-session-access`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-access.md`
- Status: blocked
- Reihenfolge: 31; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-031`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-access.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
