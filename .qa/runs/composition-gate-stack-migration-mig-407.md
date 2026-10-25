# Composition Gate — stack-migration-mig-407 (#823)

- HEAD_SHA: 6befdb39ead90b81416d02180068a750c97dfcd4
- BASE_SHA: d2d5d0e57daf77d9d18bdc484de7e96ec0d11303
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy dm-tools stays unmounted; seeded dice/combat quarantine fixtures and live 404 probes without a public HTTP mount.

## Hop chain

1. Producer: none (no public request path)
2. Authorize: N/A — dispatcher deny-by-default + `DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED=false`
3. Persist: none (in-memory; REDIS unused)
4. Consumer: self-test createRouteHandler probes only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Public path stays 404 | createRouteHandler probes | pass |
| Invalid/missing | Bad notation / missing target | throws | pass |
| Two consumers / crash | No Redis durability; activation denied | flags false | pass |
| Legacy defects | Unauth authority; unbounded dice count | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; no automatic public activation

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
