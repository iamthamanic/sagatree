# Composition Gate — stack-migration-rpc-session-access

- HEAD_SHA: d7f5c091b318b836d33156f38943bc471ad69863
- BASE_SHA: c3d6f1004545252e9c853fad39d5d76afbbde87f
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Session join/leave/invite; reader presence bound to authenticated actor.

## Hop chain

1. Producer: session-access / runtime use-cases
2. Authorize: auth + ownership + GM invites; presence only for own userId
3. Persist: play_sessions / session_members / session_players / invites
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | join/leave; forge presence denied | access+runtime | pass |
| Invalid/missing | tokens / incomplete PC | error codes | pass |
| Two consumers / crash | invite rotate | pass | pass |
| Legacy defects | LEAVE-FOREIGN + forge presence fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
