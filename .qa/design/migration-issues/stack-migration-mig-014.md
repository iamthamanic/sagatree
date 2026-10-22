<!-- migration-contract:v2 localId=MIG-014 -->
# MIG-014: Better Auth host accounts (remote-reachable mode)

## Type

Task

## Intent

Freigegebene Better-Auth-Konten und Sitzungen für erreichbare Hosts integrieren.

## Goal

Freigegebene Better-Auth-Konten und Sitzungen für erreichbare Hosts integrieren. Zielpfade: server/src/auth, src/lib/auth-context.tsx.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/lib/auth-context.tsx, .qa/design/gates/GATE-02-better-auth-colyseus.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Freigegebene Better-Auth-Konten und Sitzungen für erreichbare Hosts integrieren. Zielpfade: server/src/auth, src/lib/auth-context.tsx.

## Scope

- Quellpfade: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`
- Änderbare Zielpfade: `server/src/auth`, `src/lib/auth-context.tsx`
- Quellverträge: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

## Security & Data

Authentifizierung liefert einen Actor, keine vom Client gewählte GM-Rolle. Host-Bindung, Ablauf, Logout und serverseitiger Widerruf gelten auch für Realtime.

## Edge Cases

### Fall 1

- Gegeben: Ein registrierter Remote-Account mit gültiger Host-Sitzung
- Wenn: Login, Seiten-Reload und WebSocket-Handshake stattfinden
- Dann: Derselbe Actor wird wiederhergestellt; geheime Sitzungsdaten stehen weder im DTO noch in Serverlogs.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 2

- Gegeben: Abgelaufene, widerrufene oder für einen anderen Host ausgestellte Sitzung
- Wenn: HTTP oder Reconnect sie verwendet
- Dann: Beide Transporte weisen den Zugriff ab und mutieren keine Projektdaten.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 3

- Gegeben: Ein angemeldeter Spieler
- Wenn: er Rollen-/Owner-Felder im Request manipuliert
- Dann: Die gespeicherte Membership bestimmt weiter seine Rechte; manipulierte Felder erzeugen keinen GM- oder Owner-Actor.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

## Acceptance

- [ ] Derselbe Actor wird wiederhergestellt; geheime Sitzungsdaten stehen weder im DTO noch in Serverlogs.
- [ ] Beide Transporte weisen den Zugriff ab und mutieren keine Projektdaten.
- [ ] Die gespeicherte Membership bestimmt weiter seine Rechte; manipulierte Felder erzeugen keinen GM- oder Owner-Actor.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #785 (GATE-02)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-014`
- Design: `.qa/design/migration-issues/stack-migration-mig-014.md`
- Status: blocked
- Reihenfolge: 12; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-012`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-014.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
