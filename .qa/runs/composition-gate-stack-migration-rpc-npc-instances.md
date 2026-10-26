# Composition Gate — stack-migration-rpc-npc-instances

- HEAD_SHA: a02f522379379623afe393191255044fe6ffe113
- BASE_SHA: c3d6f1004545252e9c853fad39d5d76afbbde87f
- Date: 2026-10-26
- Verdict: CLEAR

## Event

NPC spawn/update/assign/clear with decoded JSON rows and strict controller IDs.

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
| Two consumers / crash | session-scoped clear | pass | pass |
| Legacy defects | JSON text leak fixed | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 npc adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
