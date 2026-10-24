# Composition Gate — stack-migration-mig-024 (#799)

- HEAD_SHA: 948fbc55d5920b702e83a25ad80c55bd19ab1622
- BASE_SHA: 301ee2e6d54d79dfe7715de6fd6383f2ff84541c
- HOP_DIGEST: 1f0e5b7f0bc36fe817e99ca8888bf04c5be19f25639973eca4930c8684231fb6
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Session snapshot/delta/event payloads pass through `projectSessionSnapshot` / `projectValue` before HTTP/WS serialization. Transport `projectFor` uses the same filter. Role + reveal grants determine visible objects; gm_only/secret keys are stripped recursively.

## Hop chain

1. Producer: Host session/query use-case (`application/transport`)
2. Authorize: Actor role (gm/player/spectator) + membership (Policy Service)
3. Project: `server/src/projections` filter
4. Consumer: Transport serializers / clients (never trust client filters)

## Simulations

### N-actors
GM, P1, P2, spectator receive distinct object sets for the same revision.

### Invalid/missing
Revoked reveals remove previously visible secrets; gm-only events absent.

### Two consumers / crash
Filter is pure/stateless; disabling it fails the secret-marker canary. Transport still omits gmNotes for players.

## Flags

None.
