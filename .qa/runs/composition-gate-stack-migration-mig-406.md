# Composition Gate — stack-migration-mig-406 (#822)

- HEAD_SHA: 189ca81240007555431fdedeb0e73ef8d8172675
- BASE_SHA: ef2ebc09ecd3232e6d0adb9f6ac2d9c5e1674095
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy characters stays unmounted; quarantine fixtures characterize PUT ownerId overwrite, body.characterId level-up, and non-advancing XP loop without a public HTTP/WS consumer.

## Hop chain

1. Producer: none (no public request path)
2. Authorize: N/A — dispatcher deny-by-default + `CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED=false`
3. Persist: none (in-memory fixture only)
4. Consumer: self-test only; no host route registry entry

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Public path stays 404 for any caller | allowlist values + create-app + registry | pass |
| Invalid/missing | Cross-owner body / import / forged ownerId | quarantine + activation denied | pass |
| Two consumers / crash | XP-at-threshold hang stopped by maxIterations | guarded fixture | pass |
| Legacy defects | PUT ownerId overwrite; body.characterId ≠ path | fixtures characterize | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; no automatic public activation

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
