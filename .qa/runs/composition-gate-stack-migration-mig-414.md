# Composition Gate — stack-migration-mig-414

- HEAD_SHA: WORKTREE (pre-commit; MIG-414 isolated dispatcher)
- Feature: stack-migration-mig-414
- Issue: #830 / MIG-414
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Intent
Host gains isolated Edge `main` dispatcher resolve/allowlist/JWT-gate use-cases while Edge `main` remains the live mount. Public activation stays false; no production cutover.

## Composition
1. Resolve: `/functions/v1/<name>/suffix` and `/<name>/suffix` → same worker pathname
2. Authorize: deny unmounted/main/_shared/unknown/traversal with 404 BEFORE JWT; JWT HS256 gate for allowlisted non-OPTIONS
3. Isolate: wouldCreateWorker stays false until activation authorized; 512MiB / 300s limits recorded
