<!-- migration-contract:v2 localId=GATE-01 -->
# GATE-01: PoC: Drizzle+PolicyService vs ZenStack 3 for SQLite authz

## Type

chore

## Intent

Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten.

## Goal

Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-01, .qa/design/gates/GATE-01-drizzle-vs-zenstack.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`.
- Source Contracts: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/pocs/gate-01`
- `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`

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

- Welteigentum und Projekt-GM sind verschiedene Rollen. Ein GM erhält durch seine Sitzung keine Welt-Editierrechte; ein Weltbesitzer verliert diese nicht, wenn er kein GM ist.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: O besitzt W1, G ist nur GM des Projekts zu W1, P1/P2 sind aktive Spieler
- Wenn: beide ORM-Kandidaten führen die identische Suite aus
- Dann: O darf updateMapTitle ausführen, G/P1/P2/X nicht; G darf die GM-Sitzungsoperation ausführen, O ohne GM-Rolle nicht; versteckte Karten fehlen in Spielerprojektionen.
- Quelle: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`

### Fall 2

- Gegeben: Ein autorisierter O und eine veraltete expectedRevision
- Wenn: O ändert denselben Kartentitel erneut
- Dann: Die Mutation liefert einen Konflikt ohne Revisionserhöhung; ein unautorisierter Actor erhält einen Berechtigungsfehler und keinen Konflikt als Existenzsignal.
- Quelle: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`

### Fall 3

- Gegeben: Reproduzierbare Kandidaten-Ergebnisse und verbleibende Plattform-/Migrationstests
- Wenn: das Entscheidungsprotokoll wird erstellt
- Dann: Die Tabelle nennt PASS/FAIL/NOT RUN je Kriterium und Version; abhängige Issues bleiben bis zur verlinkten menschlichen APPROVED-Entscheidung gesperrt.
- Quelle: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. O darf updateMapTitle ausführen, G/P1/P2/X nicht; G darf die GM-Sitzungsoperation ausführen, O ohne GM-Rolle nicht; versteckte Karten fehlen in Spielerprojektionen.
2. Die Mutation liefert einen Konflikt ohne Revisionserhöhung; ein unautorisierter Actor erhält einen Berechtigungsfehler und keinen Konflikt als Existenzsignal.
3. Die Tabelle nennt PASS/FAIL/NOT RUN je Kriterium und Version; abhängige Issues bleiben bis zur verlinkten menschlichen APPROVED-Entscheidung gesperrt.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] O darf updateMapTitle ausführen, G/P1/P2/X nicht; G darf die GM-Sitzungsoperation ausführen, O ohne GM-Rolle nicht; versteckte Karten fehlen in Spielerprojektionen.
- [ ] Die Mutation liefert einen Konflikt ohne Revisionserhöhung; ein unautorisierter Actor erhält einen Berechtigungsfehler und keinen Konflikt als Existenzsignal.
- [ ] Die Tabelle nennt PASS/FAIL/NOT RUN je Kriterium und Version; abhängige Issues bleiben bis zur verlinkten menschlichen APPROVED-Entscheidung gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-gate-01`
- Design: `.qa/design/migration-issues/stack-migration-gate-01.md`
- Status: done
- Reihenfolge: 4; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-004`, `agent-done`, `gate-issue`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-gate-01.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

