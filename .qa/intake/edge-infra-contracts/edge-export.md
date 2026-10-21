# Edge contract: export

**Status: SPEC; current branch source verified.** Implementation issue: **#824**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-export.json](source-contracts/edge-export.json) (SHA-256 `1fecf4111e0790b4caabcebecc5c1fa566909e7cf3b9a716b6a48149b9560aa7`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical in-memory format conversion; no stored export object or persisted import.

Dispatcher denies export with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **export:** POST /export {type:character|session|world|campaign,id:string,format:json|pdf|markdown,data:Record<string,any>}; declared types are not runtime enums except format branch
- **import:** POST /import {content:string}; JSON.parse(content), no resource/schema validation

## Success and error contracts

- **export:** 200 downloadable JSON/Markdown/minimal PDF bytes; Content-Type application/json,text/markdown,application/pdf; Content-Disposition attachment filename type-id.ext
- **import:** 200 {success:true,data:any parsed JSON}
- **errors:** Invalid format400 {error:Invalid format}; invalid contentJSON400 {error:Invalid JSON}

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- Creates response bytes only. No DB, object storage, queue, external network or actual imported resource.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/export; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/export/index.ts:7`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
  methods: 'GET, POST, OPTIONS',
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
  methods: 'GET, POST, OPTIONS',
}
```


## Acceptance and negative tests (required, not executed)

- export/import routes remain dispatcher404.
- Isolated fixture compares JSON indentation, Markdown output, PDF header/content and filename for each format; invalid format/content returns400.
- Successor import must not treat parsed JSON as persisted resource; format conversion and persistence are separate explicit contracts.

## Observed legacy defects and explicit successor decisions

- No authentication, arbitrary typed-as-any content and minimal PDF serializer; current PDF is not a validated document pipeline.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### export:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/export/index.ts:27`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['json', 'pdf', 'markdown'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### export:2

Predicate: `req.method === "POST" && path === "/export"`. Source: `supabase/functions/export/index.ts:28`.


```ts
{ const body: ExportRequest = await req.json(); let content: string | Uint8Array; let contentType: string; let filename: string; if (body.format === 'json') { content = await exportJSON(body.data); contentType = 'application/json'; filename = `${body.type}-${body.id}.json` } else if (body.format === 'markdown') { content = await exportMarkdown(body.data, body.type); contentType = 'text/markdown'; filename = `${body.type}-${body.id}.md` } else if (body.format === 'pdf') { content = await exportPDF(body.data, body.type); contentType = 'application/pdf'; filename = `${body.type}-${body.id}.pdf` } else { return new Response(JSON.stringify({ error: "Invalid format" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }) } return new Response(content as BodyInit, { headers: { ...headers, "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` } }) }
```

### export:3

Predicate: `req.method === "POST" && path === "/import"`. Source: `supabase/functions/export/index.ts:29`.


```ts
{ const body = await req.json(); let data: Record<string,any>; try { data = JSON.parse(body.content) } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }) } return new Response(JSON.stringify({ success: true, data }), { headers: { ...headers, "Content-Type": "application/json" } }) }
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

### ExportRequest

`supabase/functions/export/index.ts:14`

```ts
interface ExportRequest { type: 'character' | 'session' | 'world' | 'campaign'; id: string; format: 'json' | 'pdf' | 'markdown'; data: Record<string,any> }
```


## Exact validation, defaults and helper behavior

### exportJSON

`supabase/functions/export/index.ts:16`

```ts
async function exportJSON(data: Record<string,any>): Promise<string> { return JSON.stringify(data, null, 2) }
```

### exportMarkdown

`supabase/functions/export/index.ts:17`

```ts
async function exportMarkdown(data: Record<string,any>, type: string): Promise<string> { let md = ''; if (type === 'character') { md = `# ${data.name || 'Character'}\n\n`; md += `**Race:** ${data.race || 'Unknown'}\n\n`; md += `**Class:** ${data.class || 'Unknown'}\n\n`; md += `**Level:** ${data.level || 1}\n\n`; md += `## Attributes\n\n`; if (data.attributes) { for (const [key, value] of Object.entries(data.attributes)) { md += `- **${key}:** ${value}\n` } } md += `\n## Equipment\n\n`; if (data.equipment) { for (const item of data.equipment) { md += `- ${item.name}${item.equipped ? ' (equipped)' : ''}\n` } } } else if (type === 'session') { md = `# Session: ${data.name || 'Unknown'}\n\n`; md += `**Date:** ${data.createdAt || 'Unknown'}\n\n`; md += `## Players\n\n`; if (data.players) { for (const player of data.players) { md += `- ${player.name}\n` } } } else { md = `# ${data.name || 'Export'}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` } return md }
```

### exportPDF

`supabase/functions/export/index.ts:18`

```ts
async function exportPDF(data: Record<string,any>, type: string): Promise<Uint8Array> { const markdown = await exportMarkdown(data, type); const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${markdown.length} >>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(${markdown.replace(/\n/g, ') Tj\n0 -12 Td\n(')}) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n\n0000000${markdown.length + 300} 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${markdown.length + 400}\n%%EOF`; return new TextEncoder().encode(pdfContent) }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/export/index.ts` | `ca279bd257feaf74969fbd3c8cbec28b240fe4ffdd3de5fdddc7067570eee1e8` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

