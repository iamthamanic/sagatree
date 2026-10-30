# Edge contract: look-reference-analysis

**Status: SPEC; current branch source verified.** Implementation issue: **#828**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-look-reference-analysis.json](source-contracts/edge-look-reference-analysis.json) (SHA-256 `6ffa849ec73c8443c6141dd9aceaa36b8a61e14964e5c3fe3861c2fd3c8cfc82`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**allowlisted-worker** — Current branch mount; a successor cutover still requires gates and contract tests.

Analyze 1..10 user-supplied style/content images using configured vision provider; client normalizes returned profile payload.

Authenticated user; storage references must normalize to caller userId/ prefix and contain neither '..' nor backslash. Arbitrary URI is metadata only: image bytes come from inline base64 or the configured storage bucket.

## Request variants, fields and defaults

- **body:** {action:'analyze',references:Reference[1..10],displayNameHint?:string(trimmed,max80)}
- **reference:** {id:string(nonempty,unique),kind:'style'|'content',mime:'image/png'|'image/jpeg'|'image/webp',uri:string(nonempty),weight?:number0..1,label?:string(max80),contentBase64?:string,storagePath?:string}; inline bytes take precedence when both supplied
- **limits:** Declared Content-Length <=12MiB; each validated decoded image<=8MiB with magic/MIME checks. Request currently does not independently enforce actual JSON byte length.

## Success and error contracts

- **generated:** {status:'ok',payload:object,analyzedAtIso:string}; top-level apiKey/authorization/providerSecret removed from provider payload
- **unconfigured:** HTTP200 {status:'not-configured',message:string}

- 405 method; 413 declared length; 401 auth; 429 process quota; 400 invalid action/reference/image/storage path; 500 malformed JSON/provider/other exceptions
- Provider absent returns200 not-configured before request JSON parsing

## Side effects and transaction boundaries

- Reads inline bytes or owner-prefixed storage object in LOOK_REFERENCE_STORAGE_BUCKET default media; sends images to vision provider
- No LookProfile or image persistence; only memory quota changes

## Quota, environment and transport


```json
{
  "kind": "process-memory",
  "scope": "authenticated userId",
  "defaultLimit": 4,
  "maxConfiguredLimit": 30,
  "windowSeconds": 60,
  "env": "LOOK_AI_RATE_LIMIT_PER_MINUTE",
  "chargedActions": [
    "every authenticated POST before provider/body validation"
  ],
  "restart": "Map resets with worker/process; not a persistent quota"
}
```

Auth10s, storage30s, vision90s. POST baseUrl/chat/completions with temperature0.2,response_format json_object and image data URIs. LOOK_AI_BASE_URL/MODEL/API_KEY each falls back to CHARACTER_AI_*; all three required. No arbitrary URI fetch or retry.

- `CHARACTER_AI_ALLOWED_ORIGIN`
- `CHARACTER_AI_API_KEY`
- `CHARACTER_AI_BASE_URL`
- `CHARACTER_AI_MODEL`
- `LOOK_AI_ALLOWED_ORIGIN`
- `LOOK_AI_API_KEY`
- `LOOK_AI_BASE_URL`
- `LOOK_AI_MODEL`
- `LOOK_AI_RATE_LIMIT_PER_MINUTE`
- `LOOK_REFERENCE_STORAGE_BUCKET`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

- `supabase/functions/_shared/look-reference-analysis-provider.ts:148` — `AbortSignal.timeout(90_000)`
- `supabase/functions/look-reference-analysis/index.ts:94` — `AbortSignal.timeout(10_000)`
- `supabase/functions/look-reference-analysis/index.ts:121` — `AbortSignal.timeout(30_000)`

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

### resolveLookRefVisionProviderConfig

`supabase/functions/_shared/look-reference-analysis-provider.ts:26`

```ts
export function resolveLookRefVisionProviderConfig(): LookRefVisionProviderConfig | null {
  const baseUrl = (
    Deno.env.get('LOOK_AI_BASE_URL') ||
    Deno.env.get('CHARACTER_AI_BASE_URL') ||
    ''
  ).trim();
  const model = (
    Deno.env.get('LOOK_AI_MODEL') ||
    Deno.env.get('CHARACTER_AI_MODEL') ||
    ''
  ).trim();
  const apiKey = (
    Deno.env.get('LOOK_AI_API_KEY') ||
    Deno.env.get('CHARACTER_AI_API_KEY') ||
    ''
  ).trim();
  if (!baseUrl || !model || !apiKey) return null;
  return {
    baseUrl: trimTrailingSlash(baseUrl),
    model,
    apiKey,
  };
}
```

### CORS_OPTS

