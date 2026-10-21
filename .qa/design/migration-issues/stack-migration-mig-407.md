<!-- migration-contract:v2 localId=MIG-407 -->
# MIG-407: Port Edge Function `dm-tools` to Node host service/adapter

## Type

Task

## Intent

dm-tools: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

dm-tools: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/dm-tools/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-dm-tools.md, .qa/intake/edge-infra-contracts/source-contracts/edge-dm-tools.json.

### Nachher und Verhalten

dm-tools: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/dm-tools/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-dm-tools.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-dm-tools.json`

## Security & Data

dm-tools: Dispatcher denies dm-tools with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Unauthenticated client combat/session/character authority and unbounded dice-count input make this unsuitable for activation. REDIS_URL does not provide persistence.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für dm-tools und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für dm-tools ausführt
- Dann: dm-tools all routes remain404 at dispatcher, including dice and health.
- Quelle: `.qa/intake/edge-infra-contracts/edge-dm-tools.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-dm-tools.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für dm-tools und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für dm-tools ausführt
- Dann: Seeded random fixture pins d20 advantage, notation modifier handling, initiative ordering, next-round and end-combat log shapes.
- Quelle: `.qa/intake/edge-infra-contracts/edge-dm-tools.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-dm-tools.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für dm-tools und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für dm-tools ausführt
- Dann: Invalid notation/missing participant/target follows isolated500 behavior; no claim of authenticated combat or durable Redis state.
- Quelle: `.qa/intake/edge-infra-contracts/edge-dm-tools.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-dm-tools.json`

## Acceptance

- [ ] dm-tools all routes remain404 at dispatcher, including dice and health.
- [ ] Seeded random fixture pins d20 advantage, notation modifier handling, initiative ordering, next-round and end-combat log shapes.
- [ ] Invalid notation/missing participant/target follows isolated500 behavior; no claim of authenticated combat or durable Redis state.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-407`
- Design: `.qa/design/migration-issues/stack-migration-mig-407.md`
- Status: blocked
- Reihenfolge: 49; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-049`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-407.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
