/**
 * inventory module public API — quarantine surface for MIG-411 (#827).
 * Location: server/src/modules/inventory/index.ts
 *
 * Items Edge Map catalog remains unmounted and is distinct from durable
 * inventory_item_definitions. No HTTP port factory here.
 */
export {
  ITEMS_MAP_IS_DURABLE_INVENTORY,
  ITEMS_PUBLIC_ACTIVATION_AUTHORIZED,
  SEED_ITEMS,
  applyItemDefaults,
  createSeededRng,
  filterItems,
  generateItem,
  type QuarantineItem,
} from './internal/items-quarantine.ts';
