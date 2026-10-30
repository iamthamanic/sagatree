# Acceptance — MIG-303 Inventory Host Adapters (#802)

## Intent
Port `src/infrastructure/inventory` persistence callers onto approved host repository ports while Supabase remains the live default (no production cutover). Thumbnail/model3d Edge shapes stay in inventory module stores (no HTTP activation).

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-602/#847 feature E2E cutover; FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- [x] Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- [x] Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-303-inventory-adapter.self-test.mjs` → PASS

## Security Coverage
- Owner-scoped inventory put/get DENY for foreign actors.
- Catalog: personal only for owner; world list/create requires world ACL (canRead/canEdit); standard public; client cannot promote `standard` origin.
- putOwnedInventory requires valid Inventory v2 shape + visible definition ids; characters.inventory_* writes via character port only.
- No client-claimed owner elevation; actor id is verified host actor only (isolated-contract; HTTP binds session later).
- Launch SC-01…SC-07: N/A — not a launch ticket; inline SC-01/SC-02 covered above.

## Evidence
`node --experimental-strip-types scripts/mig-303-inventory-adapter.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-303.md`.

## Implementation Notes
- Host migration `0028_inventory_infra.sql` + TABLE_OWNERSHIP `inventory_item_definitions` → inventory.
- `createInventoryPorts` + `createHost.inventory`; FE dual-path `host-inventory-*`.
- `INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`.
