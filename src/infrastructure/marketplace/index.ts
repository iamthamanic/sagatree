/**
 * marketplace infrastructure barrel (MIG-305 dual-path seam).
 * Location: src/infrastructure/marketplace/index.ts
 */
export {
  createMarketplaceItem,
  deleteMarketplaceItem,
  getFeaturedItems,
  getItemsByAuthor,
  getMarketplaceItemById,
  getMarketplaceItems,
  incrementDownloads,
  updateMarketplaceItem,
} from './marketplace-service';

export {
  createHostMarketplaceAdapter,
  type HostMarketplaceAdapter,
} from './host-marketplace-adapter';

export {
  HOST_MARKETPLACE_OPS,
  type HostMarketplaceCreateDraft,
  type HostMarketplaceIncrementResult,
  type HostMarketplaceItemRecord,
  type HostMarketplaceItemType,
  type HostMarketplaceListFilters,
  type HostMarketplaceOp,
  type HostMarketplacePorts,
  type HostMarketplaceResult,
  type HostMarketplaceUpdatePatch,
} from './host-marketplace-ports.contract';
