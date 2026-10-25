<!-- migration-contract:v2 localId=RPC-SESSION-RECAP -->
# RPC-SESSION-RECAP: Recap-Projektion und Zusammenfassung

## Type

feature

## Intent

Recap-Projektion und Zusammenfassung: get_session_recap, save_session_recap_summary als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Recap-Projektion und Zusammenfassung: get_session_recap, save_session_recap_summary als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-recap/get_session_recap/index.ts, server/src/application/session-recap/save_session_recap_summary/index.ts, server/src/modules/session/index.ts, server/src/application/commands/get_session_recap.ts, server/src/application/commands/save_session_recap_summary.ts, server/src/application/session-recap/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/session/contracts/session-prepare-recap.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_session_recap.md`, `.qa/intake/rpc-contracts/save_session_recap_summary.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #814.

## Scope

In:
- `server/src/application/session-recap/get_session_recap/index.ts`
- `server/src/application/session-recap/save_session_recap_summary/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/get_session_recap.ts`
- `server/src/application/commands/save_session_recap_summary.ts`
- `server/src/application/session-recap/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-OVERLOAD-RECAP-AMBIGUITY","severity":"Medium","status":"blocked-successor-acceptance","summary":"Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen.","sourceEvidence":"supabase/migrations/061_session_recaps_and_handover.sql und 062_session_recap_ai_summary.sql; BASELINE-RPC-RECAP-OVERLOAD reproduziert für public.save_session_recap_summary(uuid, text) den Fehler function is not unique / ambiguous_function.","requiredSuccessorAcceptance":"Nachfolger besitzt eine eindeutig auflösbare Signatur. Der vorhandene Client sendet drei benannteParameter inklusivep_status; diesen Pfad erhalten und Zweierpfad bewusst beseitigen/kompatibel behandeln.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-RPC-RECAP-OVERLOAD"}}

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

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-OVERLOAD-RECAP-AMBIGUITY","severity":"Medium","status":"blocked-successor-acceptance","summary":"Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen.","sourceEvidence":"supabase/migrations/061_session_recaps_and_handover.sql und 062_session_recap_ai_summary.sql; BASELINE-RPC-RECAP-OVERLOAD reproduziert für public.save_session_recap_summary(uuid, text) den Fehler function is not unique / ambiguous_function.","requiredSuccessorAcceptance":"Nachfolger besitzt eine eindeutig auflösbare Signatur. Der vorhandene Client sendet drei benannteParameter inklusivep_status; diesen Pfad erhalten und Zweierpfad bewusst beseitigen/kompatibel behandeln.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-RPC-RECAP-OVERLOAD"}}
- Quelle: `.qa/intake/rpc-contracts/get_session_recap.md`, `.qa/intake/rpc-contracts/save_session_recap_summary.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. GM sieht Draft; Player erhält ausschließlich freigegebene Zusammenfassung und redigierte Highlights.
2. Beide SQL-Overloads und die mögliche Zweiparameter-Auflösungsambiguität werden gegen PostgreSQL geprüft; Zielaufruf ist eindeutig.
3. Draft/approved/none-Speicherung verändert nur Summary-Felder eines vorhandenen Recaps und erhält Highlights/Snapshot.
4. Fremdprojekt, nicht teilnehmender Akteur und ungültiger Status scheitern ohne Summary-Änderung.
5. Verpflichtende Legacy-Regression: {"id":"RPC-OVERLOAD-RECAP-AMBIGUITY","severity":"Medium","status":"blocked-successor-acceptance","summary":"Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen.","sourceEvidence":"supabase/migrations/061_session_recaps_and_handover.sql und 062_session_recap_ai_summary.sql; BASELINE-RPC-RECAP-OVERLOAD reproduziert für public.save_session_recap_summary(uuid, text) den Fehler function is not unique / ambiguous_function.","requiredSuccessorAcceptance":"Nachfolger besitzt eine eindeutig auflösbare Signatur. Der vorhandene Client sendet drei benannteParameter inklusivep_status; diesen Pfad erhalten und Zweierpfad bewusst beseitigen/kompatibel behandeln.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-RPC-RECAP-OVERLOAD"}}
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/session-recap/get_session_recap/index.ts`, `server/src/application/session-recap/save_session_recap_summary/index.ts`, `server/src/modules/session/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #868 (RPC-SESSION-LIFECYCLE)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-session-recap`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-recap.md`
- Status: waiting
- Reihenfolge: 32; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-032`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-recap.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

