<!-- migration-contract:v2 localId=RPC-MARKETPLACE-COUNT -->
# RPC-MARKETPLACE-COUNT: Marketplace-Downloadzähler und Fallback

## Type

feature

## Intent

Marketplace-Downloadzähler und Fallback: increment_marketplace_downloads als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Marketplace-Downloadzähler und Fallback: increment_marketplace_downloads als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/marketplace-count/increment_marketplace_downloads/index.ts, server/src/modules/marketplace/index.ts, server/src/application/commands/increment_marketplace_downloads.ts, server/src/application/marketplace-count/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #816.

## Scope

In:
- `server/src/application/marketplace-count/increment_marketplace_downloads/index.ts`
- `server/src/modules/marketplace/index.ts`
- `server/src/application/commands/increment_marketplace_downloads.ts`
- `server/src/application/marketplace-count/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-DEPLOY-OPTIONAL-MARKETPLACE","severity":"Medium","status":"resolved-corrective","summary":"Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette.","sourceEvidence":"src/supabase/add_marketplace_rpc.sql und src/supabase/deploy_marketplace.sql; isolierter pg_proc-Katalog enthält keine increment_marketplace_downloads.","requiredSuccessorAcceptance":"Eindeutige Installations-/Nachfolgerentscheidung; Counter nur über installierte RPC oder Host-Nachfolger — kein Client-Write-Fallback.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}
- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-ACL-MARKETPLACE-DEFINER","severity":"Medium","status":"resolved-corrective","summary":"Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE.","sourceEvidence":"Beide optionalen SQL-Skripte: keine REVOKE PUBLIC, keine SET search_path, kein auth.uid-Guard.","requiredSuccessorAcceptance":"Gewünschte öffentliche Zählberechtigung explizit festlegen; Tabellenqualifizierung/Ausführungskontext und Abuse-/Retry-Semantik prüfen.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für increment_marketplace_downloads und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für increment_marketplace_downloads ausführt
- Dann: Die zwei identischen Definitionen außerhalb der Migrationskette werden als alternative Installationsquellen geführt; eine Deployment-Entscheidung liegt vor.
- Quelle: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für increment_marketplace_downloads und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für increment_marketplace_downloads ausführt
- Dann: Vorhandenes Item erhöht downloads atomar um eins, unbekanntes Item bleibt No-op; NULL-Verhalten ist belegt.
- Quelle: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für increment_marketplace_downloads und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für increment_marketplace_downloads ausführt
- Dann: Öffentliche Ausführbarkeit, fehlender search_path und fehlende Akteurprüfung sind explizite Legacy-Entscheidungen und werden nicht still als sicher übernommen.
- Quelle: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für increment_marketplace_downloads und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für increment_marketplace_downloads ausführt
- Dann: Client-RPC-Fehler und fehlende Funktion aktivieren den dokumentierten direkten Tabellenfallback; dessen Race-/RLS-Verhalten ist geprüft.
- Quelle: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-DEPLOY-OPTIONAL-MARKETPLACE","severity":"Medium","status":"resolved-corrective","summary":"Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette.","sourceEvidence":"src/supabase/add_marketplace_rpc.sql und src/supabase/deploy_marketplace.sql; isolierter pg_proc-Katalog enthält keine increment_marketplace_downloads.","requiredSuccessorAcceptance":"Eindeutige Installations-/Nachfolgerentscheidung; Counter nur über installierte RPC oder Host-Nachfolger — kein Client-Write-Fallback.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}
- Quelle: `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`

### Fall 6

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-ACL-MARKETPLACE-DEFINER","severity":"Medium","status":"resolved-corrective","summary":"Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE.","sourceEvidence":"Beide optionalen SQL-Skripte: keine REVOKE PUBLIC, keine SET search_path, kein auth.uid-Guard.","requiredSuccessorAcceptance":"Gewünschte öffentliche Zählberechtigung explizit festlegen; Tabellenqualifizierung/Ausführungskontext und Abuse-/Retry-Semantik prüfen.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}
- Quelle: `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Die zwei identischen Definitionen außerhalb der Migrationskette werden als alternative Installationsquellen geführt; eine Deployment-Entscheidung liegt vor.
2. Vorhandenes Item erhöht downloads atomar um eins, unbekanntes Item bleibt No-op; NULL-Verhalten ist belegt.
3. Öffentliche Ausführbarkeit, fehlender search_path und fehlende Akteurprüfung sind explizite Legacy-Entscheidungen und werden nicht still als sicher übernommen.
4. Client-RPC-Fehler und fehlende Funktion aktivieren den dokumentierten direkten Tabellenfallback; dessen Race-/RLS-Verhalten ist geprüft.
5. Verpflichtende Legacy-Regression: {"id":"RPC-DEPLOY-OPTIONAL-MARKETPLACE","severity":"Medium","status":"resolved-corrective","summary":"Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette.","sourceEvidence":"src/supabase/add_marketplace_rpc.sql und src/supabase/deploy_marketplace.sql; isolierter pg_proc-Katalog enthält keine increment_marketplace_downloads.","requiredSuccessorAcceptance":"Eindeutige Installations-/Nachfolgerentscheidung; Counter nur über installierte RPC oder Host-Nachfolger — kein Client-Write-Fallback.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}
6. Verpflichtende Legacy-Regression: {"id":"RPC-ACL-MARKETPLACE-DEFINER","severity":"Medium","status":"resolved-corrective","summary":"Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE.","sourceEvidence":"Beide optionalen SQL-Skripte: keine REVOKE PUBLIC, keine SET search_path, kein auth.uid-Guard.","requiredSuccessorAcceptance":"Gewünschte öffentliche Zählberechtigung explizit festlegen; Tabellenqualifizierung/Ausführungskontext und Abuse-/Retry-Semantik prüfen.","deployedExploitVerified":false,"resolution":"Host migration 0029 + MarketplaceCountStore (#878); FE RPC-only (#675)."}
7. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 6 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/marketplace-count/increment_marketplace_downloads/index.ts`, `server/src/modules/marketplace/index.ts`, `server/src/application/commands/increment_marketplace_downloads.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-marketplace-count`
- Design: `.qa/design/migration-issues/stack-migration-rpc-marketplace-count.md`
- Status: done
- Reihenfolge: 21; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-021`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-marketplace-count.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

