# Composition Gate — stack-migration-mig-408 (#824)

- HEAD_SHA: 51a1f1d8049aa2950b7fa695d0a2da35428aa0f8
- BASE_SHA: 313df17aa088d4673605296a3ec1f725945d6d6a
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy export stays unmounted; format conversion quarantine fixtures (incl. falsy || defaults) and live 404 probes without a public HTTP mount or import persistence.

## Hop chain

1. Producer: none (no public request path)
2. Authorize: N/A — dispatcher deny-by-default + `EXPORT_PUBLIC_ACTIVATION_AUTHORIZED=false`
3. Persist: none (import parse only; persisted=false)
4. Consumer: self-test createRouteHandler probes only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Public path stays 404 | createRouteHandler probes | pass |
| Invalid/missing | Invalid format / Invalid JSON | 400 results | pass |
| Two consumers / crash | Import not persisted; activation denied | flags | pass |
| Legacy defects | Arbitrary content; falsy || defaults; minimal PDF | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; no automatic public activation

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
