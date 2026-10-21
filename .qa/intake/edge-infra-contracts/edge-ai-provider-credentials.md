# Edge contract: ai-provider-credentials

**Status: SPEC; current branch source verified.** Implementation issue: **#818**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-ai-provider-credentials.json](source-contracts/edge-ai-provider-credentials.json) (SHA-256 `3d23c3ab5973c518f370ba18678e8c693fe7406752c9f5854528ce7e7070ed01`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**allowlisted-worker** — Current branch mount; a successor cutover still requires gates and contract tests.

Manage the authenticated account's encrypted BYOK keys; no project/session membership is required.

After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every credential read/update/delete filters user_id = that userId; inserts set it server-side. Meshy is the only catalog provider. No owner from request is trusted.

## Request variants, fields and defaults

- **transport:** POST JSON at any worker subpath; OPTIONS 204; other methods 405
- **list:** {action:'list',modality?:string}; valid image|3d|video|audio filter; missing/unknown modality => null/all. Catalog currently only meshy with image/3d and auth:'api_key'; video/audio => providers:[]
- **upsert:** {action:'upsert',providerId:string,apiKey:string}; trimmed, provider meshy, key nonempty then msy_ prefix and20..200 characters; invalid shape400, validation quota charged before provider check
- **refresh:** {action:'refresh',providerId:string}; existing encrypted key required
- **delete:** {action:'delete',providerId:string}; known provider required, idempotent when no row exists

## Success and error contracts

- **list:** {status:'ok',modality:AiModality|null,providers:ProviderPublicView[]}
- **providerView:** {providerId,displayName,modalities,auth,docsUrl:string|null,configured:boolean,keyHint:string|null,status:string|null,addedAt:string|null,lastValidatedAt:string|null,meta:{credits?:number}}; credits rounded, finite and >=0; no ciphertext/plaintext
- **upsertRefresh:** {status:'ok',provider:ProviderPublicView}
- **delete:** {status:'ok',providerId:string}

- 400 malformed JSON, missing action/key, unknown provider/action or rejected provider key
- 401 missing/invalid user; 405 non-POST; 500 missing server config/persistence/decrypt/unexpected failure
- 503 missing encryption key; 404 refresh with no stored secret; 429 quota denied
- listCredentials converts DB error to empty rows; refresh currently ignores PATCH response status. These are source behaviors, not verified success persistence guarantees.

## Side effects and transaction boundaries

- upsert validates Meshy key, encrypts with AES-GCM using CREDENTIALS_ENCRYPTION_KEY, inserts or PATCHes user_ai_provider_credentials; preserves existing added_at
- refresh decrypts owner key, validates credits, PATCHes status/last_validated_at/meta; provider rejection marks invalid
- delete removes owner/provider row; list reads only public projection
- upsert and refresh consume persistent quota before provider calls

## Quota, environment and transport


```json
{
  "kind": "persistent-rpc",
  "rpc": "consume_ai_provider_credential_rate_limit",
  "scope": "authenticated userId",
  "defaultLimit": 8,
  "maxConfiguredLimit": 60,
  "windowSeconds": 60,
  "env": "AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE",
  "chargedActions": [
    "upsert",
    "refresh"
  ],
  "failure": "non-ok RPC or result != true returns 429"
}
```

Auth10s, service20s, Meshy GET /balance15s. No automatic retry. Meshy keys require msy_ prefix and20..200 chars before outbound validation; service role and ciphertext are never returned.

- `AI_PROVIDER_ALLOWED_ORIGIN`
- `AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE`
- `CHARACTER_AI_ALLOWED_ORIGIN`
- `CREDENTIALS_ENCRYPTION_KEY`
- `ITEM_MODEL3D_ALLOWED_ORIGIN`
- `ITEM_THUMBNAIL_ALLOWED_ORIGIN`
- `MESHY_API_BASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

- `supabase/functions/_shared/ai-provider-meshy.ts:56` — `AbortSignal.timeout(15_000)`
- `supabase/functions/ai-provider-credentials/index.ts:93` — `AbortSignal.timeout(10_000)`
- `supabase/functions/ai-provider-credentials/index.ts:115` — `AbortSignal.timeout(20_000)`

## Exact environment defaults and configuration resolution

### DEFAULT_BASE

`supabase/functions/_shared/ai-provider-meshy.ts:19`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1'
```

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

