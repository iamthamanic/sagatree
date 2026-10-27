# Composition Gate — stack-migration-rpc-world-places (#863)

- HEAD_SHA: PENDING_COMMIT
- BASE_SHA: 5412470de778fe753e3144a2874234f733151d42
- Date: 2026-10-27
- Verdict: CLEAR

## Event

World places RPC port: WorldPorts → WorldPlacesStore with project saga resolve + active membership gate before party projection; cross-saga DENY (successor fix for RPC-SEC-CROSS-SAGA-REVEAL). Schema expand via `0021_world_places.sql` after atlas stub tables in 0020.

## Hop chain

1. Producer: list/upsert world place + map-link use-cases
2. Authorize: world owner edit; owner or project.actorCanAccessWorld read
3. Saga party: resolveProjectIdForWorldAndPublicId + isActiveMember/GM before party place/link projection
4. Persist: world_places + world_place_map_links; BEGIN IMMEDIATE on upsert; same-world/cycle/primary uniqueness
5. Consumer: WorldPlaceVm / WorldPlaceMapLinkVm DTOs (party bindingReveal/bindingAssetId)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner upsert; player party list; cross-saga 42501 | self-test | pass |
| Invalid/missing | empty name 22023; foreign parent/map 23514/22023; missing P0002 | self-test | pass |
| Two consumers / crash | Link upsert same place/map/usage keeps one id; second primary 23505 | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → MIG-311; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
