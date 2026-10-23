<!-- migration-contract:v2 localId=GATE-02 -->
# GATE-02: PoC: Better Auth session model + Colyseus auth handshake

## Type

chore

## Intent

Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen.

## Goal

Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-02, .qa/design/gates/GATE-02-better-auth-colyseus.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`.
- Source Contracts: `.qa/design/gates/GATE-02-better-auth-colyseus.md`, `src/lib/auth-context.tsx`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/pocs/gate-02`
- `.qa/design/gates/GATE-02-better-auth-colyseus.md`

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

- Loopback-Identität darf niemals einen Remote-GM ergeben. Actor, Host, aktive Membership und Widerruf werden serverseitig vor Join, Reconnect und Command geprüft.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Erlaubte Akteure erhalten dieselbe Rolle auf beiden Transporten; fremder Host, fremdes Projekt, abgelaufene Sitzung und manipulierte Rolle werden vor Raumbeitritt abgewiesen.
2. Neue privilegierte Aktionen sind spätestens nach zwei Sekunden gesperrt; Reconnect stellt keine veraltete Berechtigung wieder her.
3. Lokale Solo-Credentials werden nicht als Remote-Anmeldung akzeptiert; gemessene Varianten und offene Browser-/Plattformfälle stehen im ADR, dessen Freigabe menschlich bleibt.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Erlaubte Akteure erhalten dieselbe Rolle auf beiden Transporten; fremder Host, fremdes Projekt, abgelaufene Sitzung und manipulierte Rolle werden vor Raumbeitritt abgewiesen.
- [ ] Neue privilegierte Aktionen sind spätestens nach zwei Sekunden gesperrt; Reconnect stellt keine veraltete Berechtigung wieder her.
- [ ] Lokale Solo-Credentials werden nicht als Remote-Anmeldung akzeptiert; gemessene Varianten und offene Browser-/Plattformfälle stehen im ADR, dessen Freigabe menschlich bleibt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-gate-02`
- Design: `.qa/design/migration-issues/stack-migration-gate-02.md`
- Status: waiting
- Reihenfolge: 5; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-005`, `agent-blocked`, `waiting-dependency`, `gate-issue`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-gate-02.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

