# Infrastructure contract: marketplace

**Status: SPEC; current branch source verified.** Implementation issue: **#804**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-marketplace.json](source-contracts/infra-marketplace.json) (SHA-256 `393c10aeeb4c5efe101f587e5f0b0c8d668997ad7f7132472203abc25730f5fa`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Catalog methods use marketplace_items and increment_marketplace_downloads(item_id). list has type/searchQuery/minRating/maxPrice filters and downloads-desc default; featured queries rating>=3.5,downloads desc,limit6, falling back to top6 downloads. create derives author_id from auth.getUser, initializes rating/downloads0; update/delete filter id and rely on server RLS. delete catches errors and returnsfalse. incrementDownloads returnsvoid, falls back on any RPC error to read+write downloads+1 and swallows exceptions.

Create author_id comes from authenticated user; update/delete ownership is not checked in this adapter and must be enforced by effective server policy. Preserve published/catalog visibility as proved by SQL, not inferred from comments. The fallback count is non-atomic and cannot guarantee one durable increment.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


## Acceptance and negative tests (required, not executed)

- List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
- RPC increment succeeds atomically when installed; unavailable/denied RPC exercises read+update fallback and explicitly reports race, RLS and swallowed-error behavior.
- Create cannot use a client author_id; update/delete foreign-author attempts are denied by effective server policy; delete returnsfalse on its documented failures.

## Observed source defects and explicit successor decisions

- incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
- Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

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

### src/infrastructure/marketplace/marketplace-service.ts:38

```ts
export async function getMarketplaceItems(
  filters?: MarketplaceFilters
): Promise<MarketplaceItem[]> {
  assertHost();
  return fetchHostMarketplaceItems(filters);
}
```

### src/infrastructure/marketplace/marketplace-service.ts:48

```ts
export async function getMarketplaceItemById(id: string): Promise<MarketplaceItem | null> {
  assertHost();
  return fetchHostMarketplaceItem(id);
}
```

### src/infrastructure/marketplace/marketplace-service.ts:56

```ts
export async function getFeaturedItems(): Promise<MarketplaceItem[]> {
  assertHost();
  return fetchHostFeaturedMarketplaceItems();
}
```

### src/infrastructure/marketplace/marketplace-service.ts:64

```ts
export async function createMarketplaceItem(
  dto: CreateMarketplaceItemDTO
): Promise<MarketplaceItem> {
  assertHost();
  return createHostMarketplaceItem(whitelistMarketplaceCreateDto(dto));
}
```

### src/infrastructure/marketplace/marketplace-service.ts:74

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:89

```ts
export async function deleteMarketplaceItem(id: string): Promise<boolean> {
  assertHost();
  try {
    await deleteHostMarketplaceItem(id);
    return true;
  } catch {
    return false;
  }
}
```

### src/infrastructure/marketplace/marketplace-service.ts:103

```ts
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
```

### src/infrastructure/marketplace/marketplace-service.ts:118

```ts
export async function getItemsByAuthor(authorId: string): Promise<MarketplaceItem[]> {
  assertHost();
  const items = await fetchHostMarketplaceItems();
  return items
    .filter((item) => item.author_id === authorId)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
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
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/infrastructure/marketplace/host-marketplace-adapter.ts` | `26df96d9df6c7ae0cebd69e90e85a77075fbbc1138c86b505f8dee97e7e072e0` |
| `src/infrastructure/marketplace/host-marketplace-ports.contract.ts` | `f77e7aee8352e2155253cddead1f51d9de10170ca250db27405f7f1f336fcf1b` |
| `src/infrastructure/marketplace/index.ts` | `15e40b95148db8d15546f5c1815b51f7846c343e5fc334406548c64858162542` |
| `src/infrastructure/marketplace/marketplace-service.ts` | `d2135007e96a4775dea0a8b238312a72539a0541c9095024323c128b15a8afe1` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |

