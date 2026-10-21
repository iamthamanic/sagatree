<!-- migration-contract:v2 localId=MIG-414 -->
# MIG-414: Port Edge Function `main` to Node host service/adapter

## Type

Task

## Intent

main: Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen.

## Goal

main: Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen. Zielpfade: server/src/http/route-registry.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-main.md, .qa/intake/edge-infra-contracts/source-contracts/edge-main.json.

### Nachher und Verhalten

main: Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen. Zielpfade: server/src/http/route-registry.ts.

## Scope

- Quellpfade: `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: `server/src/http/route-registry.ts`
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

## Security & Data

Resolve /functions/v1/<name>/suffix or /<name>/suffix; no name400. Deny every name outside the explicit eight-worker allowlist and reserved main/_shared, including traversal, with404 BEFORE JWT and worker creation. Allowed non-OPTIONS verifies HS256 with JWT_SECRET unless VERIFY_JWT=false|0|no; allowed worker authenticates end-user separately. Dispatcher-Status: {"kind":"dispatcher","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve exact dispatch boundary until host cutover."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Dispatcher verifies signature and optional exp but not complete JWT claims; worker-side account authentication remains mandatory. Raw exception messages can escape in500 body.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

## Acceptance

- [ ] Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
- [ ] Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
- [ ] Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
- [ ] JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #820 (MIG-404)
- Depends on #821 (MIG-405)
- Depends on #825 (MIG-409)
- Depends on #826 (MIG-410)
- Depends on #828 (MIG-412)
- Depends on #836 (MIG-420)
- Depends on #837 (MIG-421)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-414`
- Design: `.qa/design/migration-issues/stack-migration-mig-414.md`
- Status: blocked
- Reihenfolge: 63; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-063`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-414.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
