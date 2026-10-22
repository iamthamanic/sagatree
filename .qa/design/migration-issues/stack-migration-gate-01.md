<!-- migration-contract:v2 localId=GATE-01 -->
# GATE-01: PoC: Drizzle+PolicyService vs ZenStack 3 for SQLite authz

## Type

Task

## Intent

Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten.

## Goal

Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-01, .qa/design/gates/GATE-01-drizzle-vs-zenstack.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-01-drizzle-vs-zenstack.md, supabase/migrations/015_inventory_item_definitions.sql. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-01, .qa/design/gates/GATE-01-drizzle-vs-zenstack.md.

## Scope

- Quellpfade: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/pocs/gate-01`, `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`
- Quellverträge: `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`, `supabase/migrations/015_inventory_item_definitions.sql`

## Security & Data

Welteigentum und Projekt-GM sind verschiedene Rollen. Ein GM erhält durch seine Sitzung keine Welt-Editierrechte; ein Weltbesitzer verliert diese nicht, wenn er kein GM ist.

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

## Acceptance

- [ ] O darf updateMapTitle ausführen, G/P1/P2/X nicht; G darf die GM-Sitzungsoperation ausführen, O ohne GM-Rolle nicht; versteckte Karten fehlen in Spielerprojektionen.
- [ ] Die Mutation liefert einen Konflikt ohne Revisionserhöhung; ein unautorisierter Actor erhält einen Berechtigungsfehler und keinen Konflikt als Existenzsignal.
- [ ] Die Tabelle nennt PASS/FAIL/NOT RUN je Kriterium und Version; abhängige Issues bleiben bis zur verlinkten menschlichen APPROVED-Entscheidung gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **needs-design**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-gate-01`
- Design: `.qa/design/migration-issues/stack-migration-gate-01.md`
- Status: needs-design
- Reihenfolge: 4; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-004`, `agent-blocked`, `needs-design`, `gate-issue`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-gate-01.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
