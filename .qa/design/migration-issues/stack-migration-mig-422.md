<!-- migration-contract:v2 localId=MIG-422 -->
# MIG-422: Port Edge Function `sessions` to Node host service/adapter

## Type

Task

## Intent

sessions: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

sessions: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/sessions/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-sessions.md, .qa/intake/edge-infra-contracts/source-contracts/edge-sessions.json.

### Nachher und Verhalten

sessions: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/sessions/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-sessions.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-sessions.json`

## Security & Data

sessions: Dispatcher denies sessions with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No membership/GM/owner validation; body spreads can alter session authority/state. In-memory numbering/chat/savepoints do not provide durable or concurrent runtime guarantees.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für sessions und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für sessions ausführt
- Dann: All sessions methods,including world-state and import, remain dispatcher404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-sessions.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-sessions.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für sessions und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für sessions ausführt
- Dann: Isolated fixture verifies per-Map numbering,start/pause/end,chat limits and save/load object shapes; another worker/process loses these records.
- Quelle: `.qa/intake/edge-infra-contracts/edge-sessions.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-sessions.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für sessions und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für sessions ausführt
- Dann: Body userId,type:dm and arbitrary world-state are not authority; current create_play_session/apply_session_runtime_command transport must not call this worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-sessions.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-sessions.json`

## Acceptance

- [ ] All sessions methods,including world-state and import, remain dispatcher404.
- [ ] Isolated fixture verifies per-Map numbering,start/pause/end,chat limits and save/load object shapes; another worker/process loses these records.
- [ ] Body userId,type:dm and arbitrary world-state are not authority; current create_play_session/apply_session_runtime_command transport must not call this worker.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-422`
- Design: `.qa/design/migration-issues/stack-migration-mig-422.md`
- Status: blocked
- Reihenfolge: 64; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-064`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-422.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
