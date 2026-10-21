<!-- migration-contract:v2 localId=MIG-020 -->
# MIG-020: HTTP command/query transport layer

## Type

Task

## Intent

Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten.

## Goal

Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten. Zielpfade: server/src/api, server/src/application.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/session/session-runtime-service.ts, src/infrastructure/world/world-atlas-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten. Zielpfade: server/src/api, server/src/application.

## Scope

- Quellpfade: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`
- Änderbare Zielpfade: `server/src/api`, `server/src/application`
- Quellverträge: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

## Security & Data

Der Server validiert Payload und Actor vor Anwendungsmutationen; 401/403/409/422 sind kein Ersatz für eine echte Policy-Prüfung.

## Edge Cases

### Fall 1

- Gegeben: Ein gültiger Actor und ein freigegebenes Command-DTO
- Wenn: der Request den HTTP-Einstieg erreicht
- Dann: Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 2

- Gegeben: Fehlende Anmeldung, fehlendes Recht, veraltete Revision und ungültiger Payload
- Wenn: die vier Requests ausgeführt werden
- Dann: Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 3

- Gegeben: Ein verlorener HTTP-Response nach erfolgreichem Commit
- Wenn: der Client denselben idempotenten Request wiederholt
- Dann: Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

## Acceptance

- [ ] Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.
- [ ] Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.
- [ ] Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #786 (GATE-03)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-020`
- Design: `.qa/design/migration-issues/stack-migration-mig-020.md`
- Status: blocked
- Reihenfolge: 15; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-015`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-020.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
