# Acceptance — MIG-403 bestiary quarantine (#819)

## Intent
Capture the legacy-unmounted `bestiary` Edge worker; keep production host/dispatcher at 404 until a separate human activation. Isolated characterization fixtures only — no public host route.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; public activation remains unauthorized (`BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED === false`). FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only (cutover / Supabase shutdown / desktop).

## Required Tests
- [x] All bestiary paths remain dispatcher404 without Map initialization (allowlist excludes `bestiary`; create-app / route-registry have no bestiary route; activation flag false).
- [x] Isolated create/list/search/encounter fixture checks Monster defaults, CR parsing, unknown monster skipping and requested-count multiplier.
- [x] Negative count/XP/party size and unknown difficulty require bounded validation in any separately approved replacement; generator not authorized for public deployment.
- [x] Legacy regression characterized: no auth/schema in historical worker; requested vs known count mismatch for XP multiplier; nonpositive counts unbounded in quarantine fixtures.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-403-bestiary-quarantine.self-test.mjs → PASS


## Evidence
`node --experimental-strip-types scripts/mig-403-bestiary-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-403.md`.
