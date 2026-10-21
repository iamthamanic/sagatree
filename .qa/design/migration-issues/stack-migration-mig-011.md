<!-- migration-contract:v2 localId=MIG-011 -->
# MIG-011: SQLite schema bootstrap + migration runner

## Type

Task

## Intent

Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung im Host-Persistenzmodul aufbauen.

## Goal

Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung im Host-Persistenzmodul aufbauen. Zielpfade: server/src/persistence, server/migrations, server/src/modules.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/migrations, scripts/apply-migrations.sh, docs/architecture/host-modular-monolith.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung im Host-Persistenzmodul aufbauen. Zielpfade: server/src/persistence, server/migrations, server/src/modules.

## Scope

- Quellpfade: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`
- Änderbare Zielpfade: `server/src/persistence`, `server/migrations`, `server/src/modules`
- Quellverträge: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

## Security & Data

Schema-Upgrades dürfen keine Owner-/Membership-Zuordnung verlieren. Dateirechte und DB-Lock verhindern konkurrierende nicht koordinierte Upgrades. Tabellenfamilien bleiben dem owning module aus dem Host-Modulvertrag zugeordnet.

## Edge Cases

### Fall 1

- Gegeben: Leere Datenbank und ein freigegebener geordneter Schema-Stand
- Wenn: der Migrationsrunner zweimal startet
- Dann: Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: Ein absichtlich fehlerhafter Migrationsschritt
- Wenn: das Upgrade abbricht
- Dann: Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: Ein Datenbestand mit UUIDs, Zeitstempeln, JSON und Membership-FKs
- Wenn: der Integritätscheck läuft
- Dann: Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Zwei Domänenmodule mit getrennten Tabellenfamilien
- Wenn: Persistenzcode landet unter server/
- Dann: Jede Tabelle gehört genau einem Modul laut host-modular-monolith; fremde Module importieren keine privaten persistence-Pfade und schreiben nicht über Roh-SQL in fremde Aggregate.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

## Acceptance

- [ ] Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.
- [ ] Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.
- [ ] Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.
- [ ] Jede Tabelle gehört genau einem Modul laut host-modular-monolith; fremde Module importieren keine privaten persistence-Pfade und schreiben nicht über Roh-SQL in fremde Aggregate.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #784 (GATE-01)
- Depends on #787 (GATE-04)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-011`
- Design: `.qa/design/migration-issues/stack-migration-mig-011.md`
- Status: blocked
- Reihenfolge: 9; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-009`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-011.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
