# Acceptance — MIG-411 items quarantine (#827)

## Intent
Capture legacy-unmounted `items` Map catalog; keep 404. Distinct from durable inventory_item_definitions.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `ITEMS_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] items list/create/generate remain 404.
- [x] Defaults, rarity/type filters, generate ranges; invalid nested accepted.
- [x] Map catalog ≠ durable inventory_item_definitions.
- [x] No auth/schema/durable inventory (legacy regression).
- [x] Zero type escape hatches.
- [x] scripts/mig-411-items-quarantine.self-test.mjs → PASS


## Evidence
`scripts/mig-411-items-quarantine.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-411.md`.
