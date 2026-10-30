# Composition Gate — stack-migration-mig-303 (#802)

- HEAD_SHA: f051f69df33673e06be388bf63cd4a3ca9fa02b6
- BASE_SHA: fa06e3fcaacb7af0d2df1ab57e28c0fcd26d0f0f
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Authenticated owner lists/creates/updates own inventory item definitions via host `inventory` ports; owned PC inventory_json writes go through character inventory-column ports. World catalog read/create requires world ACL. Foreign actors receive DENY. Catalog/thumbnail helpers stay behind existing FE seams (Supabase default remains). No public HTTP inventory mount in this slice. Archive is status=`archived` (no soft-delete `deleted_at` on catalog rows).

## Hop chain

1. Producer: Inventory UI / infrastructure inventory-service successor (or host dual-path adapter)
2. Authorize: verified actor id from host composition; `owner_user_id` from actor only; world ACL via injected world ports
3. Persist: SQLite `inventory_item_definitions` under host single-writer (`BEGIN IMMEDIATE` on mutating writes); `characters.inventory_*` via character module port
4. Project: inventory records with owner scope; archived status hidden from list
5. Consumer: `createHost` exposes `inventory` ports; FE `createHostInventoryAdapter` dual-path seam

## Simulations

### N-actors
Owner O CRUD own personal definitions + owned PC inventory; stranger X gets not-authorized / no personal rows. World list/create without ACL DENY. Cross-owner definition references DENY on put.

### Invalid/missing
Missing required fields / invalid Inventory v2 shape → typed errors. Unknown catalog status never mapped to active.

### Two consumers / crash
Row committed under IMMEDIATE lock; reload returns same identity.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
