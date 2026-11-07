/**
 * marketplace-service — Host catalog adapter for marketplace (#675 / CUT-20).
 * Location: src/infrastructure/marketplace/marketplace-service.ts
 *
 * Client-trust (#675): mutations scope to authenticated author_id; update/create
 * DTOs are allowlisted — never spread rating/downloads/author_id from the client.
 */
import {
  whitelistMarketplaceCreateDto,
  whitelistMarketplaceUpdatePatch,
} from '../../domains/marketplace/client-trust';
import type {
  MarketplaceItem,
  CreateMarketplaceItemDTO,
  UpdateMarketplaceItemDTO,
  MarketplaceFilters,
} from '../../domains/marketplace/contracts/marketplace.types';
import {
  createHostMarketplaceItem,
  deleteHostMarketplaceItem,
  fetchHostFeaturedMarketplaceItems,
  fetchHostMarketplaceItem,
  fetchHostMarketplaceItems,
  incrementHostMarketplaceDownloads,
  isHostLibraryEnabled,
  updateHostMarketplaceItem,
} from '../host/host-catalog-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

/**
 * Get all marketplace items with optional filtering
 */
export async function getMarketplaceItems(
  filters?: MarketplaceFilters
): Promise<MarketplaceItem[]> {
  assertHost();
  return fetchHostMarketplaceItems(filters);
}

/**
 * Get a single marketplace item by ID
 */
export async function getMarketplaceItemById(id: string): Promise<MarketplaceItem | null> {
  assertHost();
  return fetchHostMarketplaceItem(id);
}

/**
 * Get featured marketplace items (top downloads).
 */
export async function getFeaturedItems(): Promise<MarketplaceItem[]> {
  assertHost();
  return fetchHostFeaturedMarketplaceItems();
}

/**
 * Create a new marketplace item (publish your content)
 */
export async function createMarketplaceItem(
  dto: CreateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  assertHost();
  return createHostMarketplaceItem(whitelistMarketplaceCreateDto(dto));
}

/**
 * Update a marketplace item (only if you're the author)
 */
export async function updateMarketplaceItem(
  id: string,
  dto: UpdateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  assertHost();
  const patch = whitelistMarketplaceUpdatePatch(dto);
  if (Object.keys(patch).length === 0) {
    throw new Error('Keine erlaubten Update-Felder');
  }
  return updateHostMarketplaceItem(id, patch);
}

/**
 * Delete a marketplace item (only if you're the author)
 */
export async function deleteMarketplaceItem(id: string): Promise<boolean> {
  assertHost();
  try {
    await deleteHostMarketplaceItem(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Increment downloads counter when a user downloads an item.
 * Counters are server-authority only — no client write fallback (#675).
 */
export async function incrementDownloads(id: string): Promise<void> {
  assertHost();
  try {
    await incrementHostMarketplaceDownloads(id);
  } catch (error) {
    console.error(
      'incrementHostMarketplaceDownloads failed (no client counter write):',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Get items by a specific author
 */
export async function getItemsByAuthor(authorId: string): Promise<MarketplaceItem[]> {
  assertHost();
  const items = await fetchHostMarketplaceItems();
  return items
    .filter((item) => item.author_id === authorId)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}
