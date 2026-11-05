# Infrastructure contract: marketplace

**Status: SPEC; current branch source verified.** Implementation issue: **#804**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-marketplace.json](source-contracts/infra-marketplace.json) (SHA-256 `0c44e9e24f4782edd2bb7f9d6ad67a6f4d3b31e7ea961c69d039a8f937f6a060`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Catalog methods use marketplace_items and increment_marketplace_downloads(item_id). list has type/searchQuery/minRating/maxPrice filters and downloads-desc default; featured queries rating>=3.5,downloads desc,limit6, falling back to top6 downloads. create derives author_id from auth.getUser, initializes rating/downloads0; update/delete filter id and rely on server RLS. delete catches errors and returnsfalse. incrementDownloads returnsvoid, falls back on any RPC error to read+write downloads+1 and swallows exceptions.

Create author_id comes from authenticated user; update/delete ownership is not checked in this adapter and must be enforced by effective server policy. Preserve published/catalog visibility as proved by SQL, not inferred from comments. The fallback count is non-atomic and cannot guarantee one durable increment.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (1): `increment_marketplace_downloads`.

Tables (1): `marketplace_items`.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 3.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `increment_marketplace_downloads` | #816 | RPC-MARKETPLACE-COUNT |
| table | `marketplace_items` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
- RPC increment succeeds atomically when installed; unavailable/denied RPC exercises read+update fallback and explicitly reports race, RLS and swallowed-error behavior.
- Create cannot use a client author_id; update/delete foreign-author attempts are denied by effective server policy; delete returnsfalse on its documented failures.
- Contract fixture for increment_marketplace_downloads: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

## Observed source defects and explicit successor decisions

- incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
- Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.

## All backend calls, arguments, filters and result handling

### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:44` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:37`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:94` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', id)
      .single()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:122` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .order('downloads', { ascending: false })
      .limit(6)
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:117`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:150` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:143`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:153` — literal-or-constant.

Exact call/query chain:
```ts
supabase
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
      .single()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:143`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:197` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:185`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:203` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('author_id', userId)
      .select()
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:185`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:245` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:235`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:247` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .delete()
      .eq('id', id)
      .eq('author_id', userId)
      .select('id')
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:235`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: increment_marketplace_downloads

`src/infrastructure/marketplace/marketplace-service.ts:289` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('increment_marketplace_downloads', {
      item_id: id,
    })
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:276`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:309` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:307`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/marketplace/host-marketplace-adapter.ts:8

```ts
export type HostMarketplaceAdapter = HostMarketplacePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_MARKETPLACE_OPS;
};
```

### src/infrastructure/marketplace/host-marketplace-adapter.ts:13

```ts
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
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:5

```ts
export type HostMarketplaceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:9

```ts
export type HostMarketplaceItemType = 'world' | 'adventure' | 'character' | 'item' | 'ruleset';
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:11

```ts
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
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:28

