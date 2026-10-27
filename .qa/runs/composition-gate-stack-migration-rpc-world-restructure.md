# Composition Gate — stack-migration-rpc-world-restructure (#865)

- HEAD_SHA: TBD_AFTER_COMMIT
- BASE_SHA: 685ae1c291d6d27c6af6097be7566e01872de77b
- Date: 2026-10-27
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

World restructure RPC port: WorldPorts → WorldPlacesStore.reparentWorldNode / duplicateWorldNode with owner-only edit, cycle/parent-kind guards, transactional place+map relocate, shallow/deep duplicate with local id map.

## Hop chain

1. Producer: reparent_world_node / duplicate_world_node use-cases
2. Authorize: world owner edit only (42501 for strangers)
3. Guards: confirm relocate; self/descendant cycle; tipSatisfies parent kind; foreign parent 23514
4. Persist: world_places + world_atlas_maps (unlocated) / deep copy inserts under BEGIN IMMEDIATE
5. Consumer: ReparentWorldNodeResult / DuplicateWorldNodeResult DTOs

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner reparent/duplicate; stranger 42501 | self-test | pass |
| Invalid/missing | no confirm 22023; cycle/bad edge/foreign 23514 without partial move | self-test | pass |
| Two consumers / crash | parallel deep duplicates yield disjoint place IDs; local id map not shared | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → MIG-311; FEATURE → MIG-602/#847

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
