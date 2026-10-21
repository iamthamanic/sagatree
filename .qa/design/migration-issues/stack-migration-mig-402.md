<!-- migration-contract:v2 localId=MIG-402 -->
# MIG-402: Port Edge Function `ai-provider-credentials` to Node host service/adapter

## Type

Task

## Intent

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. ollama-settings: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. ollama-settings: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/ai-provider-credentials/, server/src/application/ollama-settings/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/ai/ai-provider-credentials-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/ai-provider-meshy.ts, supabase/functions/_shared/ai-provider-registry.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/ai-provider-credentials/index.ts, supabase/functions/main/index.ts, src/infrastructure/ai/ollama-settings-service.ts, supabase/functions/_shared/character-lore-prompt.ts, supabase/functions/_shared/character-lore-provider.ts, supabase/functions/_shared/ollama-llm-resolve.ts, supabase/functions/_shared/ollama-url-policy.ts, supabase/functions/ollama-settings/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md, .qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json, .qa/intake/edge-infra-contracts/edge-ollama-settings.md, .qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json.

### Nachher und Verhalten

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. ollama-settings: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/ai-provider-credentials/, server/src/application/ollama-settings/.

## Scope

- Quellpfade: `src/infrastructure/ai/ai-provider-credentials-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-meshy.ts`, `supabase/functions/_shared/ai-provider-registry.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/ai-provider-credentials/index.ts`, `supabase/functions/main/index.ts`, `src/infrastructure/ai/ollama-settings-service.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/ollama-settings/index.ts`
- Änderbare Zielpfade: `server/src/application/ai-provider-credentials/`, `server/src/application/ollama-settings/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`, `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

## Owned internal prerequisites

- `consume_ai_provider_credential_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

ai-provider-credentials: After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every credential read/update/delete filters user_id = that userId; inserts set it server-side. Meshy is the only catalog provider. No owner from request is trusted. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. ollama-settings: After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every read/write filters user_id = that userId. No project/session membership is required. Custom base URLs must pass SSRF allowlist checks; plaintext API keys are accepted only on write and stored encrypted. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.
- No dedicated MIG-4xx GitHub identity yet; bound to MIG-402/#818 to preserve the fixed 90-issue registry after #879. Dedicated ticket allocation is a human decision, not agent inventing identities.

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

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Account O can get/upsert/test/listModels its Ollama prefs without project membership; account X never reads or mutates O's row.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Responses never include apiKey or secret_ciphertext; only hasApiKey/keyHint and rounded status fields.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

## Acceptance

- [ ] Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
- [ ] List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
- [ ] Account O can get/upsert/test/listModels its Ollama prefs without project membership; account X never reads or mutates O's row.
- [ ] Responses never include apiKey or secret_ciphertext; only hasApiKey/keyHint and rounded status fields.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #791 (MIG-012)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-402`
- Design: `.qa/design/migration-issues/stack-migration-mig-402.md`
- Status: blocked
- Reihenfolge: 43; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-043`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-402.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
