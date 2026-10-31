/**
 * host-marketplace-adapter — Binds infra HostMarketplacePorts to an injected host impl (MIG-305).
 * Location: src/infrastructure/marketplace/host-marketplace-adapter.ts
 *
 * Production UI still calls Supabase marketplace-service. Dual-path seam only.
 */
import type { HostMarketplacePorts } from './host-marketplace-ports.contract';
import { HOST_MARKETPLACE_OPS } from './host-marketplace-ports.contract';

export type HostMarketplaceAdapter = HostMarketplacePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_MARKETPLACE_OPS;
};

export function createHostMarketplaceAdapter(
  ports: HostMarketplacePorts,
): HostMarketplaceAdapter {
  return {
    transport: 'host',
    ops: HOST_MARKETPLACE_OPS,
    listItems: (actorId, filters) => ports.listItems(actorId, filters),
    getItem: (actorId, itemId) => ports.getItem(actorId, itemId),
    listFeatured: (actorId) => ports.listFeatured(actorId),
    listByAuthor: (actorId, authorId) => ports.listByAuthor(actorId, authorId),
    createItem: (actorId, draft) => ports.createItem(actorId, draft),
    updateItem: (actorId, itemId, patch) => ports.updateItem(actorId, itemId, patch),
    deleteItem: (actorId, itemId) => ports.deleteItem(actorId, itemId),
    incrementDownloads: (actorId, itemId) => ports.incrementDownloads(actorId, itemId),
  };
}
