/**
 * inventory module public API — quarantine (MIG-411) + infra ports (#802).
 * Location: server/src/modules/inventory/index.ts
 *
 * Items Edge Map catalog remains unmounted. MIG-303 adds owner-scoped inventory
 * + catalog ports as isolated-contract (no HTTP activation). Thumbnail/model3d
 * Edge shapes remain in sibling modules.
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  InventoryInfraStore,
  type InventoryCharacterColumns,
  type InventoryDefinitionDraft,
  type InventoryDefinitionRecord,
  type InventoryResult,
  type InventoryStateRecord,
  type InventoryWorldLookup,
} from './internal/inventory-infra-store.ts';

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
  ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS,
  createItemThumbnailStore,
  describeItemThumbnailLegacyDefects,
  type ItemThumbnailStore,
} from './internal/item-thumbnail.ts';

export {
  INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  type InventoryCharacterColumns,
  type InventoryDefinitionDraft,
  type InventoryDefinitionRecord,
  type InventoryResult,
  type InventoryStateRecord,
  type InventoryWorldLookup,
};

export type InventoryPorts = {
  readonly moduleId: 'inventory';
  readonly getOwnedInventory: (
    actorId: string,
    characterId: string,
  ) => InventoryResult<InventoryStateRecord | null>;
  readonly putOwnedInventory: (
    actorId: string,
    characterId: string,
    inventory: unknown,
  ) => InventoryResult<InventoryStateRecord>;
  readonly listCatalog: (
    actorId: string,
    options?: { readonly worldProfileId?: string | null; readonly query?: string },
  ) => InventoryResult<readonly InventoryDefinitionRecord[]>;
  readonly createDefinition: (
    actorId: string,
    draft: InventoryDefinitionDraft,
  ) => InventoryResult<InventoryDefinitionRecord>;
  readonly seedStandardDefinitionForTests: (input: {
    readonly name: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }) => InventoryDefinitionRecord;
};

function unavailable<T>(): InventoryResult<T> {
  return { ok: false, error: 'store-unavailable' };
}

export type CreateInventoryPortsInput = {
  readonly db: HostDatabase;
  readonly world: InventoryWorldLookup;
  readonly character: InventoryCharacterColumns;
};

export function createInventoryPorts(input?: CreateInventoryPortsInput): InventoryPorts {
  if (!input?.db) {
    return {
      moduleId: 'inventory',
      getOwnedInventory: () => unavailable(),
      putOwnedInventory: () => unavailable(),
      listCatalog: () => unavailable(),
      createDefinition: () => unavailable(),
      seedStandardDefinitionForTests: () => {
        throw new Error('store-unavailable');
      },
    };
  }
  const store = new InventoryInfraStore(input.db, input.world, input.character);
  return {
    moduleId: 'inventory',
    getOwnedInventory: (actorId, characterId) => store.getOwnedInventory(actorId, characterId),
    putOwnedInventory: (actorId, characterId, inventory) =>
      store.putOwnedInventory(actorId, characterId, inventory),
    listCatalog: (actorId, options) => store.listCatalog(actorId, options),
    createDefinition: (actorId, draft) => store.createDefinition(actorId, draft),
    seedStandardDefinitionForTests: (seedInput) => store.seedStandardDefinition(seedInput),
  };
}
