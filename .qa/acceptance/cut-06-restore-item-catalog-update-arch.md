# Acceptance — CUT-06 (#1141)

- HEAD_SHA: 20d1253f01f1a0c0cac89ddc4a93b457c2b52ccd
- Issue: #1141
- Slug: cut-06-restore-item-catalog-update-arch

## Summary
Host InventoryPorts gain updateDefinition / setDefinitionStatus / forkDefinition.
HTTP: PATCH/archive/restore/fork under `/api/v1/library/items/:id`.
FE dual-path via host-library-http; Soft-DENY removed. Core/builtin fork uses local draft + create.

## Composition Gate

- HEAD_SHA: 20d1253f01f1a0c0cac89ddc4a93b457c2b52ccd
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-06-item-definition.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs
- [x] scripts/mig-303-inventory-adapter.self-test.mjs
