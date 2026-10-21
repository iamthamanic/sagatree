# Edge contract: media

**Status: SPEC; current branch source verified.** Implementation issue: **#832**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-media.json](source-contracts/edge-media.json) (SHA-256 `dcbd49ee156d84d2f2f61f871f9221275bbde9fdbcba805f03b93c31f27f44f3`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical media metadata Map; upload constructs a URL without storing bytes.

Dispatcher denies media with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **upload:** POST /upload {filename:string,content:string(base64),projectId?:string,characterId?:string,tags?:string[],uploadedBy:string}; filename extension selects MIME; content length estimates size
- **read:** GET /media?projectId&type(prefix MIME); GET /media/:id
- **mutate:** PUT /media/:id/tags {tags:string[]}; DELETE /media/:id

## Success and error contracts

- **media:** {id,filename,type,size,url,projectId?,characterId?,tags,uploadedBy,uploadedAt}; size=floor(content.length*3/4), URL SUPABASE_URL(default localhost:8000)/storage/v1/object/media/id-filename
- **delete:** {success:true} even absent id; metadata read absent404; tag update absent throws500

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- Only mediaFiles Map; no Supabase Storage upload, delete, signing, file validation or DB row persistence.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/media; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

- `CHARACTER_AI_ALLOWED_ORIGIN`
- `SUPABASE_URL`

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

`supabase/functions/media/index.ts:7`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```

### STORAGE_URL

`supabase/functions/media/index.ts:16`

```ts
STORAGE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:8000"
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

- media worker stays404.
- Isolated metadata upload records calculated URL/MIME/size but makes zero storage calls; delete never claims physical object deletion.
- Filename/path and spoofed uploadedBy are unvalidated historical inputs; successor storage API requires its independent owner-path contract.

## Observed legacy defects and explicit successor decisions

- Upload response points at an object that this worker never creates; content is not decoded/validated, and uploadedBy is client-controlled.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### media:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/media/index.ts:34`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['upload', 'download', 'delete', 'tags'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### media:2

Predicate: `req.method === "POST" && path === "/upload"`. Source: `supabase/functions/media/index.ts:35`.


```ts
{ const body = await req.json(); const media = await uploadMedia(body); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### media:3

Predicate: `req.method === "GET" && path === "/media"`. Source: `supabase/functions/media/index.ts:36`.


```ts
{ const projectId = url.searchParams.get('projectId') || undefined; const type = url.searchParams.get('type') || undefined; const list = await listMedia(projectId, type); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### media:4

Predicate: `req.method === "GET" && path.match(/^\/media\/[\w-]+$/)`. Source: `supabase/functions/media/index.ts:37`.


```ts
{ const id = path.split("/")[2]; const media = await getMedia(id); if (!media) return new Response(JSON.stringify({ error: "Media not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### media:5

Predicate: `req.method === "PUT" && path.match(/^\/media\/[\w-]+\/tags$/)`. Source: `supabase/functions/media/index.ts:38`.


```ts
{ const id = path.split("/")[2]; const body = await req.json(); const media = await updateMediaTags(id, body.tags); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### media:6

Predicate: `req.method === "DELETE" && path.match(/^\/media\/[\w-]+$/)`. Source: `supabase/functions/media/index.ts:39`.


```ts
{ const id = path.split("/")[2]; await deleteMedia(id); return new Response(JSON.stringify({ success: true }), { headers: { ...headers, "Content-Type": "application/json" } }) }
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

### Media

`supabase/functions/media/index.ts:13`

```ts
interface Media { id: string; filename: string; type: string; size: number; url: string; projectId?: string; characterId?: string; tags: string[]; uploadedBy: string; uploadedAt: string }
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/media/index.ts:18`

```ts
function generateId(): string { return crypto.randomUUID() }
```

### getMimeType

`supabase/functions/media/index.ts:19`

```ts
function getMimeType(filename: string): string { const ext = filename.split('.').pop()?.toLowerCase(); const types: Record<string,string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm' }; return types[ext || ''] || 'application/octet-stream' }
```

### uploadMedia

`supabase/functions/media/index.ts:21`

```ts
async function uploadMedia(data: { filename: string; content: string; projectId?: string; characterId?: string; tags?: string[]; uploadedBy: string }): Promise<Media> { const id = generateId(); const type = getMimeType(data.filename); const url = `${STORAGE_URL}/storage/v1/object/media/${id}-${data.filename}`; const size = Math.floor((data.content.length * 3) / 4); const media: Media = { id, filename: data.filename, type, size, url, projectId: data.projectId, characterId: data.characterId, tags: data.tags || [], uploadedBy: data.uploadedBy, uploadedAt: new Date().toISOString() }; mediaFiles.set(id, media); return media }
```

### getMedia

`supabase/functions/media/index.ts:22`

```ts
async function getMedia(id: string): Promise<Media | null> { return mediaFiles.get(id) || null }
```

### listMedia

`supabase/functions/media/index.ts:23`

```ts
async function listMedia(projectId?: string, type?: string): Promise<Media[]> { let all = Array.from(mediaFiles.values()); if (projectId) all = all.filter(m => m.projectId === projectId); if (type) all = all.filter(m => m.type.startsWith(type)); return all }
```

### deleteMedia

`supabase/functions/media/index.ts:24`

```ts
async function deleteMedia(id: string): Promise<void> { mediaFiles.delete(id) }
```

### updateMediaTags

`supabase/functions/media/index.ts:25`

```ts
async function updateMediaTags(id: string, tags: string[]): Promise<Media> { const media = mediaFiles.get(id); if (!media) throw new Error("Media not found"); media.tags = tags; mediaFiles.set(id, media); return media }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/media/index.ts` | `66a58039d5dbbeb94de3eb7f33e127d4559409e7839a777d754e2d3f8bc5843a` |

