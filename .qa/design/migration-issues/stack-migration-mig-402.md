<!-- migration-contract:v2 localId=MIG-402 -->
# MIG-402: Port Edge Function `ai-provider-credentials` to Node host service/adapter

## Type

Task

## Intent

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/ai-provider-credentials/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/ai/ai-provider-credentials-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/ai-provider-meshy.ts, supabase/functions/_shared/ai-provider-registry.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/ai-provider-credentials/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md, .qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json.

### Nachher und Verhalten

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/ai-provider-credentials/.

## Scope

- Quellpfade: `src/infrastructure/ai/ai-provider-credentials-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-meshy.ts`, `supabase/functions/_shared/ai-provider-registry.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/ai-provider-credentials/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/ai-provider-credentials/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

## Owned internal prerequisites

- `consume_ai_provider_credential_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every credential read/update/delete filters user_id = that userId; inserts set it server-side. Meshy is the only catalog provider. No owner from request is trusted. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Ninth upsert/refresh inside the default 60s window returns 429, list/delete do not consume quota; store failure must not call Meshy.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Missing encryption key yields 503, rejected key yields 400; upsert preserves added_at and delete of absent own row succeeds.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

## Acceptance

- [ ] Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
- [ ] List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
- [ ] Ninth upsert/refresh inside the default 60s window returns 429, list/delete do not consume quota; store failure must not call Meshy.
- [ ] Missing encryption key yields 503, rejected key yields 400; upsert preserves added_at and delete of absent own row succeeds.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #791 (MIG-012)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-402`
- Design: `.qa/design/migration-issues/stack-migration-mig-402.md`
- Status: blocked
- Reihenfolge: 44; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-044`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-402.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
