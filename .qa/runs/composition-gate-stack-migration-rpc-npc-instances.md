# Composition Gate — stack-migration-rpc-npc-instances

- HEAD_SHA: fe2b040480fd61790828710e9c6cbac75dd1ec24
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

NPC instances with injected session lookup and world ACL via project ports.

## Hop chain

1. Producer: application use-cases / command barrels
2. Authorize: project/session ports + actor guards
3. Persist: owning module tables
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | authorized vs denied | ports + store | pass |
| Invalid/missing | contract errors | P0001/error_codes | pass |
| Two consumers / crash | scoped/atomic | pass | pass |
| Legacy defects | DENY / fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
