# Composition Gate — stack-migration-rpc-world-map (#861)

- HEAD_SHA: 1e030b67b35b8a8ebdfcd8c86d50a403c0daeea6
- BASE_SHA: 12cc8db0ede3f03f270a5d6d5a070abdc8673231
- Date: 2026-10-25
- Verdict: CLEAR

## Event

World map get/save: Actor → WorldPorts.getWorldMap/saveWorldMap → world_maps row with CAS revision. Player projection filters undiscovered pins by edit rights (not client flag).

## Hop chain

1. Producer: get_world_map / save_world_map use-cases
2. Authorize: world owner edit; owner or project member/GM read
3. Persist: world_maps (module world); CAS on expectedRevision ≥ 0
4. Consumer: DTO projection (full for editor; pin-filtered for non-editor)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner save; player read filtered; stranger deny | self-test | pass |
| Invalid/missing | size/pin validation 22023; missing world P0002; CAS 40001 | self-test | pass |
| Two consumers / crash | conflict leaves prior revision; null/-1 bypass | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → later MIG; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