`supabase/functions/ai-provider-credentials/index.ts:29`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'AI_PROVIDER_ALLOWED_ORIGIN',
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```

### DEFAULT_RATE_LIMIT

`supabase/functions/ai-provider-credentials/index.ts:55`

```ts
DEFAULT_RATE_LIMIT = 8
```

### getSupabaseConfig

`supabase/functions/ai-provider-credentials/index.ts:70`

```ts
function getSupabaseConfig(): SupabaseConfig | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey, serviceRoleKey };
}
```

### getRateLimit

`supabase/functions/ai-provider-credentials/index.ts:78`

```ts
function getRateLimit(): number {
  const configured = Number.parseInt(
    Deno.env.get('AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE') || '',
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 60)
    : DEFAULT_RATE_LIMIT;
}
```

### validateProviderApiKey

`supabase/functions/ai-provider-credentials/index.ts:222`

```ts
async function validateProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: true; credits?: number } | { ok: false; message: string }> {
  if (providerId === 'meshy') {
    const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim();
    const result = await validateMeshyApiKey(apiKey, { baseUrl });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, credits: result.credits };
  }
  return { ok: false, message: 'Unbekannter Provider.' };
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |
| internal-rpc | `consume_ai_provider_credential_rate_limit` | #818 | quota prerequisite owned by this Edge port |
| table | `user_ai_provider_credentials` | #791 | Policy #792 |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'AI_PROVIDER_ALLOWED_ORIGIN',
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```


## Acceptance and negative tests (required, not executed)

- Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
- List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
- Ninth upsert/refresh inside the default 60s window returns 429, list/delete do not consume quota; store failure must not call Meshy.
- Missing encryption key yields 503, rejected key yields 400; upsert preserves added_at and delete of absent own row succeeds.
- Inject refresh persistence failure: record current ignored PATCH behavior and require explicit successor error contract; never claim key refresh was durably stored from response alone.

## Observed legacy defects and explicit successor decisions

- Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.

## All adapter call sites

### src/infrastructure/ai/ai-provider-credentials-service.ts:57


```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('ai-provider-credentials', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'AI-Provider-Dienst nicht erreichbar.');
  }
  return parseResponse(data);
}
```


## Exact ordered operations

### ai-provider-credentials:1

Predicate: `action === 'list'`. Source: `supabase/functions/ai-provider-credentials/index.ts:265`.


```ts
{
      const modalityRaw = typeof body.modality === 'string' ? body.modality : '';
      const modality: AiModality | null = isAiModality(modalityRaw) ? modalityRaw : null;
      const catalog = modality ? listProvidersForModality(modality) : [...AI_PROVIDER_CATALOG];
      const rows = await listCredentials(config, userId);
      const byId = new Map(rows.map((r) => [r.provider_id, r]));

      const providers = catalog.map((def) => {
        const row = byId.get(def.id);
        if (!row) {
          return {
            providerId: def.id,
            displayName: def.displayName,
            modalities: [...def.modalities],
            auth: def.auth,
            docsUrl: def.docsUrl ?? null,
            configured: false,
            keyHint: null,
            status: null,
            addedAt: null,
            lastValidatedAt: null,
            meta: {},
          };
        }
        return {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(row, def.modalities),
        };
      });

      return jsonResponse(request, {
        status: 'ok',
        modality: modality,
        providers,
      });
    }
