# Composition Gate — stack-migration-mig-404 (#820)

- HEAD_SHA: b5fb5e981ef4f3b3102ea7a21c5eb07087d2a005
- BASE_SHA: eca938c512d3b36e389db4be6ee6c7dd84de9e56
- HOP_DIGEST: 7a4b57061b70e028a4351b5aa47e2a0f15a7ce62deb0268b334970422b865616
- Date: 2026-10-28
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Host gains isolated character-avatar-meshy use-cases (config/start/poll/retry/storage authz) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host application character-avatar-meshy use-cases + in-memory job store
2. Authorize: Owner-scoped job reads; stranger 404; storage path prefix check; process-memory quota 2/60s
3. Persist: Isolated in-memory jobs/idempotency map (characterization); Edge Postgres path unchanged
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Owner can start/get/sign; stranger receives 404 on job and 403 on owner storage path.

### Invalid/missing
Nonce/prompt/image/settings/provider validation returns 400; not-configured when BYOK missing; third start in window returns 429.

### Two consumers / crash
Concurrent remesh claims: only first claimer wins; retry with existing provider task resumes without paid create; activation flag remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
