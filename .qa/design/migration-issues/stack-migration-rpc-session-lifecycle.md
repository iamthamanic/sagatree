<!-- migration-contract:v2 localId=RPC-SESSION-LIFECYCLE -->
# RPC-SESSION-LIFECYCLE: Session anlegen und Status wechseln

## Type

feature

## Intent

Session anlegen und Status wechseln: create_play_session, create_project_session, set_session_status als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Session anlegen und Status wechseln: create_play_session, create_project_session, set_session_status als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-lifecycle/create_play_session/index.ts, server/src/application/session-lifecycle/create_project_session/index.ts, server/src/application/session-lifecycle/set_session_status/index.ts, server/src/modules/session/index.ts, server/src/application/commands/create_play_session.ts, server/src/application/commands/create_project_session.ts, server/src/application/commands/set_session_status.ts, server/src/application/session-lifecycle/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/project/contracts/project.types.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session.types.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/create_play_session.md`, `.qa/intake/rpc-contracts/create_project_session.md`, `.qa/intake/rpc-contracts/set_session_status.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #814.

## Scope

In:
- `server/src/application/session-lifecycle/create_play_session/index.ts`
- `server/src/application/session-lifecycle/create_project_session/index.ts`
- `server/src/application/session-lifecycle/set_session_status/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/create_play_session.ts`
- `server/src/application/commands/create_project_session.ts`
- `server/src/application/commands/set_session_status.ts`
- `server/src/application/session-lifecycle/__tests__`

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

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
- Quelle: `.qa/intake/rpc-contracts/create_play_session.md`, `.qa/intake/rpc-contracts/create_project_session.md`, `.qa/intake/rpc-contracts/set_session_status.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. create_play_session verlangt GM; create_project_session erlaubt den im Quellcode belegten aktiven GM-/Player-Mitgliedschaftspfad.
2. Parallele Erzeugung vergibt eindeutige Session-Nummern und Join-Codes; scheduled/waiting und Kopie des letzten Abschlusswissens bleiben korrekt.
3. Nur erlaubte waiting/active/paused/completed-Übergänge verändern Status und Revision; completed ist terminal.
4. Abschluss erzeugt Recap/Handover und Status-Event atomar; Fehler in einem Helper rollen alles zurück.
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
| **SLICE DONE** | Isolated deliverable under `server/src/application/session-lifecycle/create_play_session/index.ts`, `server/src/application/session-lifecycle/create_project_session/index.ts`, `server/src/application/session-lifecycle/set_session_status/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-301..313 / MIG-311 session adapters as applicable |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 (+ MIG-311/#810 for legacy adapters) |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #867 (RPC-SESSION-RUNTIME)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-session-lifecycle`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-lifecycle.md`
- Status: waiting
- Reihenfolge: 28; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-028`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-lifecycle.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

