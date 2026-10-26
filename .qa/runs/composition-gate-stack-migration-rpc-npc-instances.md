# Composition Gate — stack-migration-rpc-npc-instances

- HEAD_SHA: 021c27bd7383fca2d78d66f1d59e6c4149231ff9
- BASE_SHA: c3d6f1004545252e9c853fad39d5d76afbbde87f
- Date: 2026-10-26
- Verdict: CLEAR

## Event

NPC spawn/update/assign/clear; idempotent temp-controller cleanup to JSON null.

## Hop chain

1. Producer: npc-instance use-cases
2. Authorize: narrow GM + membership + definition readability
3. Persist: npc_creature_instances / controller_assignments
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM spawn/update; foreign denied | store | pass |
| Invalid/missing | empty controller; bad temp | error codes | pass |
| Two consumers / crash | session-scoped clear idempotent | pass | pass |
| Legacy defects | JSON text leak + null cleanup fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 npc adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
