# Acceptance — MIG-416 media Edge quarantine (#832)

## Intent
Capture legacy-unmounted Edge `media` Map metadata worker; keep 404. Distinct from durable host media/MIG-306.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `MEDIA_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] media worker stays 404 (dispatcher + host probes).
- [x] Isolated upload URL construction, mime/size formula, list/filter/tags/delete fixtures.
- [x] Map ≠ durable storage (no byte store / Storage client).
- [x] Legacy: no auth; URL without storing bytes.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-416-media-quarantine.self-test.mjs → PASS

## Evidence
`scripts/mig-416-media-quarantine.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-416.md`.
