<!-- migration-contract:v2 localId=GATE-03 -->
# GATE-03: PoC: Colyseus HTTP routes vs separate Hono API layer

## Type

Task

## Intent

Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen.

## Goal

Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-03, .qa/design/gates/GATE-03-colyseus-http-vs-hono.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-03-colyseus-http-vs-hono.md, src/infrastructure/session/session-runtime-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-03, .qa/design/gates/GATE-03-colyseus-http-vs-hono.md.

## Scope

- Quellpfade: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/pocs/gate-03`, `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`
- Quellverträge: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`

## Security & Data

HTTP und WebSocket verwenden denselben Policy-Einstieg. Kein Transport darf Rollen aus einem ungeprüften Request übernehmen oder GM-Daten an Spieler senden.

## Edge Cases

### Fall 1

- Gegeben: Identische Commands für GM, Spieler und Fremdbesitzer
- Wenn: jeder Kandidat führt sie über HTTP und WebSocket aus
- Dann: Beide Transporte liefern dieselbe erlaubte Zustandsänderung und dieselben Denials; ein absichtliches HTTP-500 beendet keine bestehende Raumverbindung.
- Quelle: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 2

- Gegeben: 200 konkurrierende Reconnects während HTTP-Commands
- Wenn: die reproduzierbare Lastprobe läuft
- Dann: Der Bericht enthält p50/p95/p99, Fehlerrate und beobachtete Prozess-/Socket-Ausfälle je Variante; kein Messwert wird aus Unit-Mocks abgeleitet.
- Quelle: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 3

- Gegeben: Gemessene Routing-, Middleware- und Betriebsunterschiede
- Wenn: die Varianten werden beurteilt
- Dann: Der ADR hält Kosten und offene Messkriterien fest; ohne menschliche Entscheidung bleibt sowohl die Hono- als auch die Colyseus-only-Produkteinführung gesperrt.
- Quelle: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`

## Acceptance

- [ ] Beide Transporte liefern dieselbe erlaubte Zustandsänderung und dieselben Denials; ein absichtliches HTTP-500 beendet keine bestehende Raumverbindung.
- [ ] Der Bericht enthält p50/p95/p99, Fehlerrate und beobachtete Prozess-/Socket-Ausfälle je Variante; kein Messwert wird aus Unit-Mocks abgeleitet.
- [ ] Der ADR hält Kosten und offene Messkriterien fest; ohne menschliche Entscheidung bleibt sowohl die Hono- als auch die Colyseus-only-Produkteinführung gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **needs-design**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-gate-03`
- Design: `.qa/design/migration-issues/stack-migration-gate-03.md`
- Status: needs-design
- Reihenfolge: 6; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-006`, `agent-blocked`, `needs-design`, `gate-issue`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-gate-03.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
