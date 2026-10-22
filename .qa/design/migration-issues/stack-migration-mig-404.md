<!-- migration-contract:v2 localId=MIG-404 -->
# MIG-404: Port Edge Function `character-avatar-meshy` to Node host service/adapter

## Type

Task

## Intent

character-avatar-meshy: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

character-avatar-meshy: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-avatar-meshy/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/character/avatar/character-avatar-meshy-service.ts, supabase/functions/_shared/ai-provider-crypto.ts, supabase/functions/_shared/ai-provider-resolve-meshy.ts, supabase/functions/_shared/avatar-3d-generation.ts, supabase/functions/_shared/avatar-meshy-rate-limit.ts, supabase/functions/_shared/avatar-meshy-remesh.ts, supabase/functions/_shared/avatar-meshy-rigging.ts, supabase/functions/_shared/avatar-meshy-text-to-3d.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/item-model3d-glb.ts, supabase/functions/_shared/item-model3d-meshy.ts, supabase/functions/character-avatar-meshy/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md, .qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json.

### Nachher und Verhalten

character-avatar-meshy: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-avatar-meshy/.

## Scope

- Quellpfade: `src/infrastructure/character/avatar/character-avatar-meshy-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-resolve-meshy.ts`, `supabase/functions/_shared/avatar-3d-generation.ts`, `supabase/functions/_shared/avatar-meshy-rate-limit.ts`, `supabase/functions/_shared/avatar-meshy-remesh.ts`, `supabase/functions/_shared/avatar-meshy-rigging.ts`, `supabase/functions/_shared/avatar-meshy-text-to-3d.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/item-model3d-glb.ts`, `supabase/functions/_shared/item-model3d-meshy.ts`, `supabase/functions/character-avatar-meshy/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/character-avatar-meshy/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

## Security & Data

character-avatar-meshy: Authenticate via /auth/v1/user; jobs are read by owner_user_id. Optional characterId resolves only caller-owned character, otherwise null. Keys resolved from caller BYOK credential. Storage read/sign requires normalized caller userId/ prefix. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- start creates provider task before DB insert; replay key uses prompt length rather than content hash. Equal-length changed input may collide and concurrent starts may orphan a paid provider task. Successor cutover requires an explicit tested idempotency/compensation decision; current worker is allowlisted.
- meshyConfigured can be true from an active credential row without proving successful decryption; config is availability metadata, not a verified provider request. Avatar image validation checks data-URI grammar and approximate byte count, not decoded image magic.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Owner start/poll/retry works without project membership; account X jobId returns404 and cannot sign owner storage path.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Text8..500, nonce1..80,4MiB image and settings enums enforced; unsupported provider rejects400.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Identical start key replays existing own row, but third start attempt inside60s is429 even if replay; do not claim durable quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Two concurrent polls do not both start remesh/rig task; retry with existing provider task resumes without paid create.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Provider failure is a provider_unavailable pseudo-job, missing provider not-configured; all GLB downloads/paths obey allowlist and size limits.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

## Acceptance

- [ ] Owner start/poll/retry works without project membership; account X jobId returns404 and cannot sign owner storage path.
- [ ] Text8..500, nonce1..80,4MiB image and settings enums enforced; unsupported provider rejects400.
- [ ] Identical start key replays existing own row, but third start attempt inside60s is429 even if replay; do not claim durable quota.
- [ ] Two concurrent polls do not both start remesh/rig task; retry with existing provider task resumes without paid create.
- [ ] Provider failure is a provider_unavailable pseudo-job, missing provider not-configured; all GLB downloads/paths obey allowlist and size limits.
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

- Feature slug: `stack-migration-mig-404`
- Design: `.qa/design/migration-issues/stack-migration-mig-404.md`
- Status: blocked
- Reihenfolge: 46; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-046`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-404.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
