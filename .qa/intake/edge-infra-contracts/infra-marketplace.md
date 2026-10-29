# Infrastructure contract: marketplace

**Status: SPEC; current branch source verified.** Implementation issue: **#804**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-marketplace.json](source-contracts/infra-marketplace.json) (SHA-256 `e0c19cd66e7c7af64212240980641d6b85276c7484f5d3dbcb0012aa21193ca2`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

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

`src/infrastructure/marketplace/marketplace-service.ts:28` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:24`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:75` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', id)
      .single()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:73`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:99` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .gte('rating', 3.5) // Only well-rated items
      .order('downloads', { ascending: false })
      .limit(6)
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:96`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:113` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from('marketplace_items')
        .select('*')
        .order('downloads', { ascending: false })
        .limit(6)
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:96`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:141` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:137`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:144` — literal-or-constant.

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

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:137`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:181` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:176`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:187` — literal-or-constant.

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

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:176`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/marketplace/marketplace-service.ts:221` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:219`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:223` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .delete()
      .eq('id', id)
      .eq('author_id', userId)
      .select('id')
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:219`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: increment_marketplace_downloads

`src/infrastructure/marketplace/marketplace-service.ts:254` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('increment_marketplace_downloads', {
      item_id: id,
    })
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:252`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: marketplace_items

`src/infrastructure/marketplace/marketplace-service.ts:274` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('marketplace_items')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/marketplace/marketplace-service.ts:272`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/marketplace/marketplace-service.ts:24

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:73

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:96

```ts
export async function getFeaturedItems(): Promise<MarketplaceItem[]> {
  try {
    // Get top items based on a combination of downloads and rating
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .gte('rating', 3.5) // Only well-rated items
      .order('downloads', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Error fetching featured items:', error);
      throw new Error(`Failed to fetch featured items: ${error.message}`);
    }

    // If we don't have enough high-rated items, get top downloads instead
    if (!data || data.length < 6) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('marketplace_items')
        .select('*')
        .order('downloads', { ascending: false })
        .limit(6);

      if (fallbackError) {
        console.error('Error fetching fallback items:', fallbackError);
        return data || [];
      }

      return fallbackData || [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getFeaturedItems:', error);
    throw error;
  }
}
```

### src/infrastructure/marketplace/marketplace-service.ts:137

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:176

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:219

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:252

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:272

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
| `src/domains/marketplace/client-trust.ts` | `02ff80caab306905a0eb91bc49a90634c01caf4bdfd6e6740c70273b081d7764` |
| `src/domains/marketplace/contracts/marketplace.types.ts` | `000aecc695577333ad6fce27422ad02bc15f26ffca88507ebfee1fafb04b9467` |
| `src/infrastructure/marketplace/marketplace-service.ts` | `e5249e8ef57c4d28fab9a31e1e5835180aac6546d780376db607a8a1b82d9594` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

