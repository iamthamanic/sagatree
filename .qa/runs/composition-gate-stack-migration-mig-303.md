# Composition Gate — stack-migration-mig-303 (#802)

- HEAD_SHA: PLACEHOLDER
- BASE_SHA: fa06e3fcaacb7af0d2df1ab57e28c0fcd26d0f0f
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Authenticated owner lists/creates/updates/soft-deletes own inventory item rows via host `inventory` ports. Foreign actors receive DENY. Catalog/thumbnail helpers stay behind existing FE seams (Supabase default remains). No public HTTP inventory mount in this slice.

## Hop chain

1. Producer: Inventory UI / infrastructure inventory-service successor (or host dual-path adapter)
2. Authorize: verified actor id; `owner_user_id` from actor only
3. Persist: SQLite inventory tables under host single-writer (`BEGIN IMMEDIATE` on mutating writes)
4. Project: inventory records with owner scope; soft-delete via `deleted_at`
5. Consumer: `createHost` exposes `inventory` ports; FE `createHostInventoryAdapter` dual-path seam

## Simulations

### N-actors
Owner O CRUD own items; stranger X gets empty list / not-authorized. Cross-owner FK DENY.

### Invalid/missing
Missing required fields → typed errors. Soft-deleted rows hidden from list/get.

### Two consumers / crash
Row committed under IMMEDIATE lock; reload returns same identity.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
