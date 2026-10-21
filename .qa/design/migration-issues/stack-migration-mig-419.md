<!-- migration-contract:v2 localId=MIG-419 -->
# MIG-419: Port Edge Function `rulesets` to Node host service/adapter

## Type

Task

## Intent

rulesets: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

rulesets: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/rulesets/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-rulesets.md, .qa/intake/edge-infra-contracts/source-contracts/edge-rulesets.json.

### Nachher und Verhalten

rulesets: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/rulesets/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-rulesets.json`

## Security & Data

rulesets: Dispatcher denies rulesets with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No auth, owner model or creation validation; Open5e fetches have no explicit timeout/status check/pagination. Caller-supplied ID can overwrite a Map entry.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für rulesets und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für rulesets ausführt
- Dann: rulesets and supplemental routes stay dispatcher404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-rulesets.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für rulesets und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für rulesets ausführt
- Dann: Isolated fixture checks defaults, enrich=true behavior and exact Open5e mapping; no network request during ordinary non-enrich catalog read.
- Quelle: `.qa/intake/edge-infra-contracts/edge-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-rulesets.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für rulesets und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für rulesets ausführt
- Dann: HTTP failure/bad JSON produces empty supplement arrays; no assumption that limit500 follows pagination or includes all remote records.
- Quelle: `.qa/intake/edge-infra-contracts/edge-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-rulesets.json`

## Acceptance

- [ ] rulesets and supplemental routes stay dispatcher404.
- [ ] Isolated fixture checks defaults, enrich=true behavior and exact Open5e mapping; no network request during ordinary non-enrich catalog read.
- [ ] HTTP failure/bad JSON produces empty supplement arrays; no assumption that limit500 follows pagination or includes all remote records.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-419`
- Design: `.qa/design/migration-issues/stack-migration-mig-419.md`
- Status: blocked
- Reihenfolge: 60; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-060`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-419.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
