# Composition Gate — stack-migration-mig-600 (#845)

- HEAD_SHA: 468ed55c7c15e57e193fad558209235c99a323ea
- BASE_SHA: 8f866c0ad393fbfba127ab28f26dae6e0879f984
- HOP_DIGEST: c7633553172bb5427e9c7347f86ff6c15b9d7114642d8be47da02e9cfa80d0fb
- Date: 2026-10-31
- Verdict: CLEAR
- Note: DONE-evidence sync pins HEAD to squash-merge #1061 on main; hop digest unchanged from implementation CLEAR.

## Event

Host negative authz parity: PolicyService role matrix + secret-marker projections +
membership/filter canary + HTTP `/api/world-touch` allow/deny smoke against real SQLite.
Coverage inventory lists Depends-on successor rows as `open-blocker` (MIG-602 HTTP cutover)
and only marks #845 / #607 as `executed`. Does not claim production cutover.

## Hop chain

1. Producer: `bootstrapHostPersistence` + `seedAuthzFixture` (parity-harness actors)
2. Authorize: `createPermissionsPorts(db).authorize(op, actor, resource)`
3. Project: `projectSessionSnapshot` filters GM secrets for player roles
4. HTTP: `createHostApi` → `POST /api/world-touch` owner allow / outsider deny
5. Canary: disabled filter / always-allow stub must be detectable as fail
6. Consumer: self-test (zod-validated report) + hermetic Browser E2E (temp `MIG600_OUT_DIR`)

## Simulations

### N-actors
owner / gm / player1 / player2 / outsider / otherGm matrix (26 cases) + HTTP world-touch.

### Invalid/missing
Outsider/otherGm denied; owner cannot session.gm; missing membership → deny; forged
client role/owner claims ignored on world-touch.

### Two consumers / crash
Projection canary proves leak detection; coverage forbids silent `parity` status.

## Flags

- Acceptance tier: feature-security
- Deferred integration: per-successor HTTP/RPC cutover → MIG-602/#847; RELEASE → MIG-700 human
- SLICE DONE for host policy + projection + world-touch smoke only
