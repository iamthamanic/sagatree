# Composition Gate — stack-migration-rpc-saga-projections

- HEAD_SHA: ee847a6e94514e0e762b65abf850f0431c2aa6cb
- BASE_SHA: a9948455cd76ea2c21ba66879a6ab40d7616f877
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Saga overview / lore timeline / outcome promote with membership and world-owner gates.

## Hop chain

1. Producer: saga-projections use-cases
2. Authorize: project membership / GM; lore ACL; world owner for world promote
3. Persist: saga draft facts via saga store; worlds.payload via world port; session_outcome_promotions + session_events via session outcome port (no revision bump)
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM full; player projected | projections store | pass |
| Invalid/missing | stranger / missing consequence | error codes | pass |
| Two consumers / crash | idempotent promote | pass | pass |
| Legacy defects | no public append_session_event | pass | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-311 session adapters

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
