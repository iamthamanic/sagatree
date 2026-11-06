# Acceptance — MIG-412 look-reference-analysis (#828)

## Intent
Isolated-contract host use-case for look-reference-analysis. Edge stays allowlisted until dual-path removal. CUT-15 (#1150) activates `LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED=true` and mounts `POST /api/v1/ai/look-reference-analysis`.

## Acceptance tier
`isolated-contract` — SLICE DONE under `server/src/application/look-reference-analysis/`; public activation via CUT-15.

## Deferred integration
LookProfile HTTP mount remains MIG-600. Dual-path Edge removal → CUT-20.

## Required Tests
- [x] 1/10 images ok; 0/11, duplicate IDs, bad MIME/weight, absent bytes rejected.
- [x] Foreign/traversal/backslash storage denied; inline overrides storagePath.
- [x] 5th request in default window → 429; process-memory quota.
- [x] Provider absent → not-configured; top-level secrets stripped; nested retained; no LookProfile persist.
- [x] Content-Length 12MiB envelope; 8MiB image cap.
- [x] Legacy: Content-Length trust; nested secrets not recursive.
- [x] Zero type escape hatches.
- [x] scripts/mig-412-look-reference-analysis.self-test.mjs → PASS


## Evidence
`scripts/mig-412-look-reference-analysis.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-412.md`.
