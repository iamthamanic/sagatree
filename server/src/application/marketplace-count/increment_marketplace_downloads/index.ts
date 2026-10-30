/**
 * increment_marketplace_downloads use-case (RPC-MARKETPLACE-COUNT / #878).
 * Location: server/src/application/marketplace-count/increment_marketplace_downloads/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { MarketplaceCountPorts } from '../../../modules/marketplace/index.ts';

export function incrementMarketplaceDownloadsUseCase(marketplace: MarketplaceCountPorts) {
  return (actor: Actor, itemId: string) => marketplace.incrementDownloads(actor, itemId);
}
