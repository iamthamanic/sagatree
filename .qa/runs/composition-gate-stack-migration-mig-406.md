# Composition Gate — stack-migration-mig-406 (#822)

- HEAD_SHA: c2215b64661c9990c4ce5bc1668c4ac18f193a79
- BASE_SHA: ef2ebc09ecd3232e6d0adb9f6ac2d9c5e1674095
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy characters stays unmounted; quarantine fixtures characterize PUT ownerId overwrite, body.characterId level-up, non-advancing XP loop, and live host 404 probes without a public characters mount.

## Hop chain

1. Producer: none (no public request path)
2. Authorize: N/A — dispatcher deny-by-default + `CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED=false`
3. Persist: none (in-memory fixture only)
4. Consumer: self-test createRouteHandler probes only; no characters route registry entry

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Public path stays 404 for any caller | createRouteHandler probes | pass |
| Invalid/missing | Cross-owner import / forged ownerId / malformed nested | quarantine + 404 | pass |
| Two consumers / crash | XP-at-threshold hang stopped by maxIterations; OPTIONS 204 is global CORS | guarded fixture | pass |
| Legacy defects | PUT ownerId overwrite; body.characterId ≠ path | fixtures characterize | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; no automatic public activation

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
