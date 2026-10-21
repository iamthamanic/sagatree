<!-- migration-contract:v2 localId=MIG-012 -->
# MIG-012: Repository port pattern + first world read adapter

## Type

Task

## Intent

Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen etablieren.

## Goal

Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen etablieren. Zielpfade: server/src/repositories/world, src/infrastructure/world.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world, src/domains/world. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen etablieren. Zielpfade: server/src/repositories/world, src/infrastructure/world.

## Scope

- Quellpfade: `src/infrastructure/world`, `src/domains/world`
- Änderbare Zielpfade: `server/src/repositories/world`, `src/infrastructure/world`
- Quellverträge: `src/infrastructure/world`, `src/domains/world`

## Security & Data

Ein Repository-Aufruf erhält einen geprüften Actor-Kontext; fehlende Owner-/Projektberechtigung wird vor der Projektion abgewiesen.

## Edge Cases

### Fall 1

- Gegeben: Bestehende Welt-Repository-Aufrufer und der neue Host-Adapter
- Wenn: dieselben autorisierten Weltabfragen ausgeführt werden
- Dann: IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.
- Quelle: `src/infrastructure/world`, `src/domains/world`

### Fall 2

- Gegeben: X kennt die Welt-ID von O
- Wenn: X dieselbe Query über den Host ausführt
- Dann: Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.
- Quelle: `src/infrastructure/world`, `src/domains/world`

### Fall 3

- Gegeben: Persistierte Weltänderung und ein Host-Neustart
- Wenn: der Adapter erneut liest
- Dann: Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.
- Quelle: `src/infrastructure/world`, `src/domains/world`

## Acceptance

- [ ] IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.
- [ ] Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.
- [ ] Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-012`
- Design: `.qa/design/migration-issues/stack-migration-mig-012.md`
- Status: blocked
- Reihenfolge: 11; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-011`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-012.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
