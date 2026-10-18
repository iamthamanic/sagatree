# Composition Gate — atlas-worldbuilder-transaction

- HEAD_SHA: 46ac1afd10b385fc8810bca3e4c74f1c1d0e308f
- Date: 2026-10-18
- Verdict: **CLEAR**

## Event

GM create-world-node request (idempotency key) → single SQL transaction creates missing ancestors + target + primary maps + ledger row.

## Hop chain

1. Client `worldPlaceService.createNodeWithMaps` (JWT assert) → RPC `create_world_node_with_maps`
2. RPC checks authz + kind + optional parent same-world
3. One transaction: ensure world root map → insert placeholders/target → primary map+link each → idempotency insert
4. Retry with same key returns cached JSON; no second inserts

Cardinality: one create event → N nodes/maps inside one transaction (not N client RPCs).

## Simulations

| Case | Intended | Result |
|------|----------|--------|
| N-actors | Two GMs same key different worlds | PK is (world, key) — isolated |
| Invalid/missing | Bad parent / no JWT | Exception, no partial rows |
| Two consumers / crash | Timeout + retry same key | Idempotent cached result |

## Flags

(none)
