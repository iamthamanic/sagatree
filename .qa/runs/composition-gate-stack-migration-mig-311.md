# Composition Gate — stack-migration-mig-311 (#810)

- HEAD_SHA: 14aa4ca3525ee9aeff1c1d55aabaa7628d8384c9
- BASE_SHA: 538db0088d7ec1f2a93534436a2f22fd5a3ae68c
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Verified host actor drives session lifecycle/access/runtime/recap via `createSessionPorts` and FE dual-path `createHostSessionAdapter`. Foreign actors receive DENY. Lobby ready remains ephemeral non-authoritative. Media/recap Edge stay unmounted. Supabase session facades remain live default. No public HTTP session infra mount in this slice.

## Hop chain

1. Producer: Session UI / infrastructure session-* services (or host dual-path adapter)
2. Authorize: verified actor id; membership/GM via project ports inside session stores
3. Persist: SQLite play_sessions / session_players / runtime under host single-writer
4. Project: typed session VMs; invite tokens never GM proofs
5. Consumer: `createHost.session` + FE `createHostSessionAdapter`

## Simulations

### N-actors
GM creates play session + invite; player resolves; stranger DENY on create/status/snapshot/mutate/recap.

### Invalid/missing
Unauthenticated / foreign session → typed errors. Lobby spoofed ready userId cannot authorize gameplay.

### Two consumers / crash
Runtime snapshot reload returns membership-scoped state after IMMEDIATE writes.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
