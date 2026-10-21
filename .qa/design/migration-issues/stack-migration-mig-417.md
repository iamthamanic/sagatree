<!-- migration-contract:v2 localId=MIG-417 -->
# MIG-417: Port Edge Function `npcs` to Node host service/adapter

## Type

Task

## Intent

npcs: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

npcs: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/npcs/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-npcs.md, .qa/intake/edge-infra-contracts/source-contracts/edge-npcs.json.

### Nachher und Verhalten

npcs: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/npcs/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-npcs.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-npcs.json`

## Security & Data

Dispatcher denies npcs with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No auth/ownership/session visibility, generated prompt is unused; object spreads may override nominally generated dialogue fields at runtime.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für npcs und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npcs ausführt
- Dann: npcs worker all CRUD/social/export/generator paths remain404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-npcs.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-npcs.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für npcs und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npcs ausführt
- Dann: Isolated fixture pins defaults, generated ranges, memory slicing, replacement relationships and dialogue shape.
- Quelle: `.qa/intake/edge-infra-contracts/edge-npcs.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-npcs.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für npcs und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npcs ausführt
- Dann: Request prompt does not trigger external provider; legacy NPC structure is not substituted for npc_creature_definitions/instances/controller policy.
- Quelle: `.qa/intake/edge-infra-contracts/edge-npcs.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-npcs.json`

## Acceptance

- [ ] npcs worker all CRUD/social/export/generator paths remain404.
- [ ] Isolated fixture pins defaults, generated ranges, memory slicing, replacement relationships and dialogue shape.
- [ ] Request prompt does not trigger external provider; legacy NPC structure is not substituted for npc_creature_definitions/instances/controller policy.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-417`
- Design: `.qa/design/migration-issues/stack-migration-mig-417.md`
- Status: blocked
- Reihenfolge: 58; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-058`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-417.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
