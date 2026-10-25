# Acceptance — MIG-415 marketplace quarantine (#831)

## Intent
Capture legacy-unmounted `marketplace` Map template catalog; keep 404. Distinct from durable marketplace_items.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] marketplace worker stays 404 including download/rate (dispatcher + host).
- [x] Isolated seed/list/filter/search/create/download fixtures match source.
- [x] Map catalog ≠ durable marketplace_items / increment_marketplace_downloads.
- [x] Legacy regression: rate uses downloads as sample count; no auth.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-415-marketplace-quarantine.self-test.mjs → PASS

## Evidence
`scripts/mig-415-marketplace-quarantine.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-415.md`.