```ts
export type HostMarketplaceListFilters = {
  readonly type?: HostMarketplaceItemType | 'all';
  readonly searchQuery?: string;
  readonly minRating?: number;
  readonly maxPrice?: number;
  readonly sortBy?: 'downloads' | 'rating' | 'created_at' | 'price';
  readonly sortOrder?: 'asc' | 'desc';
};
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:37

```ts
export type HostMarketplaceCreateDraft = {
  readonly type: HostMarketplaceItemType;
  readonly title: string;
  readonly description?: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:47

```ts
export type HostMarketplaceUpdatePatch = {
  readonly title?: string;
  readonly description?: string | null;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:56

```ts
export type HostMarketplaceIncrementResult =
  | {
      readonly ok: true;
      readonly itemId: string;
      readonly downloads: number | null;
      readonly mutated: boolean;
    }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:65

```ts
export type HostMarketplacePorts = {
  readonly listItems: (
    filters?: HostMarketplaceListFilters,
  ) => Promise<HostMarketplaceResult<readonly HostMarketplaceItemRecord[]>>;
  readonly getItemById: (
    itemId: string,
  ) => Promise<HostMarketplaceResult<HostMarketplaceItemRecord | null>>;
  readonly listFeatured: () => Promise<HostMarketplaceResult<readonly HostMarketplaceItemRecord[]>>;
  readonly listByAuthor: (
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
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:95

```ts
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
```

### src/infrastructure/marketplace/host-marketplace-ports.contract.ts:106

```ts
export type HostMarketplaceOp = (typeof HOST_MARKETPLACE_OPS)[number];
```

### src/infrastructure/marketplace/marketplace-service.ts:37

```ts
export async function getMarketplaceItems(
  filters?: MarketplaceFilters
): Promise<MarketplaceItem[]> {
  if (isHostLibraryEnabled()) {
    return fetchHostMarketplaceItems(filters);
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:89

```ts
export async function getMarketplaceItemById(id: string): Promise<MarketplaceItem | null> {
  if (isHostLibraryEnabled()) {
    return fetchHostMarketplaceItem(id);
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:117

```ts
export async function getFeaturedItems(): Promise<MarketplaceItem[]> {
  if (isHostLibraryEnabled()) {
    return fetchHostFeaturedMarketplaceItems();
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:143

```ts
export async function createMarketplaceItem(
  dto: CreateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  if (isHostLibraryEnabled()) {
    return createHostMarketplaceItem(whitelistMarketplaceCreateDto(dto));
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:185

```ts
export async function updateMarketplaceItem(
  id: string,
  dto: UpdateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  if (isHostLibraryEnabled()) {
    const patch = whitelistMarketplaceUpdatePatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new Error('Keine erlaubten Update-Felder');
    }
    return updateHostMarketplaceItem(id, patch);
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:235

```ts
export async function deleteMarketplaceItem(id: string): Promise<boolean> {
  if (isHostLibraryEnabled()) {
    try {
      await deleteHostMarketplaceItem(id);
      return true;
    } catch {
      return false;
    }
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:276

```ts
export async function incrementDownloads(id: string): Promise<void> {
  if (isHostLibraryEnabled()) {
    try {
      await incrementHostMarketplaceDownloads(id);
    } catch (error) {
      console.error(
        'incrementHostMarketplaceDownloads failed (no client counter write):',
        error instanceof Error ? error.message : error,
      );
    }
    return;
  }
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
```

### src/infrastructure/marketplace/marketplace-service.ts:307

```ts
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
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/marketplace/client-trust.ts` | `35e6c76ef6fb9f0db4d4bb013e6fa14b9a4db37f1bf05af722e0368d969d3a34` |
| `src/domains/marketplace/contracts/marketplace.types.ts` | `000aecc695577333ad6fce27422ad02bc15f26ffca88507ebfee1fafb04b9467` |
| `src/domains/rules/ruleset-catalog/index.ts` | `c2f52133fdeaa82ca586670b79ce0144063cc852a2a5ca8b5b6b44369fc0e21e` |
| `src/domains/rules/ruleset-catalog/types.ts` | `1b76d37fc3c90d29d3f719644e6915a66462d7b55c4c6cec07a0caadfdf1512d` |
| `src/domains/user-profile/contracts/user-profile.types.ts` | `2f3f3472e9a3448099144be0993fd83bbbc2270050ce76dceadd8821501c26b7` |
| `src/domains/user-profile/display-name.ts` | `87cfc4858f198e56ea2857c505162f112efd5edacde4dbb1f7fcd995b4535516` |
| `src/domains/user-profile/index.ts` | `d094d245ff9356298ef20c48635ca3e7adcc0e1ccf180554586949e0b496c496` |
| `src/infrastructure/host/host-catalog-http.ts` | `9049245360683a74e7e2602d35126d815d64344d384c6684e4c2c3d41aa626d3` |
| `src/infrastructure/host/host-library-http.ts` | `41009cd3b0176f71e939383f9d227b7e31ccab685b88390c61dfd9756a8b6a99` |
| `src/infrastructure/marketplace/host-marketplace-adapter.ts` | `26df96d9df6c7ae0cebd69e90e85a77075fbbc1138c86b505f8dee97e7e072e0` |
| `src/infrastructure/marketplace/host-marketplace-ports.contract.ts` | `f77e7aee8352e2155253cddead1f51d9de10170ca250db27405f7f1f336fcf1b` |
| `src/infrastructure/marketplace/index.ts` | `15e40b95148db8d15546f5c1815b51f7846c343e5fc334406548c64858162542` |
| `src/infrastructure/marketplace/marketplace-service.ts` | `52c856bd8d5be2885897e155ade57bfdfed1b8eb7e48fe6fb1376b8e1a5284e8` |
| `src/lib/authenticatedUser.ts` | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

