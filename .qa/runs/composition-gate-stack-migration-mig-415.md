# Composition Gate — stack-migration-mig-415 (#831)

- HEAD_SHA: f86fa40b3659b6263a2ceb115cb062463c8117bb
- BASE_SHA: f86fa40b3659b6263a2ceb115cb062463c8117bb
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy marketplace Map templates quarantined; host/dispatcher keep 404; no public mount; rating uses downloads as sample count preserved as required regression.

## Hop chain

1. Producer: marketplace-quarantine fixtures
2. Authorize: none (MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED=false)
3. Persist: none (in-memory Map only)
4. Consumer: self-test / future MIG-600 HTTP after activation

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | No shared public route | allowlist deny + host 404 | pass |
| Invalid/missing | Missing template download/rate | null | pass |
| Two consumers / crash | No durable write | Maps only | pass |
| Legacy defects | rate uses downloads as count; no auth | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED=false

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
