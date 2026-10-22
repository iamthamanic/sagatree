<!-- migration-contract:v2 localId=ATLAS-LIVE-E2E -->
# ATLAS-LIVE-E2E: Mandatory Atlas live E2E on isolated test DB (GitHub #770)

## Type

Task

## Intent

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen.

## Goal

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen. Zielpfade: e2e/atlas-isolated-product.spec.ts, scripts/stack-migration-db, .github/workflows/stack-migration-baseline.yml.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: e2e/atlas-followup-product-e2e-gate.spec.ts, .qa/design/atlas-live-e2e-cutover-gate.md, src/infrastructure/world/world-atlas-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen. Zielpfade: e2e/atlas-isolated-product.spec.ts, scripts/stack-migration-db, .github/workflows/stack-migration-baseline.yml.

## Scope

- Quellpfade: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`
- Änderbare Zielpfade: `e2e/atlas-isolated-product.spec.ts`, `scripts/stack-migration-db`, `.github/workflows/stack-migration-baseline.yml`
- Quellverträge: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

## Security & Data

Die Testinstanz besitzt nur synthetische Daten. SQL-Proben, UI-Mocks und ein sichtbares Element werden nicht als vollständiger persistenter Produktpfad ausgegeben.

## Edge Cases

### Fall 1

- Gegeben: Weltbesitzer O, separater Projekt-GM G, P1/P2 und X auf einer isolierten Datenbank
- Wenn: der Browser Karten erstellt/ändert und Freigaben ausführt
- Dann: Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 2

- Gegeben: Geheime Atlas-Daten und ein fremder oder nicht berechtigter Actor
- Wenn: UI und Backend denselben Objektzugriff versuchen
- Dann: Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 3

- Gegeben: Eine absichtlich aufgeweitete Atlas-Projektionsberechtigung
- Wenn: das verpflichtende CI-Gate läuft
- Dann: Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

## Acceptance

- [ ] Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
- [ ] Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
- [ ] Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-atlas-live-e2e`
- Design: `.qa/design/migration-issues/stack-migration-atlas-live-e2e.md`
- Status: blocked
- Reihenfolge: 2; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-002`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-atlas-live-e2e.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
