# Acceptance — MIG-412 look-reference-analysis (#828)

## Intent
Isolated-contract host use-case for look-reference-analysis. Edge stays allowlisted; host HTTP mount deferred (MIG-600). `LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED=false`.

## Acceptance tier
`isolated-contract` — SLICE DONE under `server/src/application/look-reference-analysis/`.

## Deferred integration
authorized host routes + MIG-600. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847.

## Required Tests
- [x] 1/10 images ok; 0/11, duplicate IDs, bad MIME/weight, absent bytes rejected.
- [x] Foreign/traversal/backslash storage denied; inline overrides storagePath.
- [x] 5th request in default window → 429; process-memory quota.
- [x] Provider absent → not-configured; top-level secrets stripped; nested retained; no LookProfile persist.
- [x] Content-Length 12MiB envelope; 8MiB image cap.
- [x] Legacy: Content-Length trust; nested secrets not recursive.
- [x] Zero type escape hatches.

## Evidence
`scripts/mig-412-look-reference-analysis.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-412.md`.