```

### ai-provider-credentials:2

Predicate: `action === 'upsert'`. Source: `supabase/functions/ai-provider-credentials/index.ts:304`.


```ts
{
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const def = getProviderDefinition(providerId);
      if (!def) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }
      if (!apiKey) {
        return jsonResponse(request, { status: 'error', message: 'API-Key fehlt.' }, 400);
      }

      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Zu viele Versuche. Bitte kurz warten.', code: 'rate_limited' },
          429,
        );
      }

      const encRaw = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
      if (!encRaw) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
            code: 'not-configured',
          },
          503,
        );
      }

      const validated = await validateProviderApiKey(providerId, apiKey);
      if (!validated.ok) {
        return jsonResponse(request, { status: 'error', message: validated.message }, 400);
      }

      const ciphertext = await encryptProviderSecret(apiKey, encRaw);
      const keyHint = buildKeyHint(apiKey);
      const now = new Date().toISOString();
      const meta: JsonRecord = validated.credits === undefined
        ? {}
        : { credits: validated.credits };

      const existing = await loadCredentialWithSecret(config, userId, providerId);
      let addedAt = existing?.added_at ?? now;
      let upsertResponse: Response;

      if (existing) {
        upsertResponse = await serviceFetch(
          config,
          `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              secret_ciphertext: ciphertext,
              key_hint: keyHint,
              status: 'active',
              last_validated_at: now,
              meta,
              updated_at: now,
            }),
          },
        );
      } else {
        upsertResponse = await serviceFetch(
          config,
          '/rest/v1/user_ai_provider_credentials',
          {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId,
              provider_id: providerId,
              secret_ciphertext: ciphertext,
              key_hint: keyHint,
              status: 'active',
              added_at: now,
              last_validated_at: now,
              meta,
              updated_at: now,
            }),
          },
        );
        addedAt = now;
      }

      if (!upsertResponse.ok) {
        console.error('credential upsert failed', upsertResponse.status);
        return jsonResponse(
          request,
          { status: 'error', message: 'Credential konnte nicht gespeichert werden.' },
          500,
        );
      }

      return jsonResponse(request, {
        status: 'ok',
        provider: {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(
            {
              provider_id: providerId,
              key_hint: keyHint,
              status: 'active',
              added_at: addedAt,
              last_validated_at: now,
              meta,
            },
            def.modalities,
          ),
        },
      });
    }
```

### ai-provider-credentials:3

Predicate: `action === 'refresh'`. Source: `supabase/functions/ai-provider-credentials/index.ts:421`.


```ts
{
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      const def = getProviderDefinition(providerId);
      if (!def) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }

      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Zu viele Versuche. Bitte kurz warten.', code: 'rate_limited' },
          429,
        );
      }

      const encRaw = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
      if (!encRaw) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
            code: 'not-configured',
          },
          503,
        );
      }

      const row = await loadCredentialWithSecret(config, userId, providerId);
      if (!row?.secret_ciphertext) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Kein gespeicherter Key für diesen Provider.' },
          404,
        );
      }

      let apiKey: string;
      try {
        apiKey = await decryptProviderSecret(row.secret_ciphertext, encRaw);
      } catch {
        return jsonResponse(
          request,
          { status: 'error', message: 'Gespeicherter Key konnte nicht entschlüsselt werden.' },
          500,
        );
      }

      const validated = await validateProviderApiKey(providerId, apiKey);
      if (!validated.ok) {
        await serviceFetch(
          config,
          `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'invalid',
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return jsonResponse(request, { status: 'error', message: validated.message }, 400);
      }

      const now = new Date().toISOString();
      const meta: JsonRecord = validated.credits === undefined
        ? row.meta
        : { ...row.meta, credits: validated.credits };

      await serviceFetch(
        config,
        `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'active',
            last_validated_at: now,
            meta,
            updated_at: now,
          }),
        },
      );

      return jsonResponse(request, {
        status: 'ok',
        provider: {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(
            {
              ...row,
              status: 'active',
              last_validated_at: now,
              meta,
            },
            def.modalities,
          ),
        },
      });
    }
```

### ai-provider-credentials:4

Predicate: `action === 'delete'`. Source: `supabase/functions/ai-provider-credentials/index.ts:524`.


```ts
{
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      if (!getProviderDefinition(providerId)) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }

      const deleteResponse = await serviceFetch(
        config,
        `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
        { method: 'DELETE' },
      );
      if (!deleteResponse.ok) {
        console.error('credential delete failed', deleteResponse.status);
        return jsonResponse(
          request,
          { status: 'error', message: 'Credential konnte nicht gelöscht werden.' },
          500,
        );
      }

      return jsonResponse(request, { status: 'ok', providerId });
    }
```


## Exact type declarations

### MeshyValidateResult

`supabase/functions/_shared/ai-provider-meshy.ts:6`

```ts
export type MeshyValidateResult =
  | {
      ok: true;
      credits: number;
    }
  | {
      ok: false;
      code: 'invalid' | 'network' | 'unknown';
      message: string;
    };
```

### FetchLike

`supabase/functions/_shared/ai-provider-meshy.ts:17`

```ts
type FetchLike = typeof fetch;
```

### AiModality

`supabase/functions/_shared/ai-provider-registry.ts:6`

```ts
export type AiModality = 'image' | '3d' | 'video' | 'audio';
```

### AiProviderAuthKind

`supabase/functions/_shared/ai-provider-registry.ts:8`

```ts
export type AiProviderAuthKind = 'api_key';
```

### AiProviderDefinition

`supabase/functions/_shared/ai-provider-registry.ts:10`

```ts
export interface AiProviderDefinition {
  id: string;
  displayName: string;
  modalities: readonly AiModality[];
  auth: AiProviderAuthKind;
  docsUrl?: string;
}
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

