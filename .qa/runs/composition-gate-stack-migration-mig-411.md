# Composition Gate — stack-migration-mig-411 (#827)

- HEAD_SHA: dc5d0fb56346a9f70e8d6029ba9ff2ae0006b098
- BASE_SHA: dbe2e713daed52f4a688867a3fe58d2e19a2a440
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy items Map catalog stays unmounted; quarantine fixtures characterize defaults/filters/generate without coupling to durable inventory_item_definitions.

## Hop chain

1. Producer: none
2. Authorize: N/A — deny-by-default + `ITEMS_PUBLIC_ACTIVATION_AUTHORIZED=false`
3. Persist: none (in-memory Map only)
4. Consumer: self-test createRouteHandler probes only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Public path stays 404 | createRouteHandler | pass |
| Invalid/missing | Untyped nested/weight accepted | applyItemDefaults | pass |
| Two consumers / crash | Map ≠ durable definitions | flags; no TABLE_OWNERSHIP ban | pass |
| Legacy defects | No auth/schema; full seed; RNG order | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; no automatic public activation

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
