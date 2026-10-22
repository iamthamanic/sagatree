<!-- migration-contract:v2 localId=MIG-502 -->
# MIG-502: Export/import versioned bundles + restore drills

## Type

Task

## Intent

Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen.

## Goal

Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen. Zielpfade: server/src/migration/bundles.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/export, src/infrastructure/world, src/infrastructure/saga. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen. Zielpfade: server/src/migration/bundles.

## Scope

- Quellpfade: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`
- Änderbare Zielpfade: `server/src/migration/bundles`
- Quellverträge: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

## Security & Data

Importpfade, Owner-Zuordnung und Referenzen werden validiert; ein fremdes Bundle darf keine existierenden fremden Daten überschreiben.

## Edge Cases

### Fall 1

- Gegeben: Ein Bundle mit Karten, NPCs, Inventar, IDs und Asset-Manifest
- Wenn: Export→Import in einen leeren Fixture-Host läuft
- Dann: Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

### Fall 2

- Gegeben: Unbekannte kritische Version, Path-Traversal oder falsche Prüfsumme
- Wenn: das Bundle importiert wird
- Dann: Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

### Fall 3

- Gegeben: Ein fertig exportierter SQLite-/Asset-Stand
- Wenn: der dokumentierte Restore auf einem neuen Host ausgeführt wird
- Dann: Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

## Acceptance

- [ ] Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.
- [ ] Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.
- [ ] Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #841 (MIG-500)
- Depends on #844 (MIG-503)
- Depends on #795 (MIG-020)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-502`
- Design: `.qa/design/migration-issues/stack-migration-mig-502.md`
- Status: blocked
- Reihenfolge: 81; Welle: 5
- Labels: `P1`, `migration-wave-5-storage-export`, `migration-order-081`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-502.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
