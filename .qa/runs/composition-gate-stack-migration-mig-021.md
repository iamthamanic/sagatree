# Composition Gate — stack-migration-mig-021 (#796)

- HEAD_SHA: 206886b0572fad606e13ee6147d57044a7f969a1
- BASE_SHA: 5c94e0f83d20fc7e5eb7ac7c28f390efe0662c7c
- HOP_DIGEST: 1cc7b6de0f59f8354cdaf69031d168ab452965826960ac4942d71e3e39912a55
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Clients join/resync via host HTTP `/realtime/*` (createHost → createHostApi). Host derives projection role from `session_members.can_write`, loads durable snapshot + events since clientRevision, projects via MIG-024, fans out commits to occupants via onFanout.

## Hop chain

1. Producer: Session runtime commit (`onCommitted` in createHost)
2. Authorize: Current session membership (re-checked; room id not authority)
3. Project: `server/src/projections` with server-derived role
4. Consumer: Occupant fan-out + HTTP sync (bootstrap/create-app call sites)

## Simulations

### N-actors
GM/P1/P2 reconnect at different revisions; claimed `role: gm` on a reader stays player.

### Invalid/missing
Stranger, revoked member, mismatched room id FORBIDDEN.

### Two consumers / crash
After host restart, resync reconstructs confirmed revisions; onCommitted fans out to joined occupants.

## Flags

- Acceptance tier: host-integration
- Deferred integration: Full Colyseus Room schema packaging → FEATURE VERIFIED via MIG-602/#847; legacy adapters MIG-311/#810
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

None.
