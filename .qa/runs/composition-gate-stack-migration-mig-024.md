# Composition Gate — stack-migration-mig-024 (#799)

- HEAD_SHA: 09bac7cd4935a8f6132c3f462fc5ab44566f9315
- BASE_SHA: 301ee2e6d54d79dfe7715de6fd6383f2ff84541c
- HOP_DIGEST: 12a74bf11301fd7703ba74ecc3caede8952c6775efb82360d86aceb8adb3d225
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Session snapshot/delta/event payloads pass through `projectSessionSnapshot` before HTTP/WS serialization. Role + reveal grants determine visible objects; gm_only/secret keys are stripped recursively.

## Hop chain

1. Producer: Host session/query use-case
2. Authorize: Actor role (gm/player/spectator) + membership
3. Project: `server/src/projections` filter
4. Consumer: Transport serializers / clients (never trust client filters)

## Simulations

### N-actors
GM, P1, P2, spectator receive distinct object sets for the same revision.

### Invalid/missing
Revoked reveals remove previously visible secrets; gm-only events absent.

### Two consumers / crash
Filter is pure/stateless; disabling it fails the secret-marker canary.

## Flags

None.
