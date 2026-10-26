# Composition Gate — stack-migration-rpc-npc-instances (#877)

- HEAD_SHA: a083d7c9620c05c328787b9bd41b37b0e8753d0f
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Host NPC instance spawn/assign/runtime/remove/clear with project/session guards.

## Hop chain

1. Producer: npc-instances use-cases / command barrels
2. Authorize: narrow GM (gm_user_id + active member) via project ports
3. Persist: npc_creature_* tables (npc-creature-owned)
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM spawn/update; player denied | project ports + store | pass |
| Invalid/missing | foreign session / lite sheet | P0001 | pass |
| Two consumers / crash | clear temp count scoped | pass | pass |
| Legacy defects | none required | n/a | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-301..313 / MIG-311 session adapters as applicable

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
