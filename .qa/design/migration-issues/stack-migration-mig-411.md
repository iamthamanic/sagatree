<!-- migration-contract:v2 localId=MIG-411 -->
# MIG-411: Port Edge Function `items` to Node host service/adapter

## Type

Task

## Intent

items: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

items: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/items/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-items.md, .qa/intake/edge-infra-contracts/source-contracts/edge-items.json.

### Nachher und Verhalten

items: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/items/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-items.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-items.json`

## Security & Data

Dispatcher denies items with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No auth/schema validation or durable inventory; this legacy catalog is distinct from persistent definitions.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für items und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für items ausführt
- Dann: items worker remains404 for list/create/generate.
- Quelle: `.qa/intake/edge-infra-contracts/edge-items.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-items.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für items und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für items ausführt
- Dann: Isolated fixture pins Item defaults, rarity/type filters and generated range behavior; invalid nested data records current lack of validation.
- Quelle: `.qa/intake/edge-infra-contracts/edge-items.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-items.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für items und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für items ausführt
- Dann: Actual inventory_item_definitions adapter is migrated independently; do not route it to this Map catalog.
- Quelle: `.qa/intake/edge-infra-contracts/edge-items.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-items.json`

## Acceptance

- [ ] items worker remains404 for list/create/generate.
- [ ] Isolated fixture pins Item defaults, rarity/type filters and generated range behavior; invalid nested data records current lack of validation.
- [ ] Actual inventory_item_definitions adapter is migrated independently; do not route it to this Map catalog.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-411`
- Design: `.qa/design/migration-issues/stack-migration-mig-411.md`
- Status: blocked
- Reihenfolge: 53; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-053`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-411.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
