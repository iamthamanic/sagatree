# Composition Gate — stack-migration-mig-421 (#837)

- HEAD_SHA: PENDING_COMMIT
- BASE_SHA: 0ea1f801539da6738258c0394ba81a6baba90f35
- HOP_DIGEST: session-recap-generate-isolated-v1
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Host gains isolated session-recap generate use-case (GM-only draft summary from server-derived highlights) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover; publication remains a separate RPC.

## Hop chain

1. Producer: Host application `createSessionRecapGenerateUseCases` + in-memory session/project/recap/quota store
2. Authorize: Auth identity must equal `projects.gm_user_id`; owner/member/player/foreign denied; client prompt/highlights/worldState/summaryText rejected; session must be completed|cancelled
3. Persist: Quota charge + upsert skeleton + draft PATCH (`summary_status=draft` only); `publishCount` stays 0
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Distinct owner O and project GM G: only G generates for ended session; active member/player/foreign X → 403. GM-only highlight sentinel never reaches provider.

### Invalid/missing
Non-ended → 400; missing session → 404; 8001-byte body → 413; quota 7th → 429; client prompt payload → 400; unauthenticated → 401; GET → 405; missing persistent store → 503.

### Two consumers / crash
Provider/persist failure → generic 500 without secrets; draft/publish counters unchanged on failure; activation remains false; Edge allowlist unchanged.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
