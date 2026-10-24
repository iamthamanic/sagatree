# Composition Gate — stack-migration-mig-021 (#796)

- HEAD_SHA: c02d028c27e595947204201b96d4b26fbb6ca258
- BASE_SHA: 5c94e0f83d20fc7e5eb7ac7c28f390efe0662c7c
- HOP_DIGEST: 1cc7b6de0f59f8354cdaf69031d168ab452965826960ac4942d71e3e39912a55
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Clients join/resync via host HTTP `/realtime/*` (and Colyseus adapters later). Host derives projection role from `session_members.can_write`, loads durable snapshot + events since clientRevision, projects via MIG-024, fans out commits to occupants.

## Hop chain

1. Producer: Session runtime commit (`onCommitted`)
2. Authorize: Current session membership (re-checked; room id not authority)
3. Project: `server/src/projections` with server-derived role
4. Consumer: Occupant fan-out / HTTP sync clients

## Simulations

### N-actors
GM/P1/P2 reconnect at different revisions; claimed `role: gm` on a reader stays player.

### Invalid/missing
Stranger, revoked member, mismatched room id FORBIDDEN.

### Two consumers / crash
After host restart, resync reconstructs confirmed revisions; onCommitted fans out to joined occupants.

## Flags

None.
