<!-- migration-contract:v2 localId=MIG-500 -->
# MIG-500: Local protected asset service (replace Storage buckets)

## Type

Task

## Intent

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen.

## Goal

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen. Zielpfade: server/src/assets.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/media, src/infrastructure/media, supabase/migrations. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen. Zielpfade: server/src/assets.

## Scope

- Quellpfade: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`
- Änderbare Zielpfade: `server/src/assets`
- Quellverträge: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

## Security & Data

Weder Dateipfad noch URL ist ein Berechtigungsnachweis; Traversal, Symlinks und fremde Owner-Referenzen werden vor Dateizugriff abgewiesen.

## Edge Cases

### Fall 1

- Gegeben: Ein autorisierter Upload und validierte Dateibytes
- Wenn: validate→publish→metadata commit ausgeführt wird
- Dann: Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

### Fall 2

- Gegeben: X kennt eine fremde Asset-ID oder sendet ../ bzw. einen Symlinkpfad
- Wenn: Download oder Upload versucht wird
- Dann: Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

### Fall 3

- Gegeben: Abbruch nach temporärer Datei und vor Metadaten-Commit
- Wenn: Recovery und Cleanup laufen
- Dann: Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

## Acceptance

- [ ] Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.
- [ ] Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.
- [ ] Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-500`
- Design: `.qa/design/migration-issues/stack-migration-mig-500.md`
- Status: blocked
- Reihenfolge: 14; Welle: 1
- Labels: `P1`, `migration-wave-1-host-auth`, `migration-order-014`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-500.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
