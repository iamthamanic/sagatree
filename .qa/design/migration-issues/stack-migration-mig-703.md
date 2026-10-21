<!-- migration-contract:v2 localId=MIG-703 -->
# MIG-703: Tauri integration before external desktop test phase

## Type

Task

## Intent

Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren.

## Goal

Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren. Zielpfade: desktop, docs/ops/desktop.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-05-tauri-packaging.md, docs/architektur-sqlite-based.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren. Zielpfade: desktop, docs/ops/desktop.

## Scope

- Quellpfade: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`
- Änderbare Zielpfade: `desktop`, `docs/ops/desktop`
- Quellverträge: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Security & Data

Desktop-Bridge und Sidecar erlauben nur freigegebene Operationen; Localhost-Port und Dateizugriff verleihen Web-Inhalten keine pauschalen Host-Rechte.

## Edge Cases

### Fall 1

- Gegeben: GATE-05 ohne menschliches APPROVED oder unvollständige Browser-Host-CI
- Wenn: Desktop-Implementierung gestartet werden soll
- Dann: MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Die freigegebene Verpackung auf Linux/macOS/Windows
- Wenn: Start, Stop, erneuter Start und Sidecar-Ausfall geprüft werden
- Dann: Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein fremder Web-Origin oder manipulierte Bridge-Nachricht
- Wenn: Datei-/Netzwerkprivilegien angefordert werden
- Dann: Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Acceptance

- [ ] MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
- [ ] Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
- [ ] Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #788 (GATE-05)
- Depends on #847 (MIG-602)
- Depends on #848 (MIG-603)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-703`
- Design: `.qa/design/migration-issues/stack-migration-mig-703.md`
- Status: blocked
- Reihenfolge: 90; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-090`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-703.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
