<!-- migration-contract:v2 localId=MIG-022 -->
# MIG-022: SessionRuntimeState port (revision+idempotency)

## Type

Task

## Intent

SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren.

## Goal

SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren. Zielpfade: server/src/application/session, server/src/persistence/session.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/session/session-runtime-service.ts, .qa/design/gates/GATE-04-sqlite-revision-idempotency.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren. Zielpfade: server/src/application/session, server/src/persistence/session.

## Scope

- Quellpfade: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`
- Änderbare Zielpfade: `server/src/application/session`, `server/src/persistence/session`
- Quellverträge: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

## Security & Data

Commands benötigen Session-Membership und operationale Rolle; Actor-/Payload-gebundene Idempotenz verhindert die Wiederverwendung fremder Antworten.

## Edge Cases

### Fall 1

- Gegeben: Zwei zulässige Commands auf derselben expectedRevision
- Wenn: beide gleichzeitig geschrieben werden
- Dann: Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

### Fall 2

- Gegeben: Ein bestätigter Command mit session_id/idempotency_key
- Wenn: Retry, andere Nutzlast und anderer Actor folgen
- Dann: Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

### Fall 3

- Gegeben: Ein Abbruch zwischen State-, Event- und Idempotenz-Schreibschritt
- Wenn: der Host aus WAL neu startet
- Dann: Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

## Acceptance

- [ ] Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.
- [ ] Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.
- [ ] Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #787 (GATE-04)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-022`
- Design: `.qa/design/migration-issues/stack-migration-mig-022.md`
- Status: blocked
- Reihenfolge: 16; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-016`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-022.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
