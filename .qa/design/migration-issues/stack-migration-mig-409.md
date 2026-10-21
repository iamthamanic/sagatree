<!-- migration-contract:v2 localId=MIG-409 -->
# MIG-409: Port Edge Function `item-model3d` to Node host service/adapter

## Type

Task

## Intent

item-model3d: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

item-model3d: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/item-model3d/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/inventory/item-model3d-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/ai-provider-resolve-meshy.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/item-model3d-glb.ts, supabase/functions/_shared/item-model3d-meshy.ts, supabase/functions/_shared/item-model3d-rate-limit.ts, supabase/functions/_shared/item-thumbnail-image.ts, supabase/functions/item-model3d/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-item-model3d.md, .qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json.

### Nachher und Verhalten

item-model3d: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/item-model3d/.

## Scope

- Quellpfade: `src/infrastructure/inventory/item-model3d-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-resolve-meshy.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/item-model3d-glb.ts`, `supabase/functions/_shared/item-model3d-meshy.ts`, `supabase/functions/_shared/item-model3d-rate-limit.ts`, `supabase/functions/_shared/item-thumbnail-image.ts`, `supabase/functions/item-model3d/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/item-model3d/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

## Owned internal prerequisites

- `consume_item_model3d_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

item-model3d: Authenticate /auth/v1/user. Definition must be active: personal.owner_user_id===caller, or world_profiles.owner_user_id===caller for world scope. Project membership/GM role is insufficient. status/latest-job filter owner_user_id. resolve allows asset owner or referenced world-profile owner. remove clears pointer but only deletes physical asset owned by caller. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
- Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.
- GLB validator checks magic, size and MIME only; it does not validate GLB version/declared length/chunk structure.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Personal owner and world-profile owner can upload valid GLB<=50MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: generate consumes 2/60s per user; request3429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Each action returns its exact documented union; model3d uses model3d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

## Acceptance

- [ ] Personal owner and world-profile owner can upload valid GLB<=50MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- [ ] generate consumes 2/60s per user; request3429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- [ ] Each action returns its exact documented union; model3d uses model3d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- [ ] Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-409`
- Design: `.qa/design/migration-issues/stack-migration-mig-409.md`
- Status: blocked
- Reihenfolge: 51; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-051`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-409.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
