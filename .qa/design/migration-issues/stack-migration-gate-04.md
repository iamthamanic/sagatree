<!-- migration-contract:v2 localId=GATE-04 -->
# GATE-04: PoC: Preserve revision/transaction/idempotency guarantees under SQLite writer model

## Type

Task

## Intent

Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen.

## Goal

Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-04, .qa/design/gates/GATE-04-sqlite-revision-idempotency.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-04-sqlite-revision-idempotency.md, src/infrastructure/session/session-runtime-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-04, .qa/design/gates/GATE-04-sqlite-revision-idempotency.md.

## Scope

- Quellpfade: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/pocs/gate-04`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`
- Quellverträge: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

## Security & Data

Actor und Membership werden vor dem Schreibrecht geprüft. Idempotenz wird pro Sitzung und Schlüssel gespeichert und gegen Actor-/Payload-Wechsel geschützt; Broadcast erfolgt erst nach Commit.

## Edge Cases

### Fall 1

- Gegeben: 20 Clients mit jeweils 50 Commands und gemeinsamen expectedRevision-Werten
- Wenn: ein SQLite-Writer verarbeitet die gemischten Anforderungen
- Dann: Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 2

- Gegeben: Dieselbe session_id/idempotency_key sowie ein zweiter Actor oder anderer Payload
- Wenn: Retry und missbräuchliche Wiederverwendung werden gesendet
- Dann: Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 3

- Gegeben: Abbruchpunkte vor Commit, nach Commit und vor Broadcast
- Wenn: der Prozess wird tatsächlich mit SIGKILL beendet und aus WAL neu gestartet
- Dann: Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

## Acceptance

- [ ] Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.
- [ ] Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.
- [ ] Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **needs-design**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-gate-04`
- Design: `.qa/design/migration-issues/stack-migration-gate-04.md`
- Status: needs-design
- Reihenfolge: 7; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-007`, `agent-blocked`, `needs-design`, `gate-issue`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-gate-04.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
