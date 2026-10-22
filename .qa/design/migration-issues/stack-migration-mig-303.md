<!-- migration-contract:v2 localId=MIG-303 -->
# MIG-303: Port infrastructure/inventory adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/inventory: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/inventory: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/character/avatar/face-anchor-contract.ts, src/domains/character/avatar/morph-contract.ts, src/domains/character/domain/character.entity.ts, src/domains/character/domain/sagatree-profile.entity.ts, src/domains/character/inventory-v2/catalog.ts, src/domains/character/inventory-v2/core-catalog.ts, src/domains/character/inventory-v2/index.ts, src/domains/character/inventory-v2/migrate-legacy.ts, src/domains/character/inventory-v2/operations.ts, src/domains/character/inventory-v2/primitives.ts, src/domains/character/inventory-v2/state.ts, src/domains/character/inventory-v2/types.ts, src/domains/character/inventory-v2/validation.ts, src/domains/items/assets.ts, src/domains/items/definition.ts, src/domains/items/fork.ts, src/domains/items/icon-assets.ts, src/domains/items/index.ts, src/domains/items/library-query.ts, src/domains/items/model3d-assets.ts, src/domains/items/normalize.ts, src/domains/items/pack.ts, src/domains/items/packs/build-standard-item.ts, src/domains/items/packs/contemporary-basic.ts, src/domains/items/packs/context-packs.ts, src/domains/items/packs/core-snapshots.ts, src/domains/items/packs/fantasy-basic.ts, src/domains/items/packs/index.ts, src/domains/items/packs/scifi-basic.ts, src/domains/items/payload.ts, src/domains/items/taxonomy.ts, src/domains/items/validate.ts, src/domains/items/world-catalog.ts, src/domains/media/index.ts, src/domains/media/optimization-contract.ts, src/domains/media/optimization-policy.ts, src/domains/resource-id/index.ts, src/domains/resource-id/public-resource-id.ts, src/domains/resource-id/screen-vs-modal.ts, src/domains/resource-id/session-routing.ts, src/domains/rules/sagatree/character-creation/index.ts, src/domains/rules/sagatree/items/carry-capacity.ts, src/domains/rules/sagatree/items/index.ts, src/domains/rules/sagatree/items/resource-affordability.ts, src/domains/rules/sagatree/items/tool-rules.ts, src/domains/rules/sagatree/items/types.ts, src/domains/rules/sagatree/items/validators.ts, src/domains/rules/sagatree/skill-progression/index.ts, src/domains/rules/sagatree/species-trait-options/index.ts, src/infrastructure/character/character.persistence.ts, src/infrastructure/inventory/inventory-persistence.ts, src/infrastructure/inventory/item-catalog-service.ts, src/infrastructure/inventory/item-catalog.persistence.ts, src/infrastructure/inventory/item-model3d-service.ts, src/infrastructure/inventory/item-thumbnail-service.ts, src/infrastructure/inventory/supabase-item-catalog.repository.ts, src/infrastructure/media/optimizer/engines/audio/index.ts, src/infrastructure/media/optimizer/engines/image/image.worker.ts, src/infrastructure/media/optimizer/engines/image/index.ts, src/infrastructure/media/optimizer/engines/image/optimize-image.ts, src/infrastructure/media/optimizer/engines/image/raster-decode.ts, src/infrastructure/media/optimizer/engines/image/resource-limits.ts, src/infrastructure/media/optimizer/engines/image/types.ts, src/infrastructure/media/optimizer/engines/image/webp-budget.ts, src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts, src/infrastructure/media/optimizer/engines/model3d/index.ts, src/infrastructure/media/optimizer/engines/video/index.ts, src/infrastructure/media/optimizer/index.ts, src/infrastructure/media/optimizer/media-optimizer.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-inventory.md, .qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json.

### Nachher und Verhalten

src/infrastructure/inventory: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts`, `src/domains/character/domain/sagatree-profile.entity.ts`, `src/domains/character/inventory-v2/catalog.ts`, `src/domains/character/inventory-v2/core-catalog.ts`, `src/domains/character/inventory-v2/index.ts`, `src/domains/character/inventory-v2/migrate-legacy.ts`, `src/domains/character/inventory-v2/operations.ts`, `src/domains/character/inventory-v2/primitives.ts`, `src/domains/character/inventory-v2/state.ts`, `src/domains/character/inventory-v2/types.ts`, `src/domains/character/inventory-v2/validation.ts`, `src/domains/items/assets.ts`, `src/domains/items/definition.ts`, `src/domains/items/fork.ts`, `src/domains/items/icon-assets.ts`, `src/domains/items/index.ts`, `src/domains/items/library-query.ts`, `src/domains/items/model3d-assets.ts`, `src/domains/items/normalize.ts`, `src/domains/items/pack.ts`, `src/domains/items/packs/build-standard-item.ts`, `src/domains/items/packs/contemporary-basic.ts`, `src/domains/items/packs/context-packs.ts`, `src/domains/items/packs/core-snapshots.ts`, `src/domains/items/packs/fantasy-basic.ts`, `src/domains/items/packs/index.ts`, `src/domains/items/packs/scifi-basic.ts`, `src/domains/items/payload.ts`, `src/domains/items/taxonomy.ts`, `src/domains/items/validate.ts`, `src/domains/items/world-catalog.ts`, `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/resource-id/index.ts`, `src/domains/resource-id/public-resource-id.ts`, `src/domains/resource-id/screen-vs-modal.ts`, `src/domains/resource-id/session-routing.ts`, `src/domains/rules/sagatree/character-creation/index.ts`, `src/domains/rules/sagatree/items/carry-capacity.ts`, `src/domains/rules/sagatree/items/index.ts`, `src/domains/rules/sagatree/items/resource-affordability.ts`, `src/domains/rules/sagatree/items/tool-rules.ts`, `src/domains/rules/sagatree/items/types.ts`, `src/domains/rules/sagatree/items/validators.ts`, `src/domains/rules/sagatree/skill-progression/index.ts`, `src/domains/rules/sagatree/species-trait-options/index.ts`, `src/infrastructure/character/character.persistence.ts`, `src/infrastructure/inventory/inventory-persistence.ts`, `src/infrastructure/inventory/item-catalog-service.ts`, `src/infrastructure/inventory/item-catalog.persistence.ts`, `src/infrastructure/inventory/item-model3d-service.ts`, `src/infrastructure/inventory/item-thumbnail-service.ts`, `src/infrastructure/inventory/supabase-item-catalog.repository.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

## Integration peers

- #801 (MIG-302)
- #805 (MIG-306)

Diese Adapter interagieren über die in MIG-012 fixierten Ports. Bestehende Signaturen bleiben beim einzelnen Port stabil; die gemeinsame Abnahme erfolgt in MIG-600. Ihre gegenseitigen Imports erzeugen kein zyklisches Startverbot.

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

## Acceptance

- [ ] Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- [ ] Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- [ ] Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #825 (MIG-409)
- Depends on #826 (MIG-410)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-303`
- Design: `.qa/design/migration-issues/stack-migration-mig-303.md`
- Status: blocked
- Reihenfolge: 69; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-069`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-303.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
