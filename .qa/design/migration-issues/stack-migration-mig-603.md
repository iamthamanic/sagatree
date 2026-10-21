<!-- migration-contract:v2 localId=MIG-603 -->
# MIG-603: Ops: backup/restore/update/rollback runbooks

## Type

Task

## Intent

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren.

## Goal

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren. Zielpfade: docs/ops/host, scripts/host-backup.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docs/ops, docker-compose.yml, docs/architektur-sqlite-based.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren. Zielpfade: docs/ops/host, scripts/host-backup.

## Scope

- Quellpfade: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`
- Änderbare Zielpfade: `docs/ops/host`, `scripts/host-backup`
- Quellverträge: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

## Security & Data

Backups enthalten geschützte Daten und werden wie die Originaldaten autorisiert; Snapshot-Konsistenz darf nicht auf unkoordinierten Dateikopien beruhen.

## Edge Cases

### Fall 1

- Gegeben: Aktive Schreiblast und ein freigegebener Backup-Mechanismus
- Wenn: ein Snapshot erstellt und auf einem neuen Host restauriert wird
- Dann: SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Datenträger voll oder abgebrochene Kopie
- Wenn: Backup/Restore ausgeführt wird
- Dann: Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein fehlerhaftes Host-Update mit Testdaten
- Wenn: der dokumentierte Rollback-Drill folgt
- Dann: Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

## Acceptance

- [ ] SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.
- [ ] Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.
- [ ] Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #843 (MIG-502)
- Depends on #844 (MIG-503)
- Depends on #846 (MIG-601)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-603`
- Design: `.qa/design/migration-issues/stack-migration-mig-603.md`
- Status: blocked
- Reihenfolge: 85; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-085`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-603.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
