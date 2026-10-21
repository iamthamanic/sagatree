<!-- migration-contract:v2 localId=MIG-602 -->
# MIG-602: CI Quality Gates for host unit/integration/e2e

## Type

Task

## Intent

Host-Unit-, echte DB-/Transport-Integration und Browser-Produktpfade als verlässliche CI-Gates anschließen.

## Goal

Host-Unit-, echte DB-/Transport-Integration und Browser-Produktpfade als verlässliche CI-Gates anschließen. Zielpfade: .github/workflows, server/tests, e2e.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: .github/workflows/verify.yml, playwright.config.ts, .qa/design/parity-harness/README.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Host-Unit-, echte DB-/Transport-Integration und Browser-Produktpfade als verlässliche CI-Gates anschließen. Zielpfade: .github/workflows, server/tests, e2e.

## Scope

- Quellpfade: `.github/workflows/verify.yml`, `playwright.config.ts`, `.qa/design/parity-harness/README.md`
- Änderbare Zielpfade: `.github/workflows`, `server/tests`, `e2e`
- Quellverträge: `.github/workflows/verify.yml`, `playwright.config.ts`, `.qa/design/parity-harness/README.md`

## Security & Data

CI erzeugt isolierte synthetische Identitäten; fehlende Testinfrastruktur darf kein stiller Skip und kein Zugriff auf eine Produktivinstanz werden.

## Edge Cases

### Fall 1

- Gegeben: Ein Pull Request ohne externe Datenbank-Secrets
- Wenn: die erforderlichen CI-Jobs laufen
- Dann: Die Jobs starten ihre isolierte Datenbank selbst und führen den GM→Player-Atlas-Pfad samt DB-Assertions aus; fehlender Dienst lässt den Job rot werden.
- Quelle: `.github/workflows/verify.yml`, `playwright.config.ts`, `.qa/design/parity-harness/README.md`

### Fall 2

- Gegeben: Eine echte Permission-Regression im Fixture-System
- Wenn: die Canary-Probe ausgelöst wird
- Dann: Mindestens ein erforderlicher Check wird rot; test.skip, continue-on-error und rein gemockte Ersatzantworten erfüllen dieses Kriterium nicht.
- Quelle: `.github/workflows/verify.yml`, `playwright.config.ts`, `.qa/design/parity-harness/README.md`

### Fall 3

- Gegeben: Ein CI-Lauf auf einem konkreten Commit
- Wenn: die Ergebnisse archiviert werden
- Dann: Logs, Testanzahlen und Revision sind diesem Commit zugeordnet; Browser-, DB- und Vertragsprüfung bleiben als unterschiedliche Nachweise erkennbar.
- Quelle: `.github/workflows/verify.yml`, `playwright.config.ts`, `.qa/design/parity-harness/README.md`

## Acceptance

- [ ] Die Jobs starten ihre isolierte Datenbank selbst und führen den GM→Player-Atlas-Pfad samt DB-Assertions aus; fehlender Dienst lässt den Job rot werden.
- [ ] Mindestens ein erforderlicher Check wird rot; test.skip, continue-on-error und rein gemockte Ersatzantworten erfüllen dieses Kriterium nicht.
- [ ] Logs, Testanzahlen und Revision sind diesem Commit zugeordnet; Browser-, DB- und Vertragsprüfung bleiben als unterschiedliche Nachweise erkennbar.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #845 (MIG-600)
- Depends on #846 (MIG-601)
- Depends on #770 (ATLAS-LIVE-E2E)
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

- Feature slug: `stack-migration-mig-602`
- Design: `.qa/design/migration-issues/stack-migration-mig-602.md`
- Status: blocked
- Reihenfolge: 84; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-084`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-602.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
