# Composition Gate — stack-migration-rpc-atlas-maps (#862)

- HEAD_SHA: b0dbc1afa90dffb352a5e60b824d7b2e6d83d631
- BASE_SHA: 10e0843694c15d51f9f80e88da7e8661cdd280ca
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Atlas map RPC port: WorldPorts → WorldAtlasStore with project saga resolve + active membership gate before party projection; cross-saga DENY (successor fix for RPC-SEC-CROSS-SAGA-REVEAL).

## Hop chain

1. Producer: ensure/list/get/upsert world atlas use-cases
2. Authorize: world owner edit; owner or project.actorCanAccessWorld read
3. Saga party: resolveProjectIdForWorldAndPublicId + isActiveMember before atlas_wb_party_revealed_map_ids projection
4. Persist: world_atlas_maps (+ place/link fixtures for tests); BEGIN IMMEDIATE on upsert CAS
5. Consumer: summary/vm DTO with player redaction parity

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner upsert; player party list; cross-saga 42501 | self-test | pass |
| Invalid/missing | kind/layers/size 22023; CAS 40001; missing P0002 | self-test | pass |
| Legacy root | legacy_tiles when world_maps row exists; stable root id | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → MIG-311; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
