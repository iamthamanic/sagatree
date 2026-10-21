<!-- migration-contract:v2 localId=MIG-702 -->
# MIG-702: Supabase shutdown only after parity+restore proof

## Type

Task

## Intent

Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben.

## Goal

Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben. Zielpfade: docs/ops/cutover/shutdown.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docs/architektur-sqlite-based.md, .qa/design/atlas-live-e2e-cutover-gate.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben. Zielpfade: docs/ops/cutover/shutdown.

## Scope

- Quellpfade: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`
- Änderbare Zielpfade: `docs/ops/cutover/shutdown`
- Quellverträge: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

## Security & Data

Dieses Ticket allein autorisiert keine Datenlöschung. Offene Legacy-Aufrufe, unbekannte Deploy-Zustände und ungeprüfte Backups blockieren die Abschaltung.

## Edge Cases

### Fall 1

- Gegeben: MIG-700, MIG-701 oder Atlas #770 ohne vollständigen Abschlussnachweis
- Wenn: die Abschaltprüfung läuft
- Dann: MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 2

- Gegeben: Alle verifizierten RPC-/Edge-/Infra-Verträge
- Wenn: der produktive Aufrufpfad mit der Matrix abgeglichen wird
- Dann: Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 3

- Gegeben: SQLite-/Asset-Backup und das abgeschlossene Beobachtungsfenster
- Wenn: der Abschalt-Drill bewertet wird
- Dann: Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

## Acceptance

- [ ] MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.
- [ ] Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.
- [ ] Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #849 (MIG-700)
- Depends on #850 (MIG-701)
- Depends on #770 (ATLAS-LIVE-E2E)
- Depends on #848 (MIG-603)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-702`
- Design: `.qa/design/migration-issues/stack-migration-mig-702.md`
- Status: blocked
- Reihenfolge: 89; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-089`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-702.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
