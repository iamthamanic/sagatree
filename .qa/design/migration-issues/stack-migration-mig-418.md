<!-- migration-contract:v2 localId=MIG-418 -->
# MIG-418: Port Edge Function `quests` to Node host service/adapter

## Type

Task

## Intent

quests: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

quests: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/quests/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-quests.md, .qa/intake/edge-infra-contracts/source-contracts/edge-quests.json.

### Nachher und Verhalten

quests: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/quests/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-quests.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-quests.json`

## Security & Data

Dispatcher denies quests with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Unauthenticated quest/project writes and generated quests default to empty projectId; completion does not grant rewards.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für quests und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für quests ausführt
- Dann: quests worker all routes remain404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-quests.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-quests.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für quests und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für quests ausführt
- Dann: Isolated objective completion proves missing objective is no-op and final completed objective changes status; no actual reward/character XP side effect.
- Quelle: `.qa/intake/edge-infra-contracts/edge-quests.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-quests.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für quests und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für quests ausführt
- Dann: Unknown generator type and negative/invalid level require explicit validation before any separately authorized replacement.
- Quelle: `.qa/intake/edge-infra-contracts/edge-quests.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-quests.json`

## Acceptance

- [ ] quests worker all routes remain404.
- [ ] Isolated objective completion proves missing objective is no-op and final completed objective changes status; no actual reward/character XP side effect.
- [ ] Unknown generator type and negative/invalid level require explicit validation before any separately authorized replacement.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-418`
- Design: `.qa/design/migration-issues/stack-migration-mig-418.md`
- Status: blocked
- Reihenfolge: 59; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-059`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-418.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
