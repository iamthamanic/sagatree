<!-- migration-contract:v2 localId=MIG-308 -->
# MIG-308: Port infrastructure/project adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/project: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/project: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/project/contracts/project.types.ts, src/domains/project/contracts/saga-overview.ts, src/domains/saga/permissions/catalog.ts, src/domains/saga/permissions/index.ts, src/domains/saga/permissions/lore-timeline.ts, src/infrastructure/project/project-member-service.ts, src/infrastructure/project/project-service.ts, src/infrastructure/project/saga-overview-service.ts, src/infrastructure/project/saga-permission-service.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-project.md, .qa/intake/edge-infra-contracts/source-contracts/infra-project.json.

### Nachher und Verhalten

src/infrastructure/project: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/project/contracts/project.types.ts`, `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/catalog.ts`, `src/domains/saga/permissions/index.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/infrastructure/project/project-member-service.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: Create project/session,join by code,assign own eligible character and reload overview.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: Contract fixture for create_project_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

## Acceptance

- [ ] Create project/session,join by code,assign own eligible character and reload overview.
- [ ] All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- [ ] Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
- [ ] Contract fixture for create_project_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #868 (RPC-SESSION-LIFECYCLE)
- Depends on #873 (RPC-SAGA-PROVISION)
- Depends on #875 (RPC-SAGA-GOVERNANCE)
- Depends on #876 (RPC-SAGA-PROJECTIONS)
- Depends on #874 (RPC-PROJECT-MEMBERSHIP)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-308`
- Design: `.qa/design/migration-issues/stack-migration-mig-308.md`
- Status: blocked
- Reihenfolge: 74; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-074`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-308.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
