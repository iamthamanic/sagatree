<!-- migration-contract:v2 localId=MIG-412 -->
# MIG-412: Port Edge Function `look-reference-analysis` to Node host service/adapter

## Type

Task

## Intent

look-reference-analysis: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

look-reference-analysis: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/look-reference-analysis/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/look/look-reference-analysis-service.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/look-reference-analysis-image.ts, supabase/functions/_shared/look-reference-analysis-provider.ts, supabase/functions/_shared/look-reference-analysis-rate-limit.ts, supabase/functions/look-reference-analysis/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-look-reference-analysis.md, .qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json.

### Nachher und Verhalten

look-reference-analysis: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/look-reference-analysis/.

## Scope

- Quellpfade: `src/infrastructure/look/look-reference-analysis-service.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/look-reference-analysis-image.ts`, `supabase/functions/_shared/look-reference-analysis-provider.ts`, `supabase/functions/_shared/look-reference-analysis-rate-limit.ts`, `supabase/functions/look-reference-analysis/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/application/look-reference-analysis/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-look-reference-analysis.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json`

## Security & Data

look-reference-analysis: Authenticated user; storage references must normalize to caller userId/ prefix and contain neither '..' nor backslash. Arbitrary URI is metadata only: image bytes come from inline base64 or the configured storage bucket. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Envelope size limit trusts Content-Length; nested secret-like provider keys are not recursively removed.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für look-reference-analysis und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look-reference-analysis ausführt
- Dann: 1 and10 valid images accepted; 0/11 images, duplicate IDs, unsupported MIME, invalid weights and absent bytes/storage rejected400.
- Quelle: `.qa/intake/edge-infra-contracts/edge-look-reference-analysis.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für look-reference-analysis und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look-reference-analysis ausführt
- Dann: Foreign-user path, traversal and backslash cannot cause storage fetch; inline bytes override storagePath when both present.
- Quelle: `.qa/intake/edge-infra-contracts/edge-look-reference-analysis.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für look-reference-analysis und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look-reference-analysis ausführt
- Dann: Fifth request in default worker window429; process restart behavior explicitly recorded as memory-only.
- Quelle: `.qa/intake/edge-infra-contracts/edge-look-reference-analysis.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für look-reference-analysis und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look-reference-analysis ausführt
- Dann: Provider absence200 not-configured; successful payload strips top-level secret-like keys and never persists a LookProfile.
- Quelle: `.qa/intake/edge-infra-contracts/edge-look-reference-analysis.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-look-reference-analysis.json`

## Acceptance

- [ ] 1 and10 valid images accepted; 0/11 images, duplicate IDs, unsupported MIME, invalid weights and absent bytes/storage rejected400.
- [ ] Foreign-user path, traversal and backslash cannot cause storage fetch; inline bytes override storagePath when both present.
- [ ] Fifth request in default worker window429; process restart behavior explicitly recorded as memory-only.
- [ ] Provider absence200 not-configured; successful payload strips top-level secret-like keys and never persists a LookProfile.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-412`
- Design: `.qa/design/migration-issues/stack-migration-mig-412.md`
- Status: blocked
- Reihenfolge: 54; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-054`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-412.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
