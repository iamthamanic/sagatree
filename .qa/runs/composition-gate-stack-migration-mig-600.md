# Composition Gate — stack-migration-mig-600 (#845)

- HEAD_SHA: 864c2ad3d05df18c2438a41e8f95495773affca0
- BASE_SHA: 8f866c0ad393fbfba127ab28f26dae6e0879f984
- HOP_DIGEST: 6dd0b7d138071a02d4a94835674311ee976f243d71850d649ae1e174ad5d75b0
- Date: 2026-10-31
- Verdict: CLEAR

## Event

Host negative authz parity suite: PolicyService role matrix + secret-marker projections +
membership/filter canary against real SQLite. Coverage inventory lists every Depends-on row
as executed-with-open-blocker (HTTP publicActivation → MIG-602) or Compose #607 executed.
Does not claim production cutover.

## Hop chain

1. Producer: `bootstrapHostPersistence` + `seedAuthzFixture` (parity-harness actors)
2. Authorize: `createPermissionsPorts(db).authorize(op, actor, resource)`
3. Project: `projectSessionSnapshot` filters GM secrets for player roles
4. Canary: disabled filter / always-allow stub must be detectable as fail
5. Consumer: self-test + Browser E2E spec assert report.ok + coverage honesty

## Simulations

### N-actors
owner / gm / player1 / player2 / outsider / otherGm matrix (26 cases).

### Invalid/missing
Outsider/otherGm denied; owner cannot session.gm; missing membership → deny.

### Two consumers / crash
N/A for isolated-contract policy suite; projection canary proves leak detection without HTTP.

## Flags

- Acceptance tier: feature-security
- Deferred integration: HTTP publicActivation → MIG-602/#847; RELEASE → MIG-700 human
- SLICE DONE / FEATURE VERIFIED for host policy+projection parity only
