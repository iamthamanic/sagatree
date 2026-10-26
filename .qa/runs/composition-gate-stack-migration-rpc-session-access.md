# Composition Gate — stack-migration-rpc-session-access (#869)

- HEAD_SHA: fe84f651ea1d6bc8281a7f4b1352c1f5389f8093
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Host session join/leave/invite with synced runtime revision, co-GM invites,
and character_public_id on resolve.

## Hop chain

1. Producer: session-access use-cases / command barrels
2. Authorize: auth + character ownership + isProjectGm (owner or active gm member)
3. Persist: play_sessions / session_runtime / session_players / session_invites / session_events
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | join; foreign leave no-op; co-GM invite | access + project ports | pass |
| Invalid/missing | incomplete PC / bad token | error codes | pass |
| Two consumers / crash | invite rotate; revision lockstep | pass | pass |
| Legacy defects | LEAVE-FOREIGN + ANON-EVENT-HELPER | fixed/denied | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
