<!-- migration-contract:v2 localId=MIG-701 -->
# MIG-701: Supabase dual-run parity window

## Type

feature

## Intent

Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben.

## Goal

Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben. Zielpfade: docs/ops/cutover/parity-window, server/src/migration.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`.
- Source Contracts: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `docs/ops/cutover/parity-window`
- `server/src/migration`

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

- Dual-run bedeutet hier Vergleich mit einer ausdrücklich festgelegten Schreibautorität; keine zwei unabhängig schreibenden Systeme für dieselbe Welt/Saga.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein abgeschlossener MIG-700-Drill mit definierter Autorität
- Wenn: der Vergleich während des festgelegten Beobachtungsfensters läuft
- Dann: Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

### Fall 2

- Gegeben: Eine eingefügte Abweichung in Projektionsdaten oder Asset-Hash
- Wenn: der Vergleich erneut läuft
- Dann: Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

### Fall 3

- Gegeben: Ein Fehler über dem im Runbook festgelegten Schwellwert
- Wenn: der Rollback-Entscheidungsweg geprobt wird
- Dann: Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/parity-harness/README.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.
2. Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.
3. Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.
- [ ] Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.
- [ ] Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `docs/ops/cutover/parity-window`, `server/src/migration` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | TBD by dependency successors: MIG-700/#849 |
| **FEATURE VERIFIED** | self / MIG-700/#849 human release |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #849 (MIG-700)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-701`
- Design: `.qa/design/migration-issues/stack-migration-mig-701.md`
- Status: waiting
- Reihenfolge: 88; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-088`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-701.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

