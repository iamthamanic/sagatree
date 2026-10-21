<!-- migration-contract:v2 localId=MIG-424 -->
# MIG-424: Port Edge Function `world` to Node host service/adapter

## Type

Task

## Intent

world: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

world: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/world/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-world.md, .qa/intake/edge-infra-contracts/source-contracts/edge-world.json.

### Nachher und Verhalten

world: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/world/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-world.json`

## Security & Data

world: Dispatcher denies world with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No authentication or project ownership; arbitrary shallow updates allowed. Clock labels Gregorian but uses30-day months and lacks numeric bounds.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: world routes remain dispatcher404,including settings and clock writes.
- Quelle: `.qa/intake/edge-infra-contracts/edge-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-world.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Isolated fixture pins create defaults,discovery,event filtering,faction relationship and30-day calendar rollover.
- Quelle: `.qa/intake/edge-infra-contracts/edge-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-world.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für world und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für world ausführt
- Dann: Negative/nonfinite/huge hours must be bounded in any replacement; persistent world_profiles/world-atlas APIs remain separate and preserve their visibility policies.
- Quelle: `.qa/intake/edge-infra-contracts/edge-world.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-world.json`

## Acceptance

- [ ] world routes remain dispatcher404,including settings and clock writes.
- [ ] Isolated fixture pins create defaults,discovery,event filtering,faction relationship and30-day calendar rollover.
- [ ] Negative/nonfinite/huge hours must be bounded in any replacement; persistent world_profiles/world-atlas APIs remain separate and preserve their visibility policies.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-424`
- Design: `.qa/design/migration-issues/stack-migration-mig-424.md`
- Status: blocked
- Reihenfolge: 66; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-066`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-424.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
