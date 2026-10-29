# Composition Gate — stack-migration-mig-409 (#825)

- HEAD_SHA: cf6c147f31f414e02cb8a15ca42ad24fa788cf01
- BASE_SHA: 3b6831adfbb3f1d6a1bb709c523a8ad32aa1b5e2
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Host gains isolated item-model3d use-cases (config/upload/generate/status/resolve/remove/latest) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host application item-model3d use-cases + in-memory definition/asset/job/quota store
2. Authorize: Personal owner or world-profile owner only (GM/membership insufficient); archived denied; status reauth before materialize
3. Persist: Isolated in-memory characterization; Edge Postgres/storage path unchanged; provider poll + host allowlist before asset write
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Owner/world-owner upload+generate; GM/member/stranger 403; foreign jobId 404; foreign resolve 403; world owner clears pointer without deleting other-owner asset.

### Invalid/missing
Header-only 70MiB Content-Length → 413; bad GLB magic / invalid base64 rejected; empty thumbnail suffix → THUMBNAIL_REQUIRED; missing jobId → 400; not-configured → 503; 3rd generate → 429; quota store down → 500 before paid create; off-allowlist provider URL → failed without materialize.

### Two consumers / crash
Concurrent status: first claimer materializes after provider succeed+allowlist; second observes without extra paid create; activation remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
