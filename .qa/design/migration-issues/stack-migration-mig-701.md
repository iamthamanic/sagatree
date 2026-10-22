<!-- migration-contract:v2 localId=MIG-701 -->
# MIG-701: Supabase dual-run parity window

## Type

Task

## Intent

Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben.

## Goal

Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben. Zielpfade: docs/ops/cutover/parity-window, server/src/migration.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docs/architektur-sqlite-based.md, .qa/design/parity-harness/README.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben. Zielpfade: docs/ops/cutover/parity-window, server/src/migration.

## Scope

- Quellpfade: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`
- Änderbare Zielpfade: `docs/ops/cutover/parity-window`, `server/src/migration`
- Quellverträge: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

## Security & Data

Dual-run bedeutet hier Vergleich mit einer ausdrücklich festgelegten Schreibautorität; keine zwei unabhängig schreibenden Systeme für dieselbe Welt/Saga.

## Edge Cases

### Fall 1

- Gegeben: Ein abgeschlossener MIG-700-Drill mit definierter Autorität
- Wenn: der Vergleich während des festgelegten Beobachtungsfensters läuft
- Dann: Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

### Fall 2

- Gegeben: Eine eingefügte Abweichung in Projektionsdaten oder Asset-Hash
- Wenn: der Vergleich erneut läuft
- Dann: Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

### Fall 3

- Gegeben: Ein Fehler über dem im Runbook festgelegten Schwellwert
- Wenn: der Rollback-Entscheidungsweg geprobt wird
- Dann: Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

## Acceptance

- [ ] Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.
- [ ] Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.
- [ ] Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #849 (MIG-700)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-701`
- Design: `.qa/design/migration-issues/stack-migration-mig-701.md`
- Status: blocked
- Reihenfolge: 88; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-088`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-701.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
