# Composition Gate — stack-migration-rpc-world-create (#864)

- HEAD_SHA: 907c5521c129f93539b9be60802249d4ce54599c
- BASE_SHA: 63963d865fc67baee7141cbf999936aeb052bfa7
- Date: 2026-10-27
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

World create/rename RPC port: WorldPorts → WorldPlacesStore.createWorldNodeWithMaps / renameWorldNode with owner-only edit, canonical hierarchy helpers, idempotency ledger (`0022_world_node_create.sql`), transactional ancestor+primary-map creation.

## Hop chain

1. Producer: create_world_node_with_maps / rename_world_node use-cases
2. Authorize: world owner edit only (42501 for strangers)
3. Hierarchy: missingAncestorChain + tipSatisfies (SQL atlas_wb_* parity)
4. Persist: world_places + world_atlas_maps + world_place_map_links + world_node_create_idempotency under BEGIN IMMEDIATE
5. Consumer: CreateWorldNodeResult / WorldPlaceVm DTOs

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner create/rename; stranger 42501 | self-test | pass |
| Invalid/missing | empty name/kind 22023; foreign/invalid parent 23514; missing P0002 | self-test | pass |
| Two consumers / crash | same idempotency key returns cached IDs; no extra places/maps (counts asserted) | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → MIG-311; FEATURE → MIG-602/#847

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
