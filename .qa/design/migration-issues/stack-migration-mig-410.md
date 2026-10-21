<!-- migration-contract:v2 localId=MIG-410 -->
# MIG-410: Port Edge Function `item-thumbnail` to Node host service/adapter

## Type

Task

## Intent

item-thumbnail: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

item-thumbnail: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/item-thumbnail/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/inventory/item-thumbnail-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/ai-provider-resolve-meshy.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/item-thumbnail-image.ts, supabase/functions/_shared/item-thumbnail-meshy.ts, supabase/functions/_shared/item-thumbnail-prompt.ts, supabase/functions/_shared/item-thumbnail-rate-limit.ts, supabase/functions/_shared/media-server-optimize-proof.ts, supabase/functions/_shared/media-server-raster-optimize.ts, supabase/functions/item-thumbnail/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-item-thumbnail.md, .qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json.

### Nachher und Verhalten

item-thumbnail: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/item-thumbnail/.

## Scope

- Quellpfade: `src/infrastructure/inventory/item-thumbnail-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-resolve-meshy.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/item-thumbnail-image.ts`, `supabase/functions/_shared/item-thumbnail-meshy.ts`, `supabase/functions/_shared/item-thumbnail-prompt.ts`, `supabase/functions/_shared/item-thumbnail-rate-limit.ts`, `supabase/functions/_shared/media-server-optimize-proof.ts`, `supabase/functions/_shared/media-server-raster-optimize.ts`, `supabase/functions/item-thumbnail/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/item-thumbnail/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

## Owned internal prerequisites

- `consume_item_thumbnail_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

item-thumbnail: Authenticate /auth/v1/user. Definition must be active: personal.owner_user_id===caller, or world_profiles.owner_user_id===caller for world scope. Project membership/GM role is insufficient. status/latest-job filter owner_user_id. resolve allows asset owner or referenced world-profile owner. remove clears pointer but only deletes physical asset owned by caller. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
- Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: Personal owner and world-profile owner can upload valid PNG/JPEG/WebP<=10MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: generate consumes 4/60s per user; request5429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: Each action returns its exact documented union; assetKey uses thumbnail2d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: Foreign jobId404, foreign resolve403; remove of absent pointer succeeds and cannot delete a different owner's object; traversal/off-allowlist provider redirect/oversize asset never materializes.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für item-thumbnail und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-thumbnail ausführt
- Dann: Provider failure and unchecked job PATCH persistence failure are distinguished in the tested successor contract; no API keys in public failure bodies.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-thumbnail.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-thumbnail.json`

## Acceptance

- [ ] Personal owner and world-profile owner can upload valid PNG/JPEG/WebP<=10MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- [ ] generate consumes 4/60s per user; request5429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- [ ] Each action returns its exact documented union; assetKey uses thumbnail2d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- [ ] Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- [ ] Foreign jobId404, foreign resolve403; remove of absent pointer succeeds and cannot delete a different owner's object; traversal/off-allowlist provider redirect/oversize asset never materializes.
- [ ] Provider failure and unchecked job PATCH persistence failure are distinguished in the tested successor contract; no API keys in public failure bodies.
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

- Feature slug: `stack-migration-mig-410`
- Design: `.qa/design/migration-issues/stack-migration-mig-410.md`
- Status: blocked
- Reihenfolge: 52; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-052`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-410.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
