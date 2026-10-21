<!-- migration-contract:v2 localId=GATE-05 -->
# GATE-05: Desktop packaging PoC (Tauri+sidecar vs Electron) — deferred until browser host parity

## Type

Task

## Intent

Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen.

## Goal

Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-05, .qa/design/gates/GATE-05-tauri-packaging.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .qa/design/gates/GATE-05-tauri-packaging.md, docs/architektur-sqlite-based.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-05, .qa/design/gates/GATE-05-tauri-packaging.md.

## Scope

- Quellpfade: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`
- Änderbare Zielpfade: `.qa/evidence/stack-migration-prep/pocs/gate-05`, `.qa/design/gates/GATE-05-tauri-packaging.md`
- Quellverträge: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Security & Data

Sidecar-Zugriff ist auf die angemeldete lokale Instanz beschränkt; Desktop-Verpackung erweitert weder Netzreichweite noch produktive Datenrechte.

## Edge Cases

### Fall 1

- Gegeben: MIG-602 oder MIG-603 ist noch offen
- Wenn: der Runner die Desktop-PoC starten möchte
- Dann: Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Browser-Host-CI und Restore-Drill sind abgeschlossen
- Wenn: Tauri+Sidecar und Electron werden auf Linux/macOS/Windows geprüft
- Dann: Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein offenes Verpackungs-ADR
- Wenn: ein Kandidat einzelne Smoke-Tests besteht
- Dann: Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Acceptance

- [ ] Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.
- [ ] Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.
- [ ] Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #847 (MIG-602)
- Depends on #848 (MIG-603)

Status: **needs-design**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-gate-05`
- Design: `.qa/design/migration-issues/stack-migration-gate-05.md`
- Status: needs-design
- Reihenfolge: 86; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-086`, `agent-blocked`, `needs-design`, `gate-issue`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-gate-05.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