### JsonRecord

`supabase/functions/ai-provider-credentials/index.ts:27`

```ts
type JsonRecord = Record<string, unknown>;
```

### SupabaseConfig

`supabase/functions/ai-provider-credentials/index.ts:39`

```ts
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}
```

### CredentialRow

`supabase/functions/ai-provider-credentials/index.ts:45`

```ts
interface CredentialRow {
  provider_id: string;
  key_hint: string;
  status: string;
  added_at: string;
  last_validated_at: string | null;
  meta: JsonRecord;
  secret_ciphertext?: string;
}
```


## Exact validation, defaults and helper behavior

### parseCredentialsEncryptionKey

`supabase/functions/_shared/ai-provider-crypto.ts:25`

```ts
export function parseCredentialsEncryptionKey(
  raw: string | undefined,
): Uint8Array | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  try {
    const decoded = base64UrlToBytes(trimmed);
    if (decoded.byteLength === 32) return decoded;
  } catch {
    // fall through
  }

  try {
    const binary = atob(trimmed);
    if (binary.length === 32) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }
  } catch {
    // fall through
  }

  return null;
}
```

### DEFAULT_BASE

`supabase/functions/_shared/ai-provider-meshy.ts:19`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1'
```

### validateMeshyApiKey

`supabase/functions/_shared/ai-provider-meshy.ts:30`

```ts
export async function validateMeshyApiKey(
  apiKey: string,
  options?: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
  },
): Promise<MeshyValidateResult> {
  const trimmed = apiKey.trim();
  if (!looksLikeMeshyApiKey(trimmed)) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).',
    };
  }

  const baseUrl = (options?.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${baseUrl}/balance`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        code: 'invalid',
        message: 'Meshy-API-Key wurde abgelehnt.',
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        code: 'network',
        message: `Meshy-Balance-Check fehlgeschlagen (${response.status}).`,
      };
    }

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.balance !== 'number' || !Number.isFinite(body.balance)) {
      return {
        ok: false,
        code: 'unknown',
        message: 'Meshy-Balance-Antwort ungültig.',
      };
    }

    return { ok: true, credits: Math.max(0, Math.round(body.balance)) };
  } catch {
    return {
      ok: false,
      code: 'network',
      message: 'Meshy konnte nicht erreicht werden.',
    };
  }
}
```

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

### CORS_OPTS

`supabase/functions/ai-provider-credentials/index.ts:29`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'AI_PROVIDER_ALLOWED_ORIGIN',
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```

### DEFAULT_RATE_LIMIT

`supabase/functions/ai-provider-credentials/index.ts:55`

```ts
DEFAULT_RATE_LIMIT = 8
```

### RATE_WINDOW_SECONDS

`supabase/functions/ai-provider-credentials/index.ts:56`

```ts
RATE_WINDOW_SECONDS = 60
```

### validateProviderApiKey

`supabase/functions/ai-provider-credentials/index.ts:222`

```ts
async function validateProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: true; credits?: number } | { ok: false; message: string }> {
  if (providerId === 'meshy') {
    const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim();
    const result = await validateMeshyApiKey(apiKey, { baseUrl });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, credits: result.credits };
  }
  return { ok: false, message: 'Unbekannter Provider.' };
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/infrastructure/ai/ai-provider-credentials-service.ts` | `2d8233ab5816f88afd6b20db580e87d6f8d8b447a28e0f02d02d7c7425249d50` |
| `supabase/functions/_shared/ai-provider-crypto.ts` | `45e60f76f744077e8d9b243719dcdba5d58a047d36a1c141df830afa2de16532` |
| `supabase/functions/_shared/ai-provider-meshy.ts` | `8cfcb3698217a8352e91ddd46986bb5e3232caf843dc6d2b7a64585f920cc9a7` |
| `supabase/functions/_shared/ai-provider-registry.ts` | `3c0f5266905d025d4174f7ff58dec37efa2036571c2bdbf518640bd0282fb478` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/ai-provider-credentials/index.ts` | `45d9f64a6065e45866512849eb41a33f347c6dc8c9fe8d0d876ed8030f101cf0` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

