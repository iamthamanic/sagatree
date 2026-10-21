<!-- migration-contract:v2 localId=MIG-420 -->
# MIG-420: Port Edge Function `session-media-token` to Node host service/adapter

## Type

Task

## Intent

session-media-token: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

session-media-token: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/session-media-token/.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/session/media/media-token-client.ts, supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/_shared/session-media-token.ts, supabase/functions/main/index.ts, supabase/functions/session-media-token/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-session-media-token.md, .qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json.

### Nachher und Verhalten

session-media-token: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/session-media-token/.

## Scope

- Quellpfade: `src/infrastructure/session/media/media-token-client.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/session-media-token.ts`, `supabase/functions/main/index.ts`, `supabase/functions/session-media-token/index.ts`
- Änderbare Zielpfade: `server/src/application/session-media-token/`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-session-media-token.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json`

## Security & Data

session-media-token: /auth/v1/user identity -> sessions.project_id -> project_members(status=active,user_id=caller). Actual code has no session_players fallback despite its comment. Roles gm->gamemaster and observer->viewer; unsupported role denied. Capabilities are loaded as null/empty, not trusted from client. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No explicit fetch timeout, no worker-wide exception normalization, no finite TTL guard; source verification does not approve those gaps.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für session-media-token und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-media-token ausführt
- Dann: Distinct active player/GM/viewer accounts receive only server-derived room/identity/grants; foreign account403 and caller-supplied role/capabilities/room ignored.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-media-token.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für session-media-token und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-media-token ausführt
- Dann: Decode JWT and verify HS256 signature, iss/sub/nbf/iat/exp plus room; TTL omitted120,1->30,999->300.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-media-token.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für session-media-token und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-media-token ausführt
- Dann: No project_members row403 even if legacy session_players fixture exists; inactive member403.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-media-token.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für session-media-token und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-media-token ausführt
- Dann: Missing LIVEKIT_URL/API_KEY/API_SECRET503 degraded and no secret values in response; gameplay state unchanged.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-media-token.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-media-token.json`

## Acceptance

- [ ] Distinct active player/GM/viewer accounts receive only server-derived room/identity/grants; foreign account403 and caller-supplied role/capabilities/room ignored.
- [ ] Decode JWT and verify HS256 signature, iss/sub/nbf/iat/exp plus room; TTL omitted120,1->30,999->300.
- [ ] No project_members row403 even if legacy session_players fixture exists; inactive member403.
- [ ] Missing LIVEKIT_URL/API_KEY/API_SECRET503 degraded and no secret values in response; gameplay state unchanged.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #791 (MIG-012)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-420`
- Design: `.qa/design/migration-issues/stack-migration-mig-420.md`
- Status: blocked
- Reihenfolge: 61; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-061`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-420.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
