# Composition Gate — stack-migration-rpc-session-access

- HEAD_SHA: 5fd522d36e867e5709f9cd87943c8e26018dfb1f
- BASE_SHA: c3d6f1004545252e9c853fad39d5d76afbbde87f
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Session join/leave/invite with reader membership, presence for members, unique CH- ids.

## Hop chain

1. Producer: session-access use-cases
2. Authorize: auth + ownership + GM invites; presence for members
3. Persist: play_sessions / session_members / session_players / invites
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | join/leave; foreign leave no-op | access store | pass |
| Invalid/missing | tokens / incomplete PC | error codes | pass |
| Two consumers / crash | invite rotate | pass | pass |
| Legacy defects | LEAVE-FOREIGN fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