`supabase/functions/look-reference-analysis/index.ts:36`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['LOOK_AI_ALLOWED_ORIGIN', 'CHARACTER_AI_ALLOWED_ORIGIN'],
}
```

### DEFAULT_RATE_LIMIT

`supabase/functions/look-reference-analysis/index.ts:44`

```ts
DEFAULT_RATE_LIMIT = 4
```

### LOOK_MEDIA_BUCKET

`supabase/functions/look-reference-analysis/index.ts:46`

```ts
LOOK_MEDIA_BUCKET =
  Deno.env.get('LOOK_REFERENCE_STORAGE_BUCKET')?.trim() || 'media'
```

### getRateLimit

`supabase/functions/look-reference-analysis/index.ts:57`

```ts
function getRateLimit(): number {
  const configured = Number.parseInt(
    Deno.env.get('LOOK_AI_RATE_LIMIT_PER_MINUTE') || '',
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 30)
    : DEFAULT_RATE_LIMIT;
}
```

### getSupabaseConfig

`supabase/functions/look-reference-analysis/index.ts:67`

```ts
function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  return url && anonKey
    ? {
        url: url.replace(/\/+$/, ''),
        anonKey,
        serviceRoleKey: serviceRoleKey || undefined,
      }
    : null;
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |
| storage | `LOOK_REFERENCE_STORAGE_BUCKET (default media)` | #841 |  |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['LOOK_AI_ALLOWED_ORIGIN', 'CHARACTER_AI_ALLOWED_ORIGIN'],
}
```


## Acceptance and negative tests (required, not executed)

- 1 and10 valid images accepted; 0/11 images, duplicate IDs, unsupported MIME, invalid weights and absent bytes/storage rejected400.
- Foreign-user path, traversal and backslash cannot cause storage fetch; inline bytes override storagePath when both present.
- Fifth request in default worker window429; process restart behavior explicitly recorded as memory-only.
- Provider absence200 not-configured; successful payload strips top-level secret-like keys and never persists a LookProfile.
- Pin current header-only12MiB envelope and <=8MiB validated image behavior; future stronger actual-body/recursive-redaction behavior must be explicit.

## Observed legacy defects and explicit successor decisions

- Envelope size limit trusts Content-Length; nested secret-like provider keys are not recursively removed.

## All adapter call sites

### src/infrastructure/look/look-reference-analysis-service.ts:127


```ts
export async function analyzeLookReferences(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  const aggregateBytes = request.references.reduce(
    (sum, ref) => sum + estimateBase64Bytes(ref.contentBase64),
    0,
  );
  if (aggregateBytes > LOOK_REFERENCE_AGGREGATE_MAX_BYTES) {
    return {
      ok: false,
      code: 'edge-error',
      messageDe: `Gesamtgröße der Referenzbilder überschreitet ${(LOOK_REFERENCE_AGGREGATE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
    };
  }

  const domainInputs: LookReferenceAnalysisImageInput[] = request.references.map(
    (ref) => ({
      id: ref.id,
      kind: ref.kind,
      mime: ref.mime,
      uri: ref.uri,
      weight: ref.weight,
      label: ref.label,
    }),
  );

  const { data, error } = await supabase.functions.invoke(
    'look-reference-analysis',
    {
      body: {
        action: 'analyze',
        displayNameHint: request.displayNameHint,
        references: request.references.map((ref) => ({
          id: ref.id,
          kind: ref.kind,
          mime: ref.mime,
          uri: ref.uri,
          weight: ref.weight,
          label: ref.label,
          contentBase64: ref.contentBase64,
          storagePath: ref.storagePath,
        })),
      },
    },
  );

  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    return {
      ok: false,
      code: 'edge-error',
      messageDe:
        serverMessage ??
        'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }

  const edge = parseEdgeResponse(data);
  if (edge.status !== 'ok') {
    return {
      ok: false,
      code: edge.status,
      messageDe: edge.message,
    };
  }

  return normalizeLookReferenceAnalysisPayload(edge.payload, {
    references: domainInputs,
    displayNameHint: request.displayNameHint,
    analyzedAtIso: edge.analyzedAtIso,
  });
}
```


## Exact ordered operations

### look-reference-analysis:handler

Predicate: `Complete handler with ordered method/auth/body guards`. Source: `supabase/functions/look-reference-analysis/index.ts:194`.


```ts
serve(async (request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return jsonResponse(request, { status: 'error', message: 'Method not allowed' }, 405);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse(
        request,
        { status: 'error', message: 'Request too large' },
        413,
      );
    }

    const userId = await authenticate(request);
    if (!userId) {
      return jsonResponse(
        request,
        { status: 'error', message: 'Nicht angemeldet.' },
        401,
      );
    }

    const rate = consumeLookReferenceAnalysisRateLimit({
      userId,
      limit: getRateLimit(),
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (rate.ok === false) {
      return jsonResponse(
        request,
        {
          status: 'error',
          message: `Zu viele Anfragen. Bitte in ${rate.retryAfterSeconds}s erneut versuchen.`,
        },
        429,
      );
    }

    const provider = resolveLookRefVisionProviderConfig();
    if (!provider) {
      return jsonResponse(request, {
        status: 'not-configured',
        message: 'Look-Analyse ist serverseitig nicht konfiguriert.',
      });
    }

    const body: unknown = await request.json();
    const privilegedReject = privilegedClientBodyRejectionMessage(body);
    if (privilegedReject) {
      return jsonResponse(request, { status: 'error', message: privilegedReject }, 400);
    }
    if (!isRecord(body) || body.action !== 'analyze') {
      return jsonResponse(
        request,
        { status: 'error', message: 'Ungültige Anfrage.' },
        400,
      );
    }

    const displayNameHint =
      typeof body.displayNameHint === 'string'
        ? body.displayNameHint.trim().slice(0, 80)
        : undefined;

    let parsedRefs: ParsedRef[];
    try {
      parsedRefs = parseReferences(body.references);
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : 'Invalid references';
      return jsonResponse(request, { status: 'error', message }, 400);
    }

    const visionImages: LookRefVisionImagePart[] = [];
    for (const ref of parsedRefs) {
      let bytes: Uint8Array;
      try {
        if (ref.contentBase64) {
          bytes = decodeLookRefBase64Image(ref.contentBase64);
        } else if (ref.storagePath) {
          bytes = await fetchOwnerStorageBytes(ref.storagePath, userId);
        } else {
          throw new Error('Missing image bytes');
        }
        const validated = validateLookRefImageBytes(bytes, ref.mime);
        visionImages.push({
          id: ref.id,
          kind: ref.kind,
          mime: validated.mime,
          base64: bytesToBase64(validated.bytes),
          weight: ref.weight,
        });
      } catch (imageError) {
        console.error('[look-reference-analysis] image error', ref.id, imageError);
        return jsonResponse(
          request,
          {
            status: 'error',
            message: `Referenz ${ref.id} konnte nicht gelesen werden.`,
          },
          400,
        );
      }
    }

    const payload = await analyzeLookReferencesWithVision(
      provider,
      visionImages,
      displayNameHint,
    );
    const analyzedAtIso = new Date().toISOString();

    // Strip accidental secret-like keys before leaving the edge.
    const safePayload: JsonRecord = { ...payload };
    delete safePayload.apiKey;
    delete safePayload.authorization;
    delete safePayload.providerSecret;

    return jsonResponse(request, {
      status: 'ok',
      payload: safePayload,
      analyzedAtIso,
    });
  } catch (error) {
    console.error('[look-reference-analysis] failed', error);
    return jsonResponse(
      request,
      {
        status: 'error',
        message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
      },
      500,
    );
  }
});
```


## Exact type declarations

### PrivilegedClientBodyKey

`supabase/functions/_shared/client-trust-body.ts:20`

```ts
export type PrivilegedClientBodyKey = (typeof PRIVILEGED_CLIENT_BODY_KEYS)[number];
```

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

### LookRefAnalysisMime

`supabase/functions/_shared/look-reference-analysis-image.ts:13`

```ts
export type LookRefAnalysisMime = (typeof LOOK_REF_ANALYSIS_ALLOWED_MIME)[number];
```

### LookRefVisionProviderConfig

`supabase/functions/_shared/look-reference-analysis-provider.ts:8`

```ts
export type LookRefVisionProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
};
```

### LookRefVisionImagePart

`supabase/functions/_shared/look-reference-analysis-provider.ts:14`

```ts
export type LookRefVisionImagePart = {
  id: string;
  kind: 'style' | 'content';
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  base64: string;
  weight?: number;
};
```

### JsonRecord

`supabase/functions/look-reference-analysis/index.ts:34`

```ts
type JsonRecord = Record<string, unknown>;
```

### ParsedRef

`supabase/functions/look-reference-analysis/index.ts:133`

```ts
type ParsedRef = {
  id: string;
  kind: 'style' | 'content';
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  weight?: number;
  label?: string;
  uri: string;
  contentBase64?: string;
  storagePath?: string;
};
```


## Exact validation, defaults and helper behavior

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

### validateLookRefImageBytes

`supabase/functions/_shared/look-reference-analysis-image.ts:73`

```ts
export function validateLookRefImageBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: LookRefAnalysisMime; bytes: Uint8Array } {
  if (bytes.length === 0 || bytes.length > LOOK_REF_ANALYSIS_MAX_BYTES) {
    throw new Error('Image size out of range');
  }
  const sniffed = sniffLookRefAnalysisMime(bytes);
  if (!sniffed) throw new Error('Unsupported image format');
  if (claimedMime && claimedMime !== sniffed) {
    throw new Error('Claimed mime does not match image bytes');
  }
  return { mime: sniffed, bytes };
}
```

### buildSystemPrompt

`supabase/functions/_shared/look-reference-analysis-provider.ts:79`

```ts
function buildSystemPrompt(): string {
  return [
    'You analyze visual references for a SagaTree LookProfile draft.',
    'Return ONLY a JSON object with keys:',
    'displayName (string),',
    'palette { primary, secondary, accent, background } as #RRGGBB,',
    'knobs { characterStylization, characterOutline, lightingWarmth, lightingKey, postFxContrast, postFxSaturation } as integers 0-100,',
    'contentNotes (string, motif/subject only).',
    'Use STYLE images for palette and knobs. CONTENT images inform contentNotes only — never treat content as style.',
    'If no style images are provided, return neutral knobs (around 50) and a neutral gray palette.',
    'Do not include provider names, API keys, or free-form schema extensions.',
  ].join(' ');
}
```

### CORS_OPTS

`supabase/functions/look-reference-analysis/index.ts:36`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['LOOK_AI_ALLOWED_ORIGIN', 'CHARACTER_AI_ALLOWED_ORIGIN'],
}
```

### MAX_REQUEST_BYTES

`supabase/functions/look-reference-analysis/index.ts:41`

```ts
MAX_REQUEST_BYTES = 12 * 1024 * 1024
```

### MAX_IMAGES

`supabase/functions/look-reference-analysis/index.ts:43`

```ts
MAX_IMAGES = 10
```

### DEFAULT_RATE_LIMIT

`supabase/functions/look-reference-analysis/index.ts:44`

```ts
DEFAULT_RATE_LIMIT = 4
```

### RATE_LIMIT_WINDOW_SECONDS

`supabase/functions/look-reference-analysis/index.ts:45`

```ts
RATE_LIMIT_WINDOW_SECONDS = 60
```

### parseReferences

`supabase/functions/look-reference-analysis/index.ts:144`

```ts
function parseReferences(value: unknown): ParsedRef[] {
  if (!Array.isArray(value)) throw new Error('references must be an array');
  if (value.length < MIN_IMAGES || value.length > MAX_IMAGES) {
    throw new Error('references must contain 1 to 10 images');
  }
  const out: ParsedRef[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) throw new Error('invalid reference entry');
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const kind = entry.kind;
    const mime = typeof entry.mime === 'string' ? entry.mime.trim() : '';
    const uri = typeof entry.uri === 'string' ? entry.uri.trim() : '';
    if (!id || ids.has(id)) throw new Error('reference id invalid or duplicate');
    ids.add(id);
    if (kind !== 'style' && kind !== 'content') {
      throw new Error('reference kind must be style or content');
    }
    if (!isAllowedLookRefAnalysisMime(mime)) {
      throw new Error('reference mime must be png, jpeg, or webp');
    }
    if (!uri) throw new Error('reference uri is required');
    let weight: number | undefined;
    if (entry.weight !== undefined) {
      if (typeof entry.weight !== 'number' || entry.weight < 0 || entry.weight > 1) {
        throw new Error('reference weight must be between 0 and 1');
      }
      weight = entry.weight;
    }
    const contentBase64 =
      typeof entry.contentBase64 === 'string' ? entry.contentBase64 : undefined;
    const storagePath =
      typeof entry.storagePath === 'string' ? entry.storagePath.trim() : undefined;
    if (!contentBase64 && !storagePath) {
      throw new Error('reference needs contentBase64 or storagePath');
    }
    out.push({
      id,
      kind,
      mime,
      weight,
      label: typeof entry.label === 'string' ? entry.label.slice(0, 80) : undefined,
      uri,
      contentBase64,
      storagePath,
    });
  }
  return out;
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/infrastructure/look/look-reference-analysis-service.ts` | `a032b123fff9a4fe81429f04cc3113fb776d296f069952f147293f350ebf50a3` |
| `supabase/functions/_shared/client-trust-body.ts` | `33c68553dbd89d9c7899520b0ebfa35c4f245ed8ab8ebd242c6f79e9852add95` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/_shared/look-reference-analysis-image.ts` | `30aadc256afc844ea12b0cd73aa461c810ebfbbf1185006c7881a433976c2357` |
| `supabase/functions/_shared/look-reference-analysis-provider.ts` | `04e4290f93d9c47e76a77c816c8934d19774a6a7e9682885fdcff493c69714bb` |
| `supabase/functions/_shared/look-reference-analysis-rate-limit.ts` | `31d18e8f0041595b5212945b65cbf63f08dd7d84a47d938ef296da84ae082834` |
| `supabase/functions/look-reference-analysis/index.ts` | `9f0da17201e85b482eab07a956dcfbd6b7aa411bec9b04e35580db7f37716874` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

