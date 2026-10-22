<!-- migration-contract:v2 localId=MIG-313 -->
# MIG-313: Port infrastructure/world adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/world: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/world: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/character/inventory-v2/primitives.ts, src/domains/items/definition.ts, src/domains/items/pack.ts, src/domains/items/packs/build-standard-item.ts, src/domains/items/packs/contemporary-basic.ts, src/domains/items/packs/context-packs.ts, src/domains/items/packs/core-snapshots.ts, src/domains/items/packs/fantasy-basic.ts, src/domains/items/packs/index.ts, src/domains/items/packs/scifi-basic.ts, src/domains/items/taxonomy.ts, src/domains/items/world-catalog.ts, src/domains/media/index.ts, src/domains/media/optimization-contract.ts, src/domains/media/optimization-policy.ts, src/domains/npc-creature/definition.ts, src/domains/npc-creature/pack.ts, src/domains/npc-creature/packs/animals.ts, src/domains/npc-creature/packs/build-builtin.ts, src/domains/npc-creature/packs/context-packs.ts, src/domains/npc-creature/packs/fantasy-basics.ts, src/domains/npc-creature/packs/index.ts, src/domains/npc-creature/taxonomy.ts, src/domains/npc-creature/world-catalog.ts, src/domains/rules/sagatree/items/carry-capacity.ts, src/domains/rules/sagatree/items/index.ts, src/domains/rules/sagatree/items/resource-affordability.ts, src/domains/rules/sagatree/items/tool-rules.ts, src/domains/rules/sagatree/items/types.ts, src/domains/rules/sagatree/items/validators.ts, src/domains/rules/sagatree/npc-creature-power/benchmarks.ts, src/domains/rules/sagatree/npc-creature-power/combat-roles.ts, src/domains/rules/sagatree/npc-creature-power/compute.ts, src/domains/rules/sagatree/npc-creature-power/damage-steps.ts, src/domains/rules/sagatree/npc-creature-power/index.ts, src/domains/rules/sagatree/npc-creature-power/machtgrad.ts, src/domains/rules/sagatree/npc-creature-power/profiles.ts, src/domains/rules/sagatree/npc-creature-power/types.ts, src/domains/world/atlas/atlas-persist-state.ts, src/domains/world/atlas/atlas-prototype-lod.ts, src/domains/world/atlas/atlas-tool-registry.ts, src/domains/world/atlas/dornhain-unified-starter.ts, src/domains/world/atlas/dungeon-generator.ts, src/domains/world/atlas/index.ts, src/domains/world/atlas/map-edit-ops.ts, src/domains/world/atlas/map-frame.ts, src/domains/world/atlas/unified-canvas-doc.ts, src/domains/world/atlas/validate-world-atlas.ts, src/domains/world/atlas/webgl-runtime-bridge.ts, src/domains/world/atlas/world-atlas.types.ts, src/domains/world/contracts/world.types.ts, src/domains/world/hierarchy/create-plan.ts, src/domains/world/hierarchy/index.ts, src/domains/world/hierarchy/legacy-kind-map.ts, src/domains/world/hierarchy/migration-plan.ts, src/domains/world/hierarchy/mutations.ts, src/domains/world/hierarchy/world-hierarchy.ts, src/domains/world/hierarchy/world-node.types.ts, src/domains/world/hierarchy/world-scoped-inventory.ts, src/domains/world/map/atlas-camera.ts, src/domains/world/map/constants.ts, src/domains/world/map/dornhain-starter-map.ts, src/domains/world/map/index.ts, src/domains/world/map/validate-world-map.ts, src/domains/world/map/world-map.types.ts, src/domains/world/places/atlas-place-nav.ts, src/domains/world/places/atlas-webgl-nav-tree.ts, src/domains/world/places/index.ts, src/domains/world/places/parse-world-place.ts, src/domains/world/places/settlement-presets.ts, src/domains/world/places/world-place.types.ts, src/domains/world/worldModuleRegistry.ts, src/infrastructure/media/optimizer/engines/audio/index.ts, src/infrastructure/media/optimizer/engines/image/image.worker.ts, src/infrastructure/media/optimizer/engines/image/index.ts, src/infrastructure/media/optimizer/engines/image/optimize-image.ts, src/infrastructure/media/optimizer/engines/image/raster-decode.ts, src/infrastructure/media/optimizer/engines/image/resource-limits.ts, src/infrastructure/media/optimizer/engines/image/types.ts, src/infrastructure/media/optimizer/engines/image/webp-budget.ts, src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts, src/infrastructure/media/optimizer/engines/model3d/index.ts, src/infrastructure/media/optimizer/engines/video/index.ts, src/infrastructure/media/optimizer/index.ts, src/infrastructure/media/optimizer/media-optimizer.ts, src/infrastructure/world/host-world-read.contract.ts, src/infrastructure/world/world-atlas-service.ts, src/infrastructure/world/world-map-service.ts, src/infrastructure/world/world-place-service.ts, src/infrastructure/world/world-profile-service.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-world.md, .qa/intake/edge-infra-contracts/source-contracts/infra-world.json.

### Nachher und Verhalten

