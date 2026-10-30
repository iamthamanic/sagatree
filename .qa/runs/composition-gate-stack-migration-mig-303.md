# Composition Gate — stack-migration-mig-303 (#802)

- HEAD_SHA: 161f0c9d335f61e5ed388f464560e80727a5a84b
- BASE_SHA: fa06e3fcaacb7af0d2df1ab57e28c0fcd26d0f0f
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Authenticated owner reads/writes Inventory v2 JSON on owned PC rows and lists catalog definitions via host `inventory` ports. Foreign actors receive DENY on inventory mutate/read. Catalog origins are server-assigned (no client `standard` promotion). Thumbnail/model3d Edge shapes remain module-local (unmounted).

## Hop chain

1. Producer: Character inventory / item catalog successor (or host dual-path adapter)
2. Authorize: verified actor id; inventory writes only for owned PC; catalog visibility by origin
3. Persist: SQLite `characters.inventory_json` + `inventory_item_definitions` under IMMEDIATE where required
4. Project: InventoryStateRecord / InventoryDefinitionRecord with public ids
5. Consumer: `createHost.inventory`; FE `createHostInventoryAdapter` (Supabase default remains)

## Simulations

### N-actors
Owner O put/get inventory; stranger DENY. Personal catalog hidden from stranger; standard visible; world gated by worldProfileId.

### Invalid/missing
Invalid inventory body → invalid-inventory. Client origin=standard → origin-not-allowed. World without profile → world-profile-required.

### Two consumers / crash
Inventory write committed under IMMEDIATE; reload returns schemaVersion 2 payload.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- No inventory HTTP mount (`INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`)
