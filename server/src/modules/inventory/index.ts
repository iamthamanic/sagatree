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

export {
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_RATE_LIMIT,
  createItemModel3dStore,
  describeItemModel3dLegacyDefects,
  itemModel3dConfig,
  itemModel3dGenerate,
  itemModel3dLatestJob,
  itemModel3dRemove,
  itemModel3dResolve,
  itemModel3dStatus,
  itemModel3dUpload,
  type ItemModel3dStore,
} from './internal/item-model3d.ts';

export {
  ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_THUMBNAIL_RATE_LIMIT,
  createItemThumbnailStore,
  describeItemThumbnailLegacyDefects,
  type ItemThumbnailStore,
} from './internal/item-thumbnail.ts';
