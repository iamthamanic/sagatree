<!-- migration-contract:v2 localId=MIG-013 -->
# MIG-013: SagaTree Policy Service core (deny-by-default)

## Type

Task

## Intent

RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen des permissions-Moduls mit deny-by-default abbilden.

## Goal

RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen des permissions-Moduls mit deny-by-default abbilden. Zielpfade: server/src/modules/permissions, server/src/permissions.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations, docs/ops/negative-authz-suite.md, docs/architecture/host-modular-monolith.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen des permissions-Moduls mit deny-by-default abbilden. Zielpfade: server/src/modules/permissions, server/src/permissions.

## Scope

- Quellpfade: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`
- Änderbare Zielpfade: `server/src/modules/permissions`, `server/src/permissions`
- Quellverträge: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

## Security & Data

Identität, Welt-Owner, Projekt-GM und aktive Membership werden unabhängig geprüft. Legacy-Berechtigungsdefekte bekommen eine explizite sichere Abweichung und keinen Paritätsbonus. permissions ist der einzige Policy-Einstieg für Host-Mutationen.

## Edge Cases

### Fall 1

- Gegeben: O besitzt eine Welt, G verwaltet ein Projekt dieser Welt und P1/P2 sind Mitglieder
- Wenn: die Policy-Matrix Weltbearbeitung, Session-GM und Spielerlesen prüft
- Dann: Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: Unbekannte Operation, fehlender Actor, inaktive Membership und fremder Tenant
- Wenn: jeder Fall denselben zentralen Policy-Einstieg aufruft
- Dann: Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: HTTP, WebSocket, Job-Worker und interner Adapter
- Wenn: sie eine geschützte Anwendungsmutation aufrufen
- Dann: Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Ein Domänenmodul oder Use-Case
- Wenn: eine geschützte Mutation ausführt
- Dann: Der Aufruf geht über modules/permissions public API; ORM-/SQL-Bypässe in persistence bleiben zusätzliche High-Findings bis Import-Boundary-CI greift und ersetzen keine Modul-Boundary-Prüfung.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

## Acceptance

- [ ] Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.
- [ ] Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.
- [ ] Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.
- [ ] Der Aufruf geht über modules/permissions public API; ORM-/SQL-Bypässe in persistence bleiben zusätzliche High-Findings bis Import-Boundary-CI greift und ersetzen keine Modul-Boundary-Prüfung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #784 (GATE-01)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-013`
- Design: `.qa/design/migration-issues/stack-migration-mig-013.md`
- Status: blocked
- Reihenfolge: 10; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-010`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-013.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
