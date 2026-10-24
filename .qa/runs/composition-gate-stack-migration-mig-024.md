# Composition Gate — stack-migration-mig-024 (#799)

- HEAD_SHA: 7793d139f78eb189ceee3b1106cef42147c7793e
- BASE_SHA: 301ee2e6d54d79dfe7715de6fd6383f2ff84541c
- HOP_DIGEST: 61c3f205c06dbede769012bddd37027f393d831eb9eadca969629680cd408d2d
- Date: 2026-10-24
- Verdict: CLEAR

## Event

HTTP transport and session snapshot envelopes pass through `projectSessionSnapshot` before serialization. Spectators stay public-only; id-less gm-only containers are dropped; events use an event visibility predicate (not object reveal grants).

## Hop chain

1. Producer: Host session/query use-case (`application/transport`)
2. Authorize: Actor role (gm/player/spectator) + membership (Policy Service)
3. Project: `server/src/projections` (`projectSessionSnapshot`)
4. Consumer: Transport serializers / clients (never trust client filters)

## Simulations

### N-actors
GM, P1, P2, spectator receive distinct object sets for the same revision.

### Invalid/missing
Revoked reveals remove previously visible secrets; gm-only events absent; id-less gm-only bags dropped.

### Two consumers / crash
Filter is pure/stateless; disabling it fails the secret-marker canary.

## Flags

None.
