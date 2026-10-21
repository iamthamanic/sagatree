<!-- migration-contract:v2 localId=MIG-700 -->
# MIG-700: Controlled cutover per world/saga with freeze+delta

## Type

Task

## Intent

Welt-/Saga-Cutover erst nach vollständigen Nachweisen mit einer einzigen Schreibautorität vorbereiten.

## Goal

Welt-/Saga-Cutover erst nach vollständigen Nachweisen mit einer einzigen Schreibautorität vorbereiten. Zielpfade: docs/ops/cutover, server/src/migration.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docs/architektur-sqlite-based.md, .qa/design/atlas-live-e2e-cutover-gate.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Welt-/Saga-Cutover erst nach vollständigen Nachweisen mit einer einzigen Schreibautorität vorbereiten. Zielpfade: docs/ops/cutover, server/src/migration.

## Scope

- Quellpfade: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`
- Änderbare Zielpfade: `docs/ops/cutover`, `server/src/migration`
- Quellverträge: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

## Security & Data

Ein Fixture-Drill ist keine Produktivfreigabe. Vor jeder produktiven Umstellung sind Scope, Backup, Schreibsperre und menschliche Freigabe konkret zu verlinken.

## Edge Cases

### Fall 1

- Gegeben: Mindestens ein Vorgänger aus Welle 0–6 oder Atlas #770 ist offen
- Wenn: der Cutover-Runner eine Ausführung erwägt
- Dann: MIG-700 bleibt gesperrt; alle betroffenen Vorgänger sind als konkrete GitHub-Blocker im Ticket und in der maschinenlesbaren Reihenfolge vorhanden.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 2

- Gegeben: Eine synthetische Welt/Saga und ein vollständiger Exportstand
- Wenn: Freeze→Delta→Prüfung→Autoritätswechsel als Drill läuft
- Dann: Während des Wechsels existiert genau eine Schreibautorität; IDs, Revisionen, Geheimnisse und Asset-Hashes sind vor und nach dem Wechsel vergleichbar.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

### Fall 3

- Gegeben: Ein absichtlich fehlerhafter Zielstand im Drill
- Wenn: Rollback ausgeführt wird
- Dann: Der dokumentierte Rückweg stellt den letzten bestätigten Stand samt Assets wieder her; produktive Schritte bleiben bis zur gesonderten menschlichen Freigabe gesperrt.
- Quelle: `docs/architektur-sqlite-based.md`, `.qa/design/atlas-live-e2e-cutover-gate.md`

## Acceptance

- [ ] MIG-700 bleibt gesperrt; alle betroffenen Vorgänger sind als konkrete GitHub-Blocker im Ticket und in der maschinenlesbaren Reihenfolge vorhanden.
- [ ] Während des Wechsels existiert genau eine Schreibautorität; IDs, Revisionen, Geheimnisse und Asset-Hashes sind vor und nach dem Wechsel vergleichbar.
- [ ] Der dokumentierte Rückweg stellt den letzten bestätigten Stand samt Assets wieder her; produktive Schritte bleiben bis zur gesonderten menschlichen Freigabe gesperrt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #770 (ATLAS-LIVE-E2E)
- Depends on #783 (MIG-002)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #786 (GATE-03)
- Depends on #787 (GATE-04)
- Depends on #789 (MIG-010)
- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #791 (MIG-012)
- Depends on #793 (MIG-014)
- Depends on #794 (MIG-015)
- Depends on #841 (MIG-500)
- Depends on #795 (MIG-020)
- Depends on #797 (MIG-022)
- Depends on #798 (MIG-023)
- Depends on #799 (MIG-024)
- Depends on #796 (MIG-021)
- Depends on #844 (MIG-503)
- Depends on #816 (MIG-353)
- Depends on #814 (MIG-351)
- Depends on #815 (MIG-352)
- Depends on #813 (MIG-350)
- Depends on #818 (MIG-402)
- Depends on #817 (MIG-401)
- Depends on #819 (MIG-403)
- Depends on #820 (MIG-404)
- Depends on #821 (MIG-405)
- Depends on #822 (MIG-406)
- Depends on #823 (MIG-407)
- Depends on #824 (MIG-408)
- Depends on #825 (MIG-409)
- Depends on #826 (MIG-410)
- Depends on #827 (MIG-411)
- Depends on #828 (MIG-412)
- Depends on #829 (MIG-413)
- Depends on #831 (MIG-415)
- Depends on #832 (MIG-416)
- Depends on #833 (MIG-417)
- Depends on #834 (MIG-418)
- Depends on #835 (MIG-419)
- Depends on #836 (MIG-420)
- Depends on #837 (MIG-421)
- Depends on #830 (MIG-414)
- Depends on #838 (MIG-422)
- Depends on #839 (MIG-423)
- Depends on #840 (MIG-424)
- Depends on #800 (MIG-301)
- Depends on #801 (MIG-302)
- Depends on #802 (MIG-303)
- Depends on #803 (MIG-304)
- Depends on #804 (MIG-305)
- Depends on #805 (MIG-306)
- Depends on #806 (MIG-307)
- Depends on #807 (MIG-308)
- Depends on #808 (MIG-309)
- Depends on #809 (MIG-310)
- Depends on #810 (MIG-311)
- Depends on #811 (MIG-312)
- Depends on #812 (MIG-313)
- Depends on #842 (MIG-501)
- Depends on #843 (MIG-502)
- Depends on #845 (MIG-600)
- Depends on #846 (MIG-601)
- Depends on #847 (MIG-602)
- Depends on #848 (MIG-603)
- Depends on #861 (RPC-WORLD-MAP)
- Depends on #862 (RPC-ATLAS-MAPS)
- Depends on #863 (RPC-WORLD-PLACES)
- Depends on #864 (RPC-WORLD-CREATE)
- Depends on #865 (RPC-WORLD-RESTRUCTURE)
- Depends on #866 (RPC-WORLD-DESTRUCTIVE)
- Depends on #867 (RPC-SESSION-RUNTIME)
- Depends on #868 (RPC-SESSION-LIFECYCLE)
- Depends on #869 (RPC-SESSION-ACCESS)
- Depends on #870 (RPC-SESSION-RECAP)
- Depends on #871 (RPC-SAGA-AUTHORING)
- Depends on #872 (RPC-SAGA-VERSION-READ)
- Depends on #873 (RPC-SAGA-PROVISION)
- Depends on #874 (RPC-PROJECT-MEMBERSHIP)
- Depends on #875 (RPC-SAGA-GOVERNANCE)
- Depends on #876 (RPC-SAGA-PROJECTIONS)
- Depends on #877 (RPC-NPC-INSTANCES)
- Depends on #878 (RPC-MARKETPLACE-COUNT)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-700`
- Design: `.qa/design/migration-issues/stack-migration-mig-700.md`
- Status: blocked
- Reihenfolge: 87; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-087`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-700.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
