<!-- migration-contract:v2 localId=MIG-001 -->
# MIG-001: Evidence lock: freeze main baseline + golden fixture contract

## Type

Task

## Intent

Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten.

## Goal

Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten. Zielpfade: .qa/evidence/stack-migration-prep/baseline.md, scripts/stack-migration-db.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: AGENTS.md, .qa/project.yaml, supabase/migrations, scripts/apply-migrations.sh. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten. Zielpfade: .qa/evidence/stack-migration-prep/baseline.md, scripts/stack-migration-db.

## Scope

- Quellpfade: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/baseline.md`, `scripts/stack-migration-db`
- Quellverträge: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

## Security & Data

Nur eine isolierte lokale Datenbank mit synthetischen Identitäten verwenden; Produktiv-Verbindungsdaten sind kein Default. Source-Baseline, angewendete Migrationen und tatsächlich beobachtete Datenbank-ACL getrennt ausweisen.

## Edge Cases

### Fall 1

- Gegeben: Ein festgehaltener main-Commit und die unveränderten Repository-Migrationen
- Wenn: der Baseline-Lauf baut eine leere PostgreSQL-Instanz auf
- Dann: Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

### Fall 2

- Gegeben: Weltbesitzer O, eigenständiger Projekt-GM G, P1, P2 und Fremdbesitzer X
- Wenn: die Seed-Datei wird zweimal auf einer frischen Instanz ausgeführt
- Dann: Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

### Fall 3

- Gegeben: Ein Baseline-Commit und eine spätere Arbeitskopie
- Wenn: Tests werden protokolliert
- Dann: Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

## Acceptance

- [ ] Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.
- [ ] Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.
- [ ] Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Keine Vorgänger.

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-001`
- Design: `.qa/design/migration-issues/stack-migration-mig-001.md`
- Status: blocked
- Reihenfolge: 1; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-001`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-001.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
