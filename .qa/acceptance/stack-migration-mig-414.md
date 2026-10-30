# Acceptance — MIG-414 Edge Main Dispatcher Host Port (#830)

## Intent
Port allowlisted Edge `main` dispatcher resolve/allowlist/JWT-gate contracts onto the host as an isolated surface under `server/src/http/edge-main-dispatcher.ts` (re-exported from `route-registry.ts`). Edge `main` remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
- [x] Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
- [x] Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
- [x] JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
- [x] Preserve512MiB/300s worker resource limits and record existing dispatcher raw-message error behavior.
- [x] Verpflichtende Legacy-Regression: Dispatcher verifies signature and optional exp but not complete JWT claims; worker-side account authentication remains mandatory. Raw exception messages can escape in500 body.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-414-edge-main.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/mig-414-edge-main.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-414.md`.
