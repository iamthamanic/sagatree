<!-- migration-contract:v2 localId=MIG-313 -->
# MIG-313: Port infrastructure/world adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/world: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/world: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/character/inventory-v2/primitives.ts`, `src/domains/items/definition.ts`, `src/domains/items/pack.ts`, `src/domains/items/packs/build-standard-item.ts`, `src/domains/items/packs/contemporary-basic.ts`, `src/domains/items/packs/context-packs.ts`, `src/domains/items/packs/core-snapshots.ts`, `src/domains/items/packs/fantasy-basic.ts`, `src/domains/items/packs/index.ts`, `src/domains/items/packs/scifi-basic.ts`, `src/domains/items/taxonomy.ts`, `src/domains/items/world-catalog.ts`, `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/npc-creature/definition.ts`, `src/domains/npc-creature/pack.ts`, `src/domains/npc-creature/packs/animals.ts`, `src/domains/npc-creature/packs/build-builtin.ts`, `src/domains/npc-creature/packs/context-packs.ts`, `src/domains/npc-creature/packs/fantasy-basics.ts`, `src/domains/npc-creature/packs/index.ts`, `src/domains/npc-creature/taxonomy.ts`, `src/domains/npc-creature/world-catalog.ts`, `src/domains/rules/sagatree/items/carry-capacity.ts`, `src/domains/rules/sagatree/items/index.ts`, `src/domains/rules/sagatree/items/resource-affordability.ts`, `src/domains/rules/sagatree/items/tool-rules.ts`, `src/domains/rules/sagatree/items/types.ts`, `src/domains/rules/sagatree/items/validators.ts`, `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts`, `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts`, `src/domains/rules/sagatree/npc-creature-power/compute.ts`, `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts`, `src/domains/rules/sagatree/npc-creature-power/index.ts`, `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts`, `src/domains/rules/sagatree/npc-creature-power/profiles.ts`, `src/domains/rules/sagatree/npc-creature-power/types.ts`, `src/domains/world/atlas/atlas-persist-state.ts`, `src/domains/world/atlas/atlas-prototype-lod.ts`, `src/domains/world/atlas/atlas-tool-registry.ts`, `src/domains/world/atlas/dornhain-unified-starter.ts`, `src/domains/world/atlas/dungeon-generator.ts`, `src/domains/world/atlas/index.ts`, `src/domains/world/atlas/map-edit-ops.ts`, `src/domains/world/atlas/map-frame.ts`, `src/domains/world/atlas/unified-canvas-doc.ts`, `src/domains/world/atlas/validate-world-atlas.ts`, `src/domains/world/atlas/webgl-runtime-bridge.ts`, `src/domains/world/atlas/world-atlas.types.ts`, `src/domains/world/contracts/world.types.ts`, `src/domains/world/hierarchy/create-plan.ts`, `src/domains/world/hierarchy/index.ts`, `src/domains/world/hierarchy/legacy-kind-map.ts`, `src/domains/world/hierarchy/migration-plan.ts`, `src/domains/world/hierarchy/mutations.ts`, `src/domains/world/hierarchy/world-hierarchy.ts`, `src/domains/world/hierarchy/world-node.types.ts`, `src/domains/world/hierarchy/world-scoped-inventory.ts`, `src/domains/world/map/atlas-camera.ts`, `src/domains/world/map/constants.ts`, `src/domains/world/map/dornhain-starter-map.ts`, `src/domains/world/map/index.ts`, `src/domains/world/map/validate-world-map.ts`, `src/domains/world/map/world-map.types.ts`, `src/domains/world/places/atlas-place-nav.ts`, `src/domains/world/places/atlas-webgl-nav-tree.ts`, `src/domains/world/places/index.ts`, `src/domains/world/places/parse-world-place.ts`, `src/domains/world/places/settlement-presets.ts`, `src/domains/world/places/world-place.types.ts`, `src/domains/world/worldModuleRegistry.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/infrastructure/world/host-world-adapter.ts`, `src/infrastructure/world/host-world-ports.contract.ts`, `src/infrastructure/world/host-world-read.contract.ts`, `src/infrastructure/world/world-atlas-service.ts`, `src/infrastructure/world/world-map-service.ts`, `src/infrastructure/world/world-place-service.ts`, `src/infrastructure/world/world-profile-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-world.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:


Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
2. Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
3. Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.
4. Contract fixture for archive_world_node_subtree: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
5. Contract fixture for create_world_node_with_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
6. Contract fixture for delete_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
7. Contract fixture for duplicate_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
8. Contract fixture for ensure_world_atlas_root: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
9. Contract fixture for get_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
10. Contract fixture for get_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
11. Contract fixture for list_world_atlas_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
12. Contract fixture for list_world_place_map_links: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
13. Contract fixture for list_world_places: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
14. Contract fixture for preview_world_node_consequences: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
15. Contract fixture for rename_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
16. Contract fixture for reparent_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
17. Contract fixture for save_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
18. Contract fixture for upsert_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
19. Contract fixture for upsert_world_place: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
20. Contract fixture for upsert_world_place_map_link: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
21. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 20 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/character/inventory-v2/primitives.ts`, `src/domains/items/definition.ts`, `src/domains/items/pack.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | TBD by dependency successors: MIG-012/#791, MIG-013/#792, MIG-020/#795, RPC-WORLD-DESTRUCTIVE/#866, RPC-WORLD-CREATE/#864, RPC-WORLD-RESTRUCTURE/#865, RPC-ATLAS-MAPS/#862, RPC-WORLD-MAP/#861, RPC-WORLD-PLACES/#863, MIG-500/#841, MIG-014/#793 |
| **FEATURE VERIFIED** | ATLAS-LIVE-E2E/#770 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

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

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-313`
- Design: `.qa/design/migration-issues/stack-migration-mig-313.md`
- Status: ready
- Reihenfolge: 79; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-079`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-313.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Integration peers

- #805 (MIG-306)

Gemeinsame Ports bleiben stabil, Integrationsabnahme in MIG-600; keine zyklischen Startverbote.

