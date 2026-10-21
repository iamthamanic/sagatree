<!-- migration-contract:v2 localId=MIG-403 -->
# MIG-403: Port Edge Function `bestiary` to Node host service/adapter

## Type

Task

## Intent

bestiary: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

bestiary: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/bestiary/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-bestiary.md, .qa/intake/edge-infra-contracts/source-contracts/edge-bestiary.json.

### Nachher und Verhalten

bestiary: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/bestiary/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-bestiary.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-bestiary.json`

## Security & Data

bestiary: Dispatcher denies bestiary with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No authentication or schema validation; requested monster count and known monster list differ in XP adjustment. Nonpositive/invalid generator data is unbounded.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für bestiary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für bestiary ausführt
- Dann: All bestiary paths remain dispatcher404 without Map initialization.
- Quelle: `.qa/intake/edge-infra-contracts/edge-bestiary.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-bestiary.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für bestiary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für bestiary ausführt
- Dann: Isolated create/list/search/encounter fixture checks every Monster default, CR parsing, unknown monster skipping and requested-count multiplier.
- Quelle: `.qa/intake/edge-infra-contracts/edge-bestiary.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-bestiary.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für bestiary und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für bestiary ausführt
- Dann: Negative count/XP/party size and unknown difficulty require bounded explicit validation in any separately approved replacement; generator is not authorized for public deployment.
- Quelle: `.qa/intake/edge-infra-contracts/edge-bestiary.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-bestiary.json`

## Acceptance

- [ ] All bestiary paths remain dispatcher404 without Map initialization.
- [ ] Isolated create/list/search/encounter fixture checks every Monster default, CR parsing, unknown monster skipping and requested-count multiplier.
- [ ] Negative count/XP/party size and unknown difficulty require bounded explicit validation in any separately approved replacement; generator is not authorized for public deployment.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-403`
- Design: `.qa/design/migration-issues/stack-migration-mig-403.md`
- Status: blocked
- Reihenfolge: 45; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-045`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-403.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
