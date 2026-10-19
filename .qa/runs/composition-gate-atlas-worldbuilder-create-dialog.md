# Composition Gate — atlas-worldbuilder-create-dialog

- HEAD_SHA: fdecf206198281be506de2c195dd02d6493f1974
- BASE_SHA: 61dca061ac31268cd3d7818caa28fe4945f36b6c
- Date: 2026-10-19
- Verdict: CLEAR

## Event

Editor clicks + → preview plan → confirm → createNodeWithMaps RPC → open primary map.

## Hop chain

1. CreateWorldNodeDialog planWorldNodeCreate (domain)
2. worldPlaceService.createNodeWithMaps (JWT)
3. RPC create_world_node_with_maps transaction
4. onCreated → setActiveMapId + reload placeNav

## Simulations

| Case | Intended | Result |
|------|----------|--------|
| N-actors | Two editors | world-scoped idempotency keys |
| Invalid/missing | Empty name / bad tip | no RPC / error text |
| Two consumers / crash | Retry same key | idempotent create |

## Flags

(none)
