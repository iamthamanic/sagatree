<!-- migration-contract:v2 localId=MIG-021 -->
# MIG-021: Realtime session rooms + snapshot/resync

## Type

Task

## Intent

Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen.

## Goal

Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen. Zielpfade: server/src/realtime.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/session/session-runtime-channel.ts, src/infrastructure/session/session-runtime-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen. Zielpfade: server/src/realtime.

## Scope

- Quellpfade: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`
- Änderbare Zielpfade: `server/src/realtime`
- Quellverträge: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

## Security & Data

Membership wird bei Join/Reconnect/Command geprüft; Broadcasts verwenden Empfängerprojektionen und enthalten für Spieler keine GM-only Daten.

## Edge Cases

### Fall 1

- Gegeben: GM und zwei Spieler mit unterschiedlichen letzten Revisionen
- Wenn: die Clients verbinden sich nach Unterbrechung erneut
- Dann: Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 2

- Gegeben: Ein fremder Actor oder inzwischen entfernter Spieler
- Wenn: Join, Reconnect und Raumkommando werden versucht
- Dann: Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 3

- Gegeben: Ein bestätigtes Command und ein sofortiger Host-Neustart
- Wenn: die Clients ihre letzte Revision melden
- Dann: Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

## Acceptance

- [ ] Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
- [ ] Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- [ ] Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #785 (GATE-02)
- Depends on #786 (GATE-03)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-021`
- Design: `.qa/design/migration-issues/stack-migration-mig-021.md`
- Status: blocked
- Reihenfolge: 19; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-019`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-021.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
