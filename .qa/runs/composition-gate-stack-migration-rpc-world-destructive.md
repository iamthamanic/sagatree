# Composition Gate — stack-migration-rpc-world-destructive (#866)

- HEAD_SHA: 2775e55cd91ba2e7ff2dc84ba55797c88720ef41
- BASE_SHA: e626ce61123ff869d7036a28518300038fe1eee0
- Date: 2026-10-27
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

World destructive RPC port: WorldPorts → WorldPlacesStore.previewWorldNodeConsequences / archiveWorldNodeSubtree / deleteWorldNode with owner-only edit, confirm gates under write lock, transactional archive/delete + saga binding nulling, exclusive-map delete with shared-map preserve (RPC-DATA-SHARED-MAP-DELETE corrective).

## Hop chain

1. Producer: preview_world_node_consequences / archive_world_node_subtree / delete_world_node use-cases
2. Authorize: world owner edit only (42501 for strangers)
3. Guards: missing place P0002; requiresConfirm without confirm → 22023 — revalidated after BEGIN IMMEDIATE for mutations
4. Persist: archive status+revision; delete places/links; null saga_asset_bindings.world_place_id; delete maps only when no remaining links (preserve shared)
5. Consumer: Preview / Archive / Delete result DTOs including preservedSharedMapIds

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner preview/archive/delete; stranger 42501 | self-test | pass |
| Invalid/missing | no confirm 22023; place missing P0002; no partial mutation | self-test | pass |
| Two consumers / crash | sequential delete of shared-map sibling preserves map; exclusive maps removed | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → MIG-311; FEATURE → MIG-602/#847
- Corrective vs legacy: RPC-DATA-SHARED-MAP-DELETE → preserve shared maps (no silent wipe parity)

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
