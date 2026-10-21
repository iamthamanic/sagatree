# Edge contract: items

**Status: SPEC; current branch source verified.** Implementation issue: **#827**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-items.json](source-contracts/edge-items.json) (SHA-256 `7ef72cb1bcb07a26e51d03a01a5129c7e8c5c02231c2f8a616bf225a3b228187`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical seeded Item catalog and random item generator in one process Map.

Dispatcher denies items with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **listRead:** GET /items?type&rarity, GET /items/:id
- **create:** POST /items Partial<Item>; name Unknown,type other,rarity common,weight0,value0,description empty,properties{},source custom; all field types in appendix
- **generate:** POST /items/generate {type?:string,rarity?:string}; missing values randomly chosen from fixed arrays; creates random value/weight and generated name/description

## Success and error contracts

- **resources:** 200 Item[] or Item object; id UUID; known missing item404 {error:Item not found}; no pagination

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- items Map and SRD initialization; Math.random generation, no DB/provider.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/items; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

- `CHARACTER_AI_ALLOWED_ORIGIN`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

None in the reviewed source.

## Exact environment defaults and configuration resolution

### DEFAULT_CORS_METHODS

`supabase/functions/_shared/cors.ts:9`

```ts
DEFAULT_CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
```

### DEFAULT_CORS_ALLOW_HEADERS

`supabase/functions/_shared/cors.ts:10`

```ts
DEFAULT_CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type'
```

### readConfiguredOrigin

`supabase/functions/_shared/cors.ts:34`

```ts
function readConfiguredOrigin(envKeys: string[]): string {
  for (const key of envKeys) {
    const value = Deno.env.get(key)?.trim() ?? '';
    if (value) return value;
  }
  return '';
}
```

### CORS_OPTS

`supabase/functions/items/index.ts:7`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```


## Acceptance and negative tests (required, not executed)

- items worker remains404 for list/create/generate.
- Isolated fixture pins Item defaults, rarity/type filters and generated range behavior; invalid nested data records current lack of validation.
- Actual inventory_item_definitions adapter is migrated independently; do not route it to this Map catalog.

## Observed legacy defects and explicit successor decisions

- No auth/schema validation or durable inventory; this legacy catalog is distinct from persistent definitions.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### items:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/items/index.ts:41`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['items', 'search', 'filter'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### items:2

Predicate: `req.method === "GET" && path === "/items"`. Source: `supabase/functions/items/index.ts:42`.


```ts
{ const type = url.searchParams.get('type') || undefined; const rarity = url.searchParams.get('rarity') || undefined; const list = await listItems(type, rarity); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### items:3

Predicate: `req.method === "GET" && path.match(/^\/items\/[\w-]+$/)`. Source: `supabase/functions/items/index.ts:43`.


```ts
{ const id = path.split("/")[2]; const item = await getItem(id); if (!item) return new Response(JSON.stringify({ error: "Item not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### items:4

Predicate: `req.method === "POST" && path === "/items"`. Source: `supabase/functions/items/index.ts:44`.


```ts
{ const body = await req.json(); const item = await createItem(body); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### items:5

Predicate: `req.method === "POST" && path === "/items/generate"`. Source: `supabase/functions/items/index.ts:45`.


```ts
{ const types = ['weapon', 'armor', 'potion', 'scroll', 'wondrous']; const rarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary']; const item = await createItem({ name: `Magic ${types[Math.floor(Math.random() * types.length)]}`, type: types[Math.floor(Math.random() * types.length)] as Item['type'], rarity: rarities[Math.floor(Math.random() * rarities.length)] as Item['rarity'], weight: Math.floor(Math.random() * 50), value: Math.floor(Math.random() * 50000) }); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
```


## Exact type declarations

### CorsOptions

`supabase/functions/_shared/cors.ts:13`

```ts
export type CorsOptions = {
  /** Override Allow-Methods (e.g. "POST, OPTIONS" for POST-only functions). */
  methods?: string;
  allowHeaders?: string;
  /**
   * Env keys tried in order for the allowlist CSV (or explicit `*`).
   * Default: CHARACTER_AI_ALLOWED_ORIGIN
   */
  envKeys?: string[];
  /** When true (default), include Content-Type: application/json on CORS header bags. */
  includeJsonContentType?: boolean;
  /**
   * When origin does not match allowlist/localhost:
   * - omit (default): do not set Access-Control-Allow-Origin (fail-closed)
   * - configured-or-star: set configured value or `*` (legacy meshy fallback)
   */
  missingOriginPolicy?: 'omit' | 'configured-or-star';
  /** When true, echo localhost even if an allowlist env is set (legacy meshy). */
  allowLocalhostWhenConfigured?: boolean;
};
```

### Item

`supabase/functions/items/index.ts:13`

```ts
interface Item { id: string; name: string; type: 'weapon' | 'armor' | 'shield' | 'potion' | 'scroll' | 'wondrous' | 'tool' | 'other'; rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'; weight: number; value: number; description: string; properties: Record<string,any>; source: string }
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/items/index.ts:28`

```ts
function generateId(): string { return crypto.randomUUID() }
```

### listItems

`supabase/functions/items/index.ts:30`

```ts
async function listItems(type?: string, rarity?: string): Promise<Item[]> { let all = Array.from(items.values()); if (type) all = all.filter(i => i.type === type); if (rarity) all = all.filter(i => i.rarity === rarity); return all }
```

### getItem

`supabase/functions/items/index.ts:31`

```ts
async function getItem(id: string): Promise<Item | null> { return items.get(id) || null }
```

### createItem

`supabase/functions/items/index.ts:32`

```ts
async function createItem(data: Partial<Item>): Promise<Item> { const id = generateId(); const item: Item = { id, name: data.name || 'Unknown', type: data.type || 'other', rarity: data.rarity || 'common', weight: data.weight || 0, value: data.value || 0, description: data.description || '', properties: data.properties || {}, source: data.source || 'custom' }; items.set(id, item); return item }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/items/index.ts` | `df39e72e7edcc1aee6fa9a7b30c0708f1f2c5c660158699724177d0e55645fa4` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

