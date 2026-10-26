# Composition Gate — stack-migration-rpc-session-access

- HEAD_SHA: 03bbf26d35d96953a72a949b9984b0a109be11e9
- BASE_SHA: 71e6248ed7a9091db7d311f5049d1bb2e513270a
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Session join/leave/invite with roster sync, CH- public ids, can_write on join.

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
