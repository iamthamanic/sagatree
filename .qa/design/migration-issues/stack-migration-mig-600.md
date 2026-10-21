<!-- migration-contract:v2 localId=MIG-600 -->
# MIG-600: Negative authz suite parity on host

## Type

Task

## Intent

Berechtigungsparität und ausdrücklich korrigierte Legacy-Defekte gegen den gesamten Host nachweisen.

## Goal

Berechtigungsparität und ausdrücklich korrigierte Legacy-Defekte gegen den gesamten Host nachweisen. Zielpfade: server/tests/authz, e2e, .github/workflows.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docs/ops/negative-authz-suite.md, .qa/design/parity-harness/README.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Berechtigungsparität und ausdrücklich korrigierte Legacy-Defekte gegen den gesamten Host nachweisen. Zielpfade: server/tests/authz, e2e, .github/workflows.

## Scope

- Quellpfade: `docs/ops/negative-authz-suite.md`, `.qa/design/parity-harness/README.md`
- Änderbare Zielpfade: `server/tests/authz`, `e2e`, `.github/workflows`
- Quellverträge: `docs/ops/negative-authz-suite.md`, `.qa/design/parity-harness/README.md`

## Security & Data

Alle Eintrittswege inklusive Jobs, Assets, HTTP und Realtime werden geprüft; Low/Info-Befunde werden nicht aus dem Bericht entfernt.

## Edge Cases

### Fall 1

- Gegeben: GM, zwei Spieler, Weltbesitzer ohne GM und Fremdbesitzer
- Wenn: die dokumentierte Operationsmatrix gegen echte Persistenz läuft
- Dann: Erlaubte Aktionen und Denials sind pro Operation belegt; geheime Marker fehlen in Spielerantworten, Assets und Realtime-Events.
- Quelle: `docs/ops/negative-authz-suite.md`, `.qa/design/parity-harness/README.md`

### Fall 2

- Gegeben: Ein absichtlich entfernter Membership-/Secret-Check
- Wenn: die negative Canary-Suite im isolierten Lauf ausgeführt wird
- Dann: Das Gate scheitert an einer konkreten unerlaubten Datenoffenlegung oder Mutation und wird erst nach Rücknahme der Regression wieder grün.
- Quelle: `docs/ops/negative-authz-suite.md`, `.qa/design/parity-harness/README.md`

### Fall 3

- Gegeben: Die vollständige Liste aller RPC-, Edge- und Infrastruktur-Nachfolger
- Wenn: die Abdeckung mit dem CI-Bericht abgeglichen wird
- Dann: Jede Zeile besitzt einen ausgeführten Positiv-/Negativfall oder einen offenen Blocker; ungetestete Fälle werden nicht als Parität ausgegeben.
- Quelle: `docs/ops/negative-authz-suite.md`, `.qa/design/parity-harness/README.md`

## Acceptance

- [ ] Erlaubte Aktionen und Denials sind pro Operation belegt; geheime Marker fehlen in Spielerantworten, Assets und Realtime-Events.
- [ ] Das Gate scheitert an einer konkreten unerlaubten Datenoffenlegung oder Mutation und wird erst nach Rücknahme der Regression wieder grün.
- [ ] Jede Zeile besitzt einen ausgeführten Positiv-/Negativfall oder einen offenen Blocker; ungetestete Fälle werden nicht als Parität ausgegeben.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #796 (MIG-021)
- Depends on #798 (MIG-023)
- Depends on #799 (MIG-024)
- Depends on #841 (MIG-500)
- Depends on #816 (MIG-353)
- Depends on #814 (MIG-351)
- Depends on #815 (MIG-352)
- Depends on #813 (MIG-350)
- Depends on #817 (MIG-401)
- Depends on #818 (MIG-402)
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

- Feature slug: `stack-migration-mig-600`
- Design: `.qa/design/migration-issues/stack-migration-mig-600.md`
- Status: blocked
- Reihenfolge: 82; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-082`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-600.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
