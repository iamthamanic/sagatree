# Composition Gate — stack-migration-mig-414 (#830)

- HEAD_SHA: 91b2fb4d34dd225072083bb2e6b7eac2d12dd43e
- BASE_SHA: 25047a21fa959b1d7d000c133f4e19d3bdcde662
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Host gains isolated Edge `main` dispatcher resolve/allowlist/JWT-gate use-cases while Edge `main` remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host HTTP `dispatchEdgeMainRequest` + `createEdgeMainUseCases` (pathname/method/search/body + JWT gate)
2. Authorize: Deny unmounted/main/_shared/unknown/traversal with 404 BEFORE JWT; HS256 JWT gate for allowlisted non-OPTIONS; `evaluatePostDispatcherWorkerAuth` still denies anon/service_role
3. Persist: No durable writes; wouldCreateWorker stays false; 512MiB / 300s limits recorded only
4. Consumer: Self-test fixtures + `npm run test-gate` registration; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Fifteen unmounted workers plus main/_shared/unknown/traversal → 404 for GET/POST/OPTIONS before JWT; each allowlisted name reachable via both URL prefixes with identical worker pathname.

### Invalid/missing
Missing function name → 400; missing/wrong/expired/HS512 JWT → 401; missing JWT_SECRET → 500; VERIFY_JWT default on; OPTIONS skip JWT for allowlisted.

### Two consumers / crash
Dispatcher acceptance of anon/service_role JWT does not create a worker; worker-auth port denies those roles; concurrent dispatch calls stay activation=false and Edge allowlist unchanged.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
