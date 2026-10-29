# Composition Gate — stack-migration-mig-410 (#826)

- HEAD_SHA: 3580f1d36d6728286a107b237031dc31b2d73b7d
- BASE_SHA: a99f4ee1cff9c6be6fa7cd7f19b24626ecc17ad0
- Date: 2026-10-29
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Host gains isolated item-thumbnail use-cases (config/upload/generate/status/resolve/remove/latest) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host application item-thumbnail use-cases + in-memory definition/asset/job/quota store
2. Authorize: Personal owner or world-profile owner only (GM/membership insufficient); archived denied; status reauth before materialize
3. Persist: Isolated in-memory characterization; Edge Postgres/storage path unchanged; provider poll + host allowlist before asset write
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Owner/world-owner upload+generate; GM/member/stranger 403; foreign jobId 404; foreign resolve 403; world owner clears pointer without deleting other-owner asset.

### Invalid/missing
Header-only 15MiB Content-Length → 413; bad image magic / invalid base64 rejected; non-string userExtra → 400; missing jobId → 400; not-configured → 503; 5th generate → 429; quota store down → 500 before paid create; off-allowlist provider URL → failed without materialize.

### Two consumers / crash
Concurrent status: first claimer materializes after provider succeed+allowlist; second observes without extra paid create; activation remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
