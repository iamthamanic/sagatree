/**
 * host-marketplace-adapter — Dual-path host seam (MIG-305 / #804).
 * Location: src/infrastructure/marketplace/host-marketplace-adapter.ts
 */
import type { HostMarketplacePorts } from './host-marketplace-ports.contract';
import { HOST_MARKETPLACE_OPS } from './host-marketplace-ports.contract';

export type HostMarketplaceAdapter = HostMarketplacePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_MARKETPLACE_OPS;
};

export function createHostMarketplaceAdapter(ports: HostMarketplacePorts): HostMarketplaceAdapter {
  return {
    transport: 'host',
    ops: HOST_MARKETPLACE_OPS,
    listItems: (filters) => ports.listItems(filters),
    getItemById: (itemId) => ports.getItemById(itemId),
    listFeatured: () => ports.listFeatured(),
    listByAuthor: (authorId) => ports.listByAuthor(authorId),
    createItem: (actorId, draft) => ports.createItem(actorId, draft),
    updateItem: (actorId, itemId, patch) => ports.updateItem(actorId, itemId, patch),
    deleteItem: (actorId, itemId) => ports.deleteItem(actorId, itemId),
    incrementDownloads: (actorId, itemId) => ports.incrementDownloads(actorId, itemId),
  };
}
