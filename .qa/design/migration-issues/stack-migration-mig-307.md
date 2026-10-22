<!-- migration-contract:v2 localId=MIG-307 -->
# MIG-307: Port infrastructure/npc-creature adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/npc-creature: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/npc-creature: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/character/avatar/face-anchor-contract.ts, src/domains/character/avatar/morph-contract.ts, src/domains/character/domain/character.entity.ts, src/domains/npc-creature/contracts.ts, src/domains/npc-creature/controller-assignment.ts, src/domains/npc-creature/core-catalog.ts, src/domains/npc-creature/definition.ts, src/domains/npc-creature/derived.ts, src/domains/npc-creature/icon-assets.ts, src/domains/npc-creature/index.ts, src/domains/npc-creature/instance.ts, src/domains/npc-creature/library-query.ts, src/domains/npc-creature/pack.ts, src/domains/npc-creature/packs/animals.ts, src/domains/npc-creature/packs/build-builtin.ts, src/domains/npc-creature/packs/context-packs.ts, src/domains/npc-creature/packs/fantasy-basics.ts, src/domains/npc-creature/packs/index.ts, src/domains/npc-creature/parse.ts, src/domains/npc-creature/payload.ts, src/domains/npc-creature/policy.ts, src/domains/npc-creature/promotion.ts, src/domains/npc-creature/taxonomy.ts, src/domains/npc-creature/validate.ts, src/domains/npc-creature/world-catalog.ts, src/domains/rules/sagatree/attribute-progression/index.ts, src/domains/rules/sagatree/character-creation/index.ts, src/domains/rules/sagatree/npc-creature-power/benchmarks.ts, src/domains/rules/sagatree/npc-creature-power/combat-roles.ts, src/domains/rules/sagatree/npc-creature-power/compute.ts, src/domains/rules/sagatree/npc-creature-power/damage-steps.ts, src/domains/rules/sagatree/npc-creature-power/index.ts, src/domains/rules/sagatree/npc-creature-power/machtgrad.ts, src/domains/rules/sagatree/npc-creature-power/profiles.ts, src/domains/rules/sagatree/npc-creature-power/types.ts, src/infrastructure/npc-creature/npc-creature-controller.persistence.ts, src/infrastructure/npc-creature/npc-creature-instance.persistence.ts, src/infrastructure/npc-creature/npc-creature-service.ts, src/infrastructure/npc-creature/npc-creature.persistence.ts, src/infrastructure/npc-creature/supabase-npc-creature.repository.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-npc-creature.md, .qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json.

### Nachher und Verhalten

src/infrastructure/npc-creature: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts`, `src/domains/npc-creature/contracts.ts`, `src/domains/npc-creature/controller-assignment.ts`, `src/domains/npc-creature/core-catalog.ts`, `src/domains/npc-creature/definition.ts`, `src/domains/npc-creature/derived.ts`, `src/domains/npc-creature/icon-assets.ts`, `src/domains/npc-creature/index.ts`, `src/domains/npc-creature/instance.ts`, `src/domains/npc-creature/library-query.ts`, `src/domains/npc-creature/pack.ts`, `src/domains/npc-creature/packs/animals.ts`, `src/domains/npc-creature/packs/build-builtin.ts`, `src/domains/npc-creature/packs/context-packs.ts`, `src/domains/npc-creature/packs/fantasy-basics.ts`, `src/domains/npc-creature/packs/index.ts`, `src/domains/npc-creature/parse.ts`, `src/domains/npc-creature/payload.ts`, `src/domains/npc-creature/policy.ts`, `src/domains/npc-creature/promotion.ts`, `src/domains/npc-creature/taxonomy.ts`, `src/domains/npc-creature/validate.ts`, `src/domains/npc-creature/world-catalog.ts`, `src/domains/rules/sagatree/attribute-progression/index.ts`, `src/domains/rules/sagatree/character-creation/index.ts`, `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts`, `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts`, `src/domains/rules/sagatree/npc-creature-power/compute.ts`, `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts`, `src/domains/rules/sagatree/npc-creature-power/index.ts`, `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts`, `src/domains/rules/sagatree/npc-creature-power/profiles.ts`, `src/domains/rules/sagatree/npc-creature-power/types.ts`, `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Create/read/update allowed definitions; spawn/update/remove session instance through documented RPC and reload.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Assign/revoke controller and clear only session-scoped temporary controllers; wrong owner/player mutation denied.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for assign_npc_creature_controller: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for clear_npc_creature_instance_temp_controllers_for_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for remove_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for spawn_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for update_npc_creature_instance_runtime: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

## Acceptance

- [ ] Create/read/update allowed definitions; spawn/update/remove session instance through documented RPC and reload.
- [ ] Assign/revoke controller and clear only session-scoped temporary controllers; wrong owner/player mutation denied.
- [ ] Contract fixture for assign_npc_creature_controller: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for clear_npc_creature_instance_temp_controllers_for_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for remove_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for spawn_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for update_npc_creature_instance_runtime: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #877 (RPC-NPC-INSTANCES)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-307`
- Design: `.qa/design/migration-issues/stack-migration-mig-307.md`
- Status: blocked
- Reihenfolge: 73; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-073`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-307.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
