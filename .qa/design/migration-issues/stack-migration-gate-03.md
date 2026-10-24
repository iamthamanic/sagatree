<!-- migration-contract:v2 localId=GATE-03 -->
# GATE-03: PoC: Colyseus HTTP routes vs separate Hono API layer

## Type

chore

## Intent

Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen.

## Goal

Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-03, .qa/design/gates/GATE-03-colyseus-http-vs-hono.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`.
- Source Contracts: `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`, `src/infrastructure/session/session-runtime-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/pocs/gate-03`
- `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- HTTP und WebSocket verwenden denselben Policy-Einstieg. Kein Transport darf Rollen aus einem ungeprüften Request übernehmen oder GM-Daten an Spieler senden.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Beide Transporte liefern dieselbe erlaubte Zustandsänderung und dieselben Denials; ein absichtliches HTTP-500 beendet keine bestehende Raumverbindung.
2. Der Bericht enthält p50/p95/p99, Fehlerrate und beobachtete Prozess-/Socket-Ausfälle je Variante; kein Messwert wird aus Unit-Mocks abgeleitet.
3. Der ADR hält Kosten und offene Messkriterien fest; ohne menschliche Entscheidung bleibt sowohl die Hono- als auch die Colyseus-only-Produkteinführung gesperrt.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Beide Transporte liefern dieselbe erlaubte Zustandsänderung und dieselben Denials; ein absichtliches HTTP-500 beendet keine bestehende Raumverbindung.
- [ ] Der Bericht enthält p50/p95/p99, Fehlerrate und beobachtete Prozess-/Socket-Ausfälle je Variante; kein Messwert wird aus Unit-Mocks abgeleitet.
- [ ] Der ADR hält Kosten und offene Messkriterien fest; ohne menschliche Entscheidung bleibt sowohl die Hono- als auch die Colyseus-only-Produkteinführung gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `.qa/evidence/stack-migration-prep/pocs/gate-03`, `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-020/021 Hono+Colyseus product rooms |
| **FEATURE VERIFIED** | PoC evidence + owner decision register |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-gate-03`
- Design: `.qa/design/migration-issues/stack-migration-gate-03.md`
- Status: done
- Reihenfolge: 6; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-006`, `agent-done`, `gate-issue`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-gate-03.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

