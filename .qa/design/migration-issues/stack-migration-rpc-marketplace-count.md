<!-- migration-contract:v2 localId=RPC-MARKETPLACE-COUNT -->
# RPC-MARKETPLACE-COUNT: Marketplace-Downloadzähler und Fallback

## Type

Task

## Intent

Marketplace-Downloadzähler und Fallback: increment_marketplace_downloads als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Marketplace-Downloadzähler und Fallback: increment_marketplace_downloads als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/marketplace-count/increment_marketplace_downloads/index.ts, server/src/modules/marketplace/index.ts, server/src/application/commands/increment_marketplace_downloads.ts, server/src/application/marketplace-count/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #816. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/marketplace/marketplace-service.ts, src/lib/supabase.ts, src/supabase/add_marketplace_rpc.sql, src/supabase/deploy_marketplace.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/increment_marketplace_downloads.md.

### Nachher und Verhalten

Marketplace-Downloadzähler und Fallback: increment_marketplace_downloads als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/marketplace-count/increment_marketplace_downloads/index.ts, server/src/modules/marketplace/index.ts, server/src/application/commands/increment_marketplace_downloads.ts, server/src/application/marketplace-count/__tests__.

## Scope

- Quellpfade: `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`, `src/supabase/add_marketplace_rpc.sql`, `src/supabase/deploy_marketplace.sql`
- Änderbare Zielpfade: `server/src/application/marketplace-count/increment_marketplace_downloads/index.ts`, `server/src/modules/marketplace/index.ts`, `server/src/application/commands/increment_marketplace_downloads.ts`, `server/src/application/marketplace-count/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/increment_marketplace_downloads.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-DEPLOY-OPTIONAL-MARKETPLACE","severity":"Medium","status":"blocked-successor-acceptance","summary":"Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette.","sourceEvidence":"src/supabase/add_marketplace_rpc.sql und src/supabase/deploy_marketplace.sql; isolierter pg_proc-Katalog enthält keine increment_marketplace_downloads.","requiredSuccessorAcceptance":"Eindeutige Installations-/Nachfolgerentscheidung und Client-Fallback-Test vor Umsetzung.","deployedExploitVerified":false}
- {"id":"RPC-ACL-MARKETPLACE-DEFINER","severity":"Medium","status":"blocked-successor-acceptance","summary":"Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE.","sourceEvidence":"Beide optionalen SQL-Skripte: keine REVOKE PUBLIC, keine SET search_path, kein auth.uid-Guard.","requiredSuccessorAcceptance":"Gewünschte öffentliche Zählberechtigung explizit festlegen; Tabellenqualifizierung/Ausführungskontext und Abuse-/Retry-Semantik prüfen.","deployedExploitVerified":false}

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

## Acceptance

- [ ] Die zwei identischen Definitionen außerhalb der Migrationskette werden als alternative Installationsquellen geführt; eine Deployment-Entscheidung liegt vor.
- [ ] Vorhandenes Item erhöht downloads atomar um eins, unbekanntes Item bleibt No-op; NULL-Verhalten ist belegt.
- [ ] Öffentliche Ausführbarkeit, fehlender search_path und fehlende Akteurprüfung sind explizite Legacy-Entscheidungen und werden nicht still als sicher übernommen.
- [ ] Client-RPC-Fehler und fehlende Funktion aktivieren den dokumentierten direkten Tabellenfallback; dessen Race-/RLS-Verhalten ist geprüft.
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

- Feature slug: `stack-migration-rpc-marketplace-count`
- Design: `.qa/design/migration-issues/stack-migration-rpc-marketplace-count.md`
- Status: blocked
- Reihenfolge: 21; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-021`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-marketplace-count.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-blocked
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
