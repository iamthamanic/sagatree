# Acceptance — CUT-06 (#1141)

- HEAD_SHA: 0993c0e08630af641132f6d5624e344fafa2717e
- Issue: #1141
- Slug: cut-06-restore-item-catalog-update-arch

## Summary
Host InventoryPorts gain updateDefinition / setDefinitionStatus / forkDefinition.
HTTP: PATCH/archive/restore/fork under `/api/v1/library/items/:id`.
FE dual-path via host-library-http; Soft-DENY removed. Core/builtin fork uses local draft + create.

## Composition Gate

- HEAD_SHA: 0993c0e08630af641132f6d5624e344fafa2717e
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-06-item-definition.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs
- [x] scripts/mig-303-inventory-adapter.self-test.mjs
