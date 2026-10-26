# Composition Gate — stack-migration-rpc-session-access (#869)

- HEAD_SHA: 1327594f2a9ffa5d50f6b52f83b6a3b2b7bf302b
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Host session join/leave/invite access with roster+revision events and GM invite rotation.

## Hop chain

1. Producer: session-access use-cases / command barrels
2. Authorize: auth + character ownership + GM for invites; foreign leave no-op
3. Persist: play_sessions / session_players / session_invites / session_events (session-owned)
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | join member; foreign leave no-op | access store | pass |
| Invalid/missing | incomplete PC / bad token / completed | error codes | pass |
| Two consumers / crash | invite rotate revokes prior | pass | pass |
| Legacy defects | LEAVE-FOREIGN + ANON-EVENT-HELPER | fixed/denied | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
