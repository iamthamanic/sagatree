/**
 * marketplace-service — Supabase adapter for marketplace catalog/downloads.
 * Location: src/infrastructure/marketplace/marketplace-service.ts
 *
 * MIG-305 dual-path note: live browser traffic stays on this Supabase adapter;
 * host catalog/download ports are wired via createHostMarketplaceAdapter when the
 * stack selects the host transport (see src/infrastructure/marketplace/index.ts).
 *
 * Client-trust (#675): mutations scope to authenticated author_id; update/create
 * DTOs are allowlisted — never spread rating/downloads/author_id from the client.
 */
import { supabase } from '../../lib/supabase';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
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

/**
 * Get all marketplace items with optional filtering
 */
export async function getMarketplaceItems(
  filters?: MarketplaceFilters
): Promise<MarketplaceItem[]> {
  try {
    let query = supabase
      .from('marketplace_items')
      .select('*');

    // Apply filters
    if (filters?.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    if (filters?.searchQuery) {
      query = query.or(
        `title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
      );
    }

    if (filters?.minRating !== undefined) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    // Sorting
    const sortBy = filters?.sortBy || 'downloads';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching marketplace items:', error);
      throw new Error(`Failed to fetch marketplace items: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getMarketplaceItems:', error);
    throw error;
  }
}

/**
 * Get a single marketplace item by ID
 */
export async function getMarketplaceItemById(id: string): Promise<MarketplaceItem | null> {
  try {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching marketplace item:', error);
      throw new Error(`Failed to fetch marketplace item: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getMarketplaceItemById:', error);
    throw error;
  }
}

/**
 * Get featured marketplace items (top downloads).
 * Rating stays server-authority only (#675); until a rating RPC exists, featured
 * listings must not filter on client-impossible rating thresholds.
 */
export async function getFeaturedItems(): Promise<MarketplaceItem[]> {
  try {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .order('downloads', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Error fetching featured items:', error);
      throw new Error(`Failed to fetch featured items: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getFeaturedItems:', error);
    throw error;
  }
}

/**
 * Create a new marketplace item (publish your content)
 */
export async function createMarketplaceItem(
  dto: CreateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  try {
    const userId = await getAuthenticatedUserId();
    const safe = whitelistMarketplaceCreateDto(dto);

    const { data, error } = await supabase
      .from('marketplace_items')
      .insert({
        type: safe.type,
        title: safe.title,
        description: safe.description || null,
        author_id: userId,
        data: safe.data,
        price: safe.price || 0,
        image_url: safe.image_url || null,
        tags: safe.tags || [],
        rating: 0,
        downloads: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating marketplace item:', error);
      throw new Error(`Failed to create marketplace item: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in createMarketplaceItem:', error);
    throw error;
  }
}

/**
 * Update a marketplace item (only if you're the author)
 */
export async function updateMarketplaceItem(
  id: string,
  dto: UpdateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  try {
    const userId = await getAuthenticatedUserId();
    const patch = whitelistMarketplaceUpdatePatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new Error('Keine erlaubten Update-Felder');
    }

    const { data, error } = await supabase
      .from('marketplace_items')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('author_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating marketplace item:', error);
      throw new Error(`Failed to update marketplace item: ${error.message}`);
    }

    if (!data) {
      throw new Error(
        'Marketplace-Eintrag nicht gefunden oder fremder Autor — Update verweigert',
      );
    }

    return data;
  } catch (error) {
    console.error('Error in updateMarketplaceItem:', error);
    throw error;
  }
}

/**
 * Delete a marketplace item (only if you're the author)
 */
export async function deleteMarketplaceItem(id: string): Promise<boolean> {
  try {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('marketplace_items')
      .delete()
      .eq('id', id)
      .eq('author_id', userId)
      .select('id');

    if (error) {
      console.error('Error deleting marketplace item:', error);
      throw new Error(`Failed to delete marketplace item: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(
        'Marketplace-Eintrag nicht gefunden oder fremder Autor — Delete verweigert',
      );
    }

    return true;
  } catch (error) {
    console.error('Error in deleteMarketplaceItem:', error);
    return false;
  }
}

/**
 * Increment downloads counter when a user downloads an item.
 * Counters are server-authority only — no client write fallback (#675).
 */
export async function incrementDownloads(id: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_marketplace_downloads', {
      item_id: id,
    });

    if (error) {
      console.error(
        'increment_marketplace_downloads RPC failed (no client counter write):',
        error.message,
      );
    }
  } catch (error) {
    console.error('Error incrementing downloads:', error);
  }
}

/**
 * Get items by a specific author
 */
export async function getItemsByAuthor(authorId: string): Promise<MarketplaceItem[]> {
  try {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching author items:', error);
      throw new Error(`Failed to fetch author items: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getItemsByAuthor:', error);
    throw error;
  }
}
