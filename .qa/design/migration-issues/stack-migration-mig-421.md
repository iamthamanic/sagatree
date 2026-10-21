<!-- migration-contract:v2 localId=MIG-421 -->
# MIG-421: Port Edge Function `session-recap` to Node host service/adapter

## Type

Task

## Intent

session-recap: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

session-recap: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/session-recap/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/session/session-recap-ai-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/character-lore-prompt.ts, supabase/functions/_shared/character-lore-provider.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/ollama-llm-resolve.ts, supabase/functions/_shared/ollama-url-policy.ts, supabase/functions/_shared/session-recap-prompt.ts, supabase/functions/_shared/session-recap-provider.ts, supabase/functions/_shared/session-recap-rate-limit.ts, supabase/functions/main/index.ts, supabase/functions/session-recap/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-session-recap.md, .qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json.

### Nachher und Verhalten

session-recap: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/session-recap/.

## Scope

- Quellpfade: `src/infrastructure/session/session-recap-ai-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/_shared/session-recap-prompt.ts`, `supabase/functions/_shared/session-recap-provider.ts`, `supabase/functions/_shared/session-recap-rate-limit.ts`, `supabase/functions/main/index.ts`, `supabase/functions/session-recap/index.ts`
- Änderbare Zielpfade: `server/src/application/session-recap/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

## Owned internal prerequisites

- `consume_session_recap_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

session-recap: Authenticated account must equal projects.gm_user_id for sessions.project_id. A project owner/member/GM label alone is not substituted for that equality. Session must be completed or cancelled. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Distinct owner O and project GM G: only G can generate a recap for an ended session; active member/player/foreign X denied.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: POST with client highlights/prompt/worldState/summaryText rejects400, and GM-only highlight sentinel never reaches provider.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Successful response coincides with persisted summary_status=draft; publication remains a separate RPC decision.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Non-ended session400, missing session404, eighth-thousand-and-first byte413; quota7 returns429.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

## Acceptance

- [ ] Distinct owner O and project GM G: only G can generate a recap for an ended session; active member/player/foreign X denied.
- [ ] POST with client highlights/prompt/worldState/summaryText rejects400, and GM-only highlight sentinel never reaches provider.
- [ ] Successful response coincides with persisted summary_status=draft; publication remains a separate RPC decision.
- [ ] Non-ended session400, missing session404, eighth-thousand-and-first byte413; quota7 returns429.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #870 (RPC-SESSION-RECAP)
- Depends on #791 (MIG-012)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-421`
- Design: `.qa/design/migration-issues/stack-migration-mig-421.md`
- Status: blocked
- Reihenfolge: 62; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-062`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-421.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
