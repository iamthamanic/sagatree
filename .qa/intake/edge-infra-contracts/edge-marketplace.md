# Edge contract: marketplace

**Status: SPEC; current branch source verified.** Implementation issue: **#831**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-marketplace.json](source-contracts/edge-marketplace.json) (SHA-256 `9fb16426ad1a3c07b841e4c4520453e6629fcd571dee48fda2080d229c528bfb`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical seeded template marketplace in process memory; not the current marketplace_items adapter.

Dispatcher denies marketplace with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **catalog:** GET /templates?type&tag; GET /templates/:id; GET /search?q(default empty)
- **create:** POST /templates Partial<Template>; exact fields/defaults in schema/helper appendix, downloads0 and rating0
- **countRating:** POST /templates/:id/download no body; POST /templates/:id/rate {rating:number}; no identity or range verification

## Success and error contracts

- **resources:** Template/Template[] JSON200; sorted downloads descending for list; download increments count and returns full template; rate updates rating=(oldRating*(downloads||1)+rating)/((downloads||1)+1)

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- templates Map mutation only; seeded sample templates. No increment_marketplace_downloads RPC or persistent download ledger.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/marketplace; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/marketplace/index.ts:7`

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

- marketplace worker stays404 including download/rate.
- Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
- Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.

## Observed legacy defects and explicit successor decisions

- Rating average uses downloads as vote count and accepts unbounded caller rating; no author/owner authorization or persistence.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### marketplace:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/marketplace/index.ts:43`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['templates', 'search', 'download', 'rate'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### marketplace:2

Predicate: `req.method === "GET" && path === "/templates"`. Source: `supabase/functions/marketplace/index.ts:44`.


```ts
{ const type = url.searchParams.get('type') || undefined; const tag = url.searchParams.get('tag') || undefined; const list = await listTemplates(type, tag); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### marketplace:3

Predicate: `req.method === "GET" && path.match(/^\/templates\/[\w-]+$/)`. Source: `supabase/functions/marketplace/index.ts:45`.


```ts
{ const id = path.split("/")[2]; const template = await getTemplate(id); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### marketplace:4

Predicate: `req.method === "POST" && path === "/templates"`. Source: `supabase/functions/marketplace/index.ts:46`.


```ts
{ const body = await req.json(); const template = await createTemplate(body); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### marketplace:5

Predicate: `req.method === "POST" && path.match(/^\/templates\/[\w-]+\/download$/)`. Source: `supabase/functions/marketplace/index.ts:47`.


```ts
{ const id = path.split("/")[2]; const template = await downloadTemplate(id); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### marketplace:6

Predicate: `req.method === "POST" && path.match(/^\/templates\/[\w-]+\/rate$/)`. Source: `supabase/functions/marketplace/index.ts:48`.


```ts
{ const id = path.split("/")[2]; const body = await req.json(); const template = await rateTemplate(id, body.rating); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### marketplace:7

Predicate: `req.method === "GET" && path === "/search"`. Source: `supabase/functions/marketplace/index.ts:49`.


```ts
{ const query = url.searchParams.get('q') || ''; const results = await searchTemplates(query); return new Response(JSON.stringify(results), { headers: { ...headers, "Content-Type": "application/json" } }) }
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

### Template

`supabase/functions/marketplace/index.ts:13`

```ts
interface Template { id: string; name: string; type: 'ruleset' | 'character' | 'world' | 'quest' | 'npc'; author: string; description: string; data: Record<string,any>; tags: string[]; downloads: number; rating: number; createdAt: string }
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/marketplace/index.ts:27`

```ts
function generateId(): string { return crypto.randomUUID() }
```

### listTemplates

`supabase/functions/marketplace/index.ts:29`

```ts
async function listTemplates(type?: string, tag?: string): Promise<Template[]> { let all = Array.from(templates.values()); if (type) all = all.filter(t => t.type === type); if (tag) all = all.filter(t => t.tags.includes(tag)); return all.sort((a, b) => b.downloads - a.downloads) }
```

### getTemplate

`supabase/functions/marketplace/index.ts:30`

```ts
async function getTemplate(id: string): Promise<Template | null> { return templates.get(id) || null }
```

### createTemplate

`supabase/functions/marketplace/index.ts:31`

```ts
async function createTemplate(data: Partial<Template>): Promise<Template> { const id = generateId(); const template: Template = { id, name: data.name || 'Untitled', type: data.type || 'ruleset', author: data.author || 'Anonymous', description: data.description || '', data: data.data || {}, tags: data.tags || [], downloads: 0, rating: 0, createdAt: new Date().toISOString() }; templates.set(id, template); return template }
```

### downloadTemplate

`supabase/functions/marketplace/index.ts:32`

```ts
async function downloadTemplate(id: string): Promise<Template | null> { const template = templates.get(id); if (!template) return null; template.downloads++; templates.set(id, template); return template }
```

### rateTemplate

`supabase/functions/marketplace/index.ts:33`

```ts
async function rateTemplate(id: string, rating: number): Promise<Template | null> { const template = templates.get(id); if (!template) return null; const count = template.downloads || 1; template.rating = ((template.rating * count) + rating) / (count + 1); templates.set(id, template); return template }
```

### searchTemplates

`supabase/functions/marketplace/index.ts:34`

```ts
async function searchTemplates(query: string): Promise<Template[]> { const lowerQuery = query.toLowerCase(); return Array.from(templates.values()).filter(t => t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery) || t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/marketplace/index.ts` | `ed4343db87d2b2004b8e6981a89946ae5bb70da607ebfcade9d8c9edfa76d3fe` |

