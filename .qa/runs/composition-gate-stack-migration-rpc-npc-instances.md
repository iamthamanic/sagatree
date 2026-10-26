# Composition Gate — stack-migration-rpc-npc-instances

- HEAD_SHA: 2550270dcccb99465ee62de5a04ea05d016aae4f
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

NPC instances with injected session + world read ports (owner ACL without foreign SQL in store).

## Hop chain

1. Producer: npc-instances use-cases
2. Authorize: narrow GM + injected world/session lookups
3. Persist: npc_creature_* tables
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM vs player | ports | pass |
| Invalid/missing | foreign def / session | P0001 | pass |
| Two consumers / crash | atomic clear | pass | pass |
| Legacy defects | n/a | pass | pass |

## Flags

- Acceptance tier: isolated-contract

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
