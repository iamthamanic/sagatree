# Composition Gate — stack-migration-rpc-session-access

- HEAD_SHA: b44aa221342626423009867b306cb4337be88a45
- BASE_SHA: 33a52ad691b9c25f5aec80ce0c12fbd037356450
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Session join/leave/invite; presence bound to actor and synced to session_players.

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
| Two consumers / crash | invite rotate; presence sync | pass | pass |
| Legacy defects | LEAVE-FOREIGN + stale presence fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
