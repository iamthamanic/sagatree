<!-- migration-contract:v2 localId=MIG-015 -->
# MIG-015: Solo local identity without privilege transfer

## Type

Task

## Intent

Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln.

## Goal

Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln. Zielpfade: server/src/auth/solo.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/lib/auth-context.tsx, .qa/design/gates/GATE-02-better-auth-colyseus.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln. Zielpfade: server/src/auth/solo.

## Scope

- Quellpfade: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`
- Änderbare Zielpfade: `server/src/auth/solo`
- Quellverträge: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

## Security & Data

Loopback und Remote-Authentifizierung bleiben getrennte Vertrauensbereiche. Ein Konfigurationswechsel gewährt bestehenden Solo-Tokens keine Netzrechte.

## Edge Cases

### Fall 1

- Gegeben: Ein Host ohne Cloud-Zugang auf Loopback
- Wenn: derselbe lokale Datensatz nach Neustart geöffnet wird
- Dann: Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 2

- Gegeben: Ein gültiger Solo-Nachweis
- Wenn: er gegen einen Remote-Listener oder anderen Host gesendet wird
- Dann: Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 3

- Gegeben: Ein Host wechselt von Solo zu Remote-Betrieb
- Wenn: die vorhandenen Konten weiterverwendet werden sollen
- Dann: Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

## Acceptance

- [ ] Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.
- [ ] Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.
- [ ] Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #785 (GATE-02)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-015`
- Design: `.qa/design/migration-issues/stack-migration-mig-015.md`
- Status: blocked
- Reihenfolge: 13; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-013`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-015.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
