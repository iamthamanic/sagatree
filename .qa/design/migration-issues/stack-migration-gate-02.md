<!-- migration-contract:v2 localId=GATE-02 -->
# GATE-02: PoC: Better Auth session model + Colyseus auth handshake

## Type

Task

## Intent

Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen.

## Goal

Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-02, .qa/design/gates/GATE-02-better-auth-colyseus.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-02-better-auth-colyseus.md, src/lib/auth-context.tsx. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-02, .qa/design/gates/GATE-02-better-auth-colyseus.md.

## Scope

- Quellpfade: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/pocs/gate-02`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`
- Quellverträge: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`

## Security & Data

Loopback-Identität darf niemals einen Remote-GM ergeben. Actor, Host, aktive Membership und Widerruf werden serverseitig vor Join, Reconnect und Command geprüft.

## Edge Cases

### Fall 1

- Gegeben: G, P1, P2 und X mit getrennten Host-Sitzungen
- Wenn: Cookie- und Bearer-Kandidaten verbinden sich per HTTP und WebSocket
- Dann: Erlaubte Akteure erhalten dieselbe Rolle auf beiden Transporten; fremder Host, fremdes Projekt, abgelaufene Sitzung und manipulierte Rolle werden vor Raumbeitritt abgewiesen.
- Quelle: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`

### Fall 2

- Gegeben: P1 ist verbunden und seine Membership oder Sitzung wird widerrufen
- Wenn: P1 sendet erneut und versucht Reconnect
- Dann: Neue privilegierte Aktionen sind spätestens nach zwei Sekunden gesperrt; Reconnect stellt keine veraltete Berechtigung wieder her.
- Quelle: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`

### Fall 3

- Gegeben: Solo-Modus und ein später erreichbarer Remote-Listener
- Wenn: der Host wechselt seinen Modus
- Dann: Lokale Solo-Credentials werden nicht als Remote-Anmeldung akzeptiert; gemessene Varianten und offene Browser-/Plattformfälle stehen im ADR, dessen Freigabe menschlich bleibt.
- Quelle: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`

## Acceptance

- [ ] Erlaubte Akteure erhalten dieselbe Rolle auf beiden Transporten; fremder Host, fremdes Projekt, abgelaufene Sitzung und manipulierte Rolle werden vor Raumbeitritt abgewiesen.
- [ ] Neue privilegierte Aktionen sind spätestens nach zwei Sekunden gesperrt; Reconnect stellt keine veraltete Berechtigung wieder her.
- [ ] Lokale Solo-Credentials werden nicht als Remote-Anmeldung akzeptiert; gemessene Varianten und offene Browser-/Plattformfälle stehen im ADR, dessen Freigabe menschlich bleibt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **needs-design**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-gate-02`
- Design: `.qa/design/migration-issues/stack-migration-gate-02.md`
- Status: needs-design
- Reihenfolge: 5; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-005`, `agent-blocked`, `needs-design`, `gate-issue`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-gate-02.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
