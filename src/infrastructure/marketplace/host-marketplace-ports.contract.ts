/**
 * Host-aligned marketplace ports contract (MIG-305 / #804).
 * Location: src/infrastructure/marketplace/host-marketplace-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/marketplace` catalog ports.
 * Supabase marketplace-service remains the live default until cutover.
 */

export type HostMarketplaceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type HostMarketplaceItemType =
  | 'world'
  | 'adventure'
  | 'character'
  | 'item'
  | 'ruleset';

export type HostMarketplaceItemRecord = {
  readonly id: string;
  readonly type: HostMarketplaceItemType;
  readonly title: string;
  readonly description: string | null;
  readonly authorId: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly rating: number;
  readonly downloads: number;
  readonly price: number;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly isFeatured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type HostMarketplaceListFilters = {
  readonly type?: HostMarketplaceItemType | 'all';
  readonly searchQuery?: string;
  readonly minRating?: number;
  readonly maxPrice?: number;
  readonly sortBy?: 'downloads' | 'rating' | 'created_at' | 'price';
  readonly sortOrder?: 'asc' | 'desc';
};

export type HostMarketplaceCreateDraft = {
  readonly type: HostMarketplaceItemType;
  readonly title: string;
  readonly description?: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};

export type HostMarketplaceUpdatePatch = {
  readonly title?: string;
  readonly description?: string | null;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};

export type HostMarketplaceIncrementResult =
  | {
      readonly ok: true;
      readonly itemId: string;
      readonly downloads: number | null;
      readonly mutated: boolean;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Dual-path FE seam. All ops are actorId-first; catalog reads ignore actor scope.
 */
export type HostMarketplacePorts = {
  readonly listItems: (
    actorId: string,
    filters?: HostMarketplaceListFilters,
  ) => Promise<HostMarketplaceResult<readonly HostMarketplaceItemRecord[]>>;
  readonly getItem: (
    actorId: string,
    itemId: string,
  ) => Promise<HostMarketplaceResult<HostMarketplaceItemRecord | null>>;
  readonly listFeatured: (
    actorId: string,
  ) => Promise<HostMarketplaceResult<readonly HostMarketplaceItemRecord[]>>;
  readonly listByAuthor: (
    actorId: string,
    authorId: string,
  ) => Promise<HostMarketplaceResult<readonly HostMarketplaceItemRecord[]>>;
  readonly createItem: (
    actorId: string,
    draft: HostMarketplaceCreateDraft,
  ) => Promise<HostMarketplaceResult<HostMarketplaceItemRecord>>;
  readonly updateItem: (
    actorId: string,
    itemId: string,
    patch: HostMarketplaceUpdatePatch,
  ) => Promise<HostMarketplaceResult<HostMarketplaceItemRecord>>;
  readonly deleteItem: (
    actorId: string,
    itemId: string,
  ) => Promise<HostMarketplaceResult<boolean>>;
  readonly incrementDownloads: (
    actorId: string,
    itemId: string | null | undefined,
  ) => Promise<HostMarketplaceIncrementResult>;
};

export const HOST_MARKETPLACE_OPS = [
  'listItems',
  'getItemById',
  'listFeatured',
  'listByAuthor',
  'createItem',
  'updateItem',
  'deleteItem',
  'incrementDownloads',
] as const;

export type HostMarketplaceOp = (typeof HOST_MARKETPLACE_OPS)[number];
