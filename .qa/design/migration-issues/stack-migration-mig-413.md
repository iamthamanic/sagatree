<!-- migration-contract:v2 localId=MIG-413 -->
# MIG-413: Port Edge Function `lorekeeper` to Node host service/adapter

## Type

Task

## Intent

lorekeeper: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

lorekeeper: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/lorekeeper/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-lorekeeper.md, .qa/intake/edge-infra-contracts/source-contracts/edge-lorekeeper.json.

### Nachher und Verhalten

lorekeeper: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/lorekeeper/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-lorekeeper.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-lorekeeper.json`

## Security & Data

lorekeeper: Dispatcher denies lorekeeper with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- getSessionContext returns every NPC/location/event regardless of requested session/project; only memories filter sessionId. getNPCContext accepts sessionId but ignores it. No auth or GM visibility filter.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für lorekeeper und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für lorekeeper ausführt
- Dann: Graph,context,NPC and consistency routes remain dispatcher404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-lorekeeper.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-lorekeeper.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für lorekeeper und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für lorekeeper ausführt
- Dann: Isolated graph traversal and missing-root results match source; edge endpoint existence is enforced by createRelationship.
- Quelle: `.qa/intake/edge-infra-contracts/edge-lorekeeper.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-lorekeeper.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für lorekeeper und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für lorekeeper ausführt
- Dann: Record session-context all-node scan and ignored NPC session filter; any retained role-safe projection must filter before response/provider enrichment.
- Quelle: `.qa/intake/edge-infra-contracts/edge-lorekeeper.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-lorekeeper.json`

## Acceptance

- [ ] Graph,context,NPC and consistency routes remain dispatcher404.
- [ ] Isolated graph traversal and missing-root results match source; edge endpoint existence is enforced by createRelationship.
- [ ] Record session-context all-node scan and ignored NPC session filter; any retained role-safe projection must filter before response/provider enrichment.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-413`
- Design: `.qa/design/migration-issues/stack-migration-mig-413.md`
- Status: blocked
- Reihenfolge: 55; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-055`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-413.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
