<!-- migration-contract:v2 localId=MIG-702 -->
# MIG-702: Supabase shutdown only after parity+restore proof

## Type

feature

## Intent

Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben.

## Goal

Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben. Zielpfade: docs/ops/cutover/shutdown.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`.
- Source Contracts: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `docs/ops/cutover/shutdown`

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

- Dieses Ticket allein autorisiert keine Datenlöschung. Offene Legacy-Aufrufe, unbekannte Deploy-Zustände und ungeprüfte Backups blockieren die Abschaltung.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: MIG-700, MIG-701 oder Atlas #770 ohne vollständigen Abschlussnachweis
- Wenn: die Abschaltprüfung läuft
- Dann: MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 2

- Gegeben: Alle verifizierten RPC-/Edge-/Infra-Verträge
- Wenn: der produktive Aufrufpfad mit der Matrix abgeglichen wird
- Dann: Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 3

- Gegeben: SQLite-/Asset-Backup und das abgeschlossene Beobachtungsfenster
- Wenn: der Abschalt-Drill bewertet wird
- Dann: Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.
2. Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.
3. Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.
- [ ] Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.
- [ ] Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #849 (MIG-700)
- Depends on #850 (MIG-701)
- Depends on #770 (ATLAS-LIVE-E2E)
- Depends on #848 (MIG-603)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-702`
- Design: `.qa/design/migration-issues/stack-migration-mig-702.md`
- Status: waiting
- Reihenfolge: 89; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-089`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-702.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

