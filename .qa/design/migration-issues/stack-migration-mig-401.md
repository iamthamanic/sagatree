<!-- migration-contract:v2 localId=MIG-401 -->
# MIG-401: Port Edge Function `ai-gm` to Node host service/adapter

## Type

Task

## Intent

ai-gm: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

ai-gm: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/ai-gm-rate-limit.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/character-lore-prompt.ts, supabase/functions/_shared/character-lore-provider.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/ollama-llm-resolve.ts, supabase/functions/_shared/ollama-url-policy.ts, supabase/functions/_shared/session-membership-gate.ts, supabase/functions/ai-gm/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-ai-gm.md, .qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json.

### Nachher und Verhalten

ai-gm: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/ai-gm-rate-limit.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/_shared/session-membership-gate.ts`, `supabase/functions/ai-gm/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

## Owned internal prerequisites

- `consume_ai_gm_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

ai-gm: External dispatcher returns404 before worker creation. If directly invoked in an isolated fixture, assertSessionMemberAccess runs before persistent user quota and provider/lore fan-out; it does not establish a role-safe projection of caller-supplied NPC IDs/context. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Unmounted; no public activation authorization. Role-safe NPC context, correct context-index pairing, durable world mutation, stream framing across chunks and error-stack redaction require explicit successor decisions.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

## Acceptance

- [ ] Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
- [ ] Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
- [ ] Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
- [ ] If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-401`
- Design: `.qa/design/migration-issues/stack-migration-mig-401.md`
- Status: blocked
- Reihenfolge: 44; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-044`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-401.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
