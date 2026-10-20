# Infrastructure `inventory`

## VORHER
- Area root: `src/infrastructure/inventory/`
  - `src/infrastructure/inventory/inventory-persistence.ts`
  - `src/infrastructure/inventory/item-catalog-service.ts`
  - `src/infrastructure/inventory/item-catalog.persistence.ts`
  - `src/infrastructure/inventory/item-model3d-service.ts`
  - `src/infrastructure/inventory/item-thumbnail-service.ts`
  - `src/infrastructure/inventory/supabase-item-catalog.repository.ts`
- RPCs: n/a
- Tables `.from`: `characters`, `inventory_item_definitions`, `project_members`, `world_profiles`
- Edge invokes: `item-model3d`, `item-thumbnail`

## NACHHER
- src/infrastructure/inventory/** → HTTP/client to server/src/application/inventory/
- Depends: GATE-01, EDGE:item-model3d, EDGE:item-thumbnail
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- Edge invoke parity for: item-model3d, item-thumbnail

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports
