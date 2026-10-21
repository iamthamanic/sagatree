<!-- migration-contract:v2 localId=MIG-503 -->
# MIG-503: Postgres→SQLite data migration dry-run tooling

## Type

Task

## Intent

Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen.

## Goal

Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen. Zielpfade: server/src/migration/postgres.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/migrations, .qa/intake/rpc-contracts/inventory.json. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen. Zielpfade: server/src/migration/postgres.

## Scope

- Quellpfade: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`
- Änderbare Zielpfade: `server/src/migration/postgres`
- Quellverträge: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

## Security & Data

Defaults verbinden sich nur mit expliziten isolierten Testdaten. Owner, Memberships und geheime Sichtbarkeiten werden nicht vereinfacht.

## Edge Cases

### Fall 1

- Gegeben: Ein eingefrorener Postgres-Fixture-Snapshot mit vollständigem Schema
- Wenn: der Transfer auf eine leere SQLite-Datei läuft
- Dann: Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

### Fall 2

- Gegeben: Abbruch mitten im Transfer und anschließender Wiederholungslauf
- Wenn: dieselbe Snapshot-ID erneut übertragen wird
- Dann: Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

### Fall 3

- Gegeben: Synthetische Owner-/GM-/Spieler- und Secret-Daten
- Wenn: die Nachtransfer-Projektionen geprüft werden
- Dann: Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

## Acceptance

- [ ] Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.
- [ ] Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.
- [ ] Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #783 (MIG-002)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-503`
- Design: `.qa/design/migration-issues/stack-migration-mig-503.md`
- Status: blocked
- Reihenfolge: 20; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-020`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-503.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
