<!-- migration-contract:v2 localId=MIG-310 -->
# MIG-310: Port infrastructure/saga adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/saga: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/saga: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/saga/contracts/saga-definition.ts, src/domains/session/contracts/session-outcome-promotion.ts, src/infrastructure/saga/saga-definition-service.ts, src/infrastructure/saga/session-outcome-promotion-service.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-saga.md, .qa/intake/edge-infra-contracts/source-contracts/infra-saga.json.

### Nachher und Verhalten

src/infrastructure/saga: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/saga/contracts/saga-definition.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for copy_native_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

## Acceptance

- [ ] Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
- [ ] Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
- [ ] All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.
- [ ] Contract fixture for copy_native_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #871 (RPC-SAGA-AUTHORING)
- Depends on #873 (RPC-SAGA-PROVISION)
- Depends on #872 (RPC-SAGA-VERSION-READ)
- Depends on #876 (RPC-SAGA-PROJECTIONS)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-310`
- Design: `.qa/design/migration-issues/stack-migration-mig-310.md`
- Status: blocked
- Reihenfolge: 76; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-076`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-310.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
