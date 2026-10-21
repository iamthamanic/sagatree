<!-- migration-contract:v2 localId=MIG-405 -->
# MIG-405: Port Edge Function `character-lore` to Node host service/adapter

## Type

Task

## Intent

character-lore: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

character-lore: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-lore/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/character/character-lore-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/character-lore-access.ts, supabase/functions/_shared/character-lore-prompt.ts, supabase/functions/_shared/character-lore-provider.ts, supabase/functions/_shared/character-lore-rate-limit.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/ollama-llm-resolve.ts, supabase/functions/_shared/ollama-url-policy.ts, supabase/functions/character-lore/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-character-lore.md, .qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json.

### Nachher und Verhalten

character-lore: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-lore/.

## Scope

- Quellpfade: `src/infrastructure/character/character-lore-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-access.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/character-lore-rate-limit.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/character-lore/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/character-lore/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

## Owned internal prerequisites

- `consume_character_lore_rate_limit`

Diese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.

## Security & Data

character-lore: Authenticate via /auth/v1/user. Optional projectId requires project GM or active project_members; optional worldId must match project.world_id when both supplied. World lore is allowed if public or creator_user_id equals project GM (project-linked) / caller (direct reference). This is not a blanket GM-only endpoint. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Reference-authorization denials currently use generic500, not403; preserve or explicitly revise this documented error behavior.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: An owner direct-world request and an active member request to their GM-owned project world generate; unrelated private-world and mismatched project/world requests fail before provider context inclusion.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: 128001-byte body rejected; parser truncates/clamps each documented field and rejects ruleset/UUID enum violations.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Provider absence returns HTTP200 not-configured; output is a draft and no characters row is mutated.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Seventh request inside default window returns429; missing persistent store returns503 before provider use.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Generated story is nonempty and <=12000, and errors do not return provider/API secrets.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

## Acceptance

- [ ] An owner direct-world request and an active member request to their GM-owned project world generate; unrelated private-world and mismatched project/world requests fail before provider context inclusion.
- [ ] 128001-byte body rejected; parser truncates/clamps each documented field and rejects ruleset/UUID enum violations.
- [ ] Provider absence returns HTTP200 not-configured; output is a draft and no characters row is mutated.
- [ ] Seventh request inside default window returns429; missing persistent store returns503 before provider use.
- [ ] Generated story is nonempty and <=12000, and errors do not return provider/API secrets.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-405`
- Design: `.qa/design/migration-issues/stack-migration-mig-405.md`
- Status: blocked
- Reihenfolge: 47; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-047`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-405.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
