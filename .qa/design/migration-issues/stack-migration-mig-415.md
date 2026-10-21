<!-- migration-contract:v2 localId=MIG-415 -->
# MIG-415: Port Edge Function `marketplace` to Node host service/adapter

## Type

Task

## Intent

marketplace: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

marketplace: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/marketplace/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-marketplace.md, .qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json.

### Nachher und Verhalten

marketplace: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/marketplace/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

## Security & Data

Dispatcher denies marketplace with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Rating average uses downloads as vote count and accepts unbounded caller rating; no author/owner authorization or persistence.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: marketplace worker stays404 including download/rate.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

## Acceptance

- [ ] marketplace worker stays404 including download/rate.
- [ ] Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
- [ ] Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-415`
- Design: `.qa/design/migration-issues/stack-migration-mig-415.md`
- Status: blocked
- Reihenfolge: 56; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-056`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-415.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