src/infrastructure/world: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/character/inventory-v2/primitives.ts`, `src/domains/items/definition.ts`, `src/domains/items/pack.ts`, `src/domains/items/packs/build-standard-item.ts`, `src/domains/items/packs/contemporary-basic.ts`, `src/domains/items/packs/context-packs.ts`, `src/domains/items/packs/core-snapshots.ts`, `src/domains/items/packs/fantasy-basic.ts`, `src/domains/items/packs/index.ts`, `src/domains/items/packs/scifi-basic.ts`, `src/domains/items/taxonomy.ts`, `src/domains/items/world-catalog.ts`, `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/npc-creature/definition.ts`, `src/domains/npc-creature/pack.ts`, `src/domains/npc-creature/packs/animals.ts`, `src/domains/npc-creature/packs/build-builtin.ts`, `src/domains/npc-creature/packs/context-packs.ts`, `src/domains/npc-creature/packs/fantasy-basics.ts`, `src/domains/npc-creature/packs/index.ts`, `src/domains/npc-creature/taxonomy.ts`, `src/domains/npc-creature/world-catalog.ts`, `src/domains/rules/sagatree/items/carry-capacity.ts`, `src/domains/rules/sagatree/items/index.ts`, `src/domains/rules/sagatree/items/resource-affordability.ts`, `src/domains/rules/sagatree/items/tool-rules.ts`, `src/domains/rules/sagatree/items/types.ts`, `src/domains/rules/sagatree/items/validators.ts`, `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts`, `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts`, `src/domains/rules/sagatree/npc-creature-power/compute.ts`, `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts`, `src/domains/rules/sagatree/npc-creature-power/index.ts`, `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts`, `src/domains/rules/sagatree/npc-creature-power/profiles.ts`, `src/domains/rules/sagatree/npc-creature-power/types.ts`, `src/domains/world/atlas/atlas-persist-state.ts`, `src/domains/world/atlas/atlas-prototype-lod.ts`, `src/domains/world/atlas/atlas-tool-registry.ts`, `src/domains/world/atlas/dornhain-unified-starter.ts`, `src/domains/world/atlas/dungeon-generator.ts`, `src/domains/world/atlas/index.ts`, `src/domains/world/atlas/map-edit-ops.ts`, `src/domains/world/atlas/map-frame.ts`, `src/domains/world/atlas/unified-canvas-doc.ts`, `src/domains/world/atlas/validate-world-atlas.ts`, `src/domains/world/atlas/webgl-runtime-bridge.ts`, `src/domains/world/atlas/world-atlas.types.ts`, `src/domains/world/contracts/world.types.ts`, `src/domains/world/hierarchy/create-plan.ts`, `src/domains/world/hierarchy/index.ts`, `src/domains/world/hierarchy/legacy-kind-map.ts`, `src/domains/world/hierarchy/migration-plan.ts`, `src/domains/world/hierarchy/mutations.ts`, `src/domains/world/hierarchy/world-hierarchy.ts`, `src/domains/world/hierarchy/world-node.types.ts`, `src/domains/world/hierarchy/world-scoped-inventory.ts`, `src/domains/world/map/atlas-camera.ts`, `src/domains/world/map/constants.ts`, `src/domains/world/map/dornhain-starter-map.ts`, `src/domains/world/map/index.ts`, `src/domains/world/map/validate-world-map.ts`, `src/domains/world/map/world-map.types.ts`, `src/domains/world/places/atlas-place-nav.ts`, `src/domains/world/places/atlas-webgl-nav-tree.ts`, `src/domains/world/places/index.ts`, `src/domains/world/places/parse-world-place.ts`, `src/domains/world/places/settlement-presets.ts`, `src/domains/world/places/world-place.types.ts`, `src/domains/world/worldModuleRegistry.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/infrastructure/world/host-world-read.contract.ts`, `src/infrastructure/world/world-atlas-service.ts`, `src/infrastructure/world/world-map-service.ts`, `src/infrastructure/world/world-place-service.ts`, `src/infrastructure/world/world-profile-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

## Integration peers

- #805 (MIG-306)

Diese Adapter interagieren über die in MIG-012 fixierten Ports. Bestehende Signaturen bleiben beim einzelnen Port stabil; die gemeinsame Abnahme erfolgt in MIG-600. Ihre gegenseitigen Imports erzeugen kein zyklisches Startverbot.

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for archive_world_node_subtree: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for create_world_node_with_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for delete_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for duplicate_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 8

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for ensure_world_atlas_root: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 9

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for get_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 10

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for get_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 11

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for list_world_atlas_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 12

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for list_world_place_map_links: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 13

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for list_world_places: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 14

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for preview_world_node_consequences: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 15

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for rename_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 16

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for reparent_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 17

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for save_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 18

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for upsert_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 19

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for upsert_world_place: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

### Fall 20

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Contract fixture for upsert_world_place_map_link: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`

## Acceptance

- [ ] Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
- [ ] Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
- [ ] Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.
- [ ] Contract fixture for archive_world_node_subtree: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for create_world_node_with_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for delete_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for duplicate_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for ensure_world_atlas_root: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for get_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for get_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for list_world_atlas_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for list_world_place_map_links: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for list_world_places: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for preview_world_node_consequences: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for rename_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for reparent_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for save_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for upsert_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for upsert_world_place: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Contract fixture for upsert_world_place_map_link: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #866 (RPC-WORLD-DESTRUCTIVE)
- Depends on #864 (RPC-WORLD-CREATE)
- Depends on #865 (RPC-WORLD-RESTRUCTURE)
- Depends on #862 (RPC-ATLAS-MAPS)
- Depends on #861 (RPC-WORLD-MAP)
- Depends on #863 (RPC-WORLD-PLACES)
- Depends on #841 (MIG-500)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-313`
- Design: `.qa/design/migration-issues/stack-migration-mig-313.md`
- Status: blocked
- Reihenfolge: 79; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-079`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-313.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
