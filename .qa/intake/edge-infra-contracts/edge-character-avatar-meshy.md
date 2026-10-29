# Edge contract: character-avatar-meshy

**Status: SPEC; current branch source verified.** Implementation issue: **#820**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-character-avatar-meshy.json](source-contracts/edge-character-avatar-meshy.json) (SHA-256 `3f3753720d2a1dc0c75ab8719db4de505bb0b358aaa8ad603e4d8734968c88e8`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**allowlisted-worker** — Current branch mount; a successor cutover still requires gates and contract tests.

Owner-scoped Meshy text/image generation jobs with poll-driven remesh/rig/materialize checkpoints.

Authenticate via /auth/v1/user; jobs are read by owner_user_id. Optional characterId resolves only caller-owned character, otherwise null. Keys resolved from caller BYOK credential. Storage read/sign requires normalized caller userId/ prefix.

## Request variants, fields and defaults

- **config:** {action:'config'}
- **start:** {action:'start',clientNonce:string(trimmed,1..80),generationMode?:'image'|other(default text),characterId?:string,providerId?:'meshy',presetId?:string,presetVersion?:number,presetDirty?:boolean,settings?:Avatar3dGenerationSettings,prompt?:string,imageDataUri?:string,texturePrompt?:string}
- **text:** prompt whitespace normalized,8..500 chars
- **image:** PNG/JPEG/WebP base64 data URI,approx decoded1..4MiB; texturePrompt fallback prompt optional<=500 normalized; image placeholder narrative used if text shorter8
- **settings:** When settings is omitted use DEFAULT_RECOMMENDED_SETTINGS: model latest,geometry high,texture4k,pose a-pose,topology triangle,imageEnhancement false,pbr true,initialRemesh false,targetPolycount50000,outputFormat glb,keepMaster true,runtimePolycount50000. Supplied settings require model latest|meshy-5|meshy-6|meshy-7|meshy-t1|meshy-t2,geometry low|standard|high|maximum|smart-topology,texture standard|2k|4k|8k,pose a-pose|t-pose|none,topology triangle|quad,target100..300000,runtime1000..300000 (Number then rounded),outputFormat glb; booleans are true only for literaltrue; providerExtras filters keys and primitive values.
- **pollRetry:** {action:'poll'|'retry',jobId:string(nonempty)}; retry only failed/provider_unavailable; existing provider_task_id resumes materialization without paid create
- **preset:** presetId fast|recommended|maximum|custom else recommended; presetVersion finite number rounded>=1 else1; presetDirty only literaltrue. Runtime remesh helper further clamps runtimePolycount10000..100000.

## Success and error contracts

- **config:** {status:'ok',meshyConfigured,promptMinChars:8,promptMaxChars:500,imageMaxBytes:4194304,supportsImageTo3d:true,defaultProviderId:'meshy',defaultPresetId:'recommended',wiredProviderIds:['meshy'],costHintDe}
- **job:** {status:'ok',job:row|provider-unavailable projection,replayed?:true}; exact poll status/progress/artifact/signedUrl variants in operation evidence
- **unconfigured:** HTTP200 {status:'not-configured',message:string}

- 405 method; 500 missing config/persistence; 401 auth; 400 JSON/nonce/prompt/image/settings/provider/retry-state; 404 absent own job; 429 start quota
- Provider create unavailable returns HTTP200 status ok with provider_unavailable pseudo-job and id:null; not a durable successful job
- Poll errors are mapped per stage to publicMeshyFailure strings; no automatic paid retry

## Side effects and transaction boundaries

- start may create one paid Meshy task then INSERT character_avatar_meshy_jobs; idempotency lookup uses userId|clientNonce|generationMode|jobPrompt.length
- poll/retry update jobs, claim remesh/rigging provider steps through conditional PATCH and materialize GLB into character-avatars; optional master preservation and bounded downloads
- All provider credentials derived from account; raw key never persisted in job. Storage+DB/provider writes are separate operations, not an ACID transaction

## Quota, environment and transport


```json
{
  "kind": "process-memory",
  "scope": "authenticated userId on start",
  "defaultLimit": 2,
  "windowSeconds": 60,
  "restart": "Map resets per worker/process; charged before idempotent replay lookup"
}
```

Auth10s and BYOK lookup10s. Meshy create/remesh/rig create30s, task polls20s; GLB GET defaults60s but materialize/master overrides120s, HEAD probe20s. Most job DB/storage fetches have no explicit abort timeout; dispatcher512MiB/300s is the outer ceiling. GLB download200MiB, remesh soft threshold80MiB, store150MiB; signed URLs604800s. No automatic paid start retry.

- `AI_PROVIDER_ALLOW_HOST_KEYS`
- `CHARACTER_AI_ALLOWED_ORIGIN`
- `CREDENTIALS_ENCRYPTION_KEY`
- `ITEM_MODEL3D_MESHY_MOCK`
- `ITEM_THUMBNAIL_MESHY_MOCK`
- `MESHY_API_BASE_URL`
- `MESHY_API_KEY`
- `MESHY_AVATAR_USE_MOCK`
- `MESHY_IMAGE_TO_3D_MODEL`
- `MESHY_TEXT_TO_3D_BASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

- `supabase/functions/_shared/ai-provider-resolve-meshy.ts:45` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/ai-provider-resolve-meshy.ts:99` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/avatar-meshy-remesh.ts:98` — `AbortSignal.timeout(30_000)`
- `supabase/functions/_shared/avatar-meshy-remesh.ts:116` — `AbortSignal.timeout(20_000)`
- `supabase/functions/_shared/avatar-meshy-rigging.ts:117` — `AbortSignal.timeout(30_000)`
- `supabase/functions/_shared/avatar-meshy-rigging.ts:135` — `AbortSignal.timeout(20_000)`
- `supabase/functions/_shared/avatar-meshy-text-to-3d.ts:121` — `AbortSignal.timeout(30_000)`
- `supabase/functions/_shared/avatar-meshy-text-to-3d.ts:139` — `AbortSignal.timeout(20_000)`
- `supabase/functions/_shared/item-model3d-glb.ts:122` — `AbortSignal.timeout(timeoutMs)`
- `supabase/functions/_shared/item-model3d-glb.ts:211` — `AbortSignal.timeout(timeoutMs)`
- `supabase/functions/_shared/item-model3d-meshy.ts:183` — `AbortSignal.timeout(30_000)`
- `supabase/functions/_shared/item-model3d-meshy.ts:203` — `AbortSignal.timeout(20_000)`
- `supabase/functions/character-avatar-meshy/index.ts:256` — `AbortSignal.timeout(10_000)`

## Exact environment defaults and configuration resolution

### hostAiProviderKeysAllowed

`supabase/functions/_shared/ai-provider-resolve-meshy.ts:19`

```ts
export function hostAiProviderKeysAllowed(
  env: { get(key: string): string | undefined } = Deno.env,
): boolean {
  return env.get('AI_PROVIDER_ALLOW_HOST_KEYS') === '1';
}
```

### resolveHostMeshyApiKey

`supabase/functions/_shared/ai-provider-resolve-meshy.ts:25`

```ts
export function resolveHostMeshyApiKey(
  env: { get(key: string): string | undefined } = Deno.env,
): string | null {
  if (!hostAiProviderKeysAllowed(env)) return null;
  const apiKey = env.get('MESHY_API_KEY')?.trim() ?? '';
  return apiKey || null;
}
```

### resolveMeshyApiKeyForUser

`supabase/functions/_shared/ai-provider-resolve-meshy.ts:57`

```ts
export async function resolveMeshyApiKeyForUser(
  userId: string,
  config: SupabaseServiceConfig,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<string | null> {
  const encKey = parseCredentialsEncryptionKey(env.get('CREDENTIALS_ENCRYPTION_KEY'));
  if (encKey) {
    try {
      const ciphertext = await loadEncryptedMeshySecret(config, userId);
      if (ciphertext) {
        const plaintext = await decryptProviderSecret(ciphertext, encKey);
        if (plaintext.trim()) return plaintext.trim();
      }
    } catch (error) {
      console.error(
        'meshy user credential decrypt failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  return resolveHostMeshyApiKey(env);
}
```

### isMeshyConfiguredForUser

`supabase/functions/_shared/ai-provider-resolve-meshy.ts:82`

```ts
export async function isMeshyConfiguredForUser(
  userId: string,
  config: SupabaseServiceConfig,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<boolean> {
  if (env.get('ITEM_THUMBNAIL_MESHY_MOCK') === '1' || env.get('ITEM_MODEL3D_MESHY_MOCK') === '1') {
    return true;
  }

  const response = await fetch(
    `${config.url}/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.meshy&status=eq.active&select=id&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (response.ok) {
    const body: unknown = await response.json();
    if (Array.isArray(body) && body.length > 0) return true;
  }

  return resolveHostMeshyApiKey(env) !== null;
}
```

### DEFAULT_RECOMMENDED_SETTINGS

`supabase/functions/_shared/avatar-3d-generation.ts:46`

```ts
DEFAULT_RECOMMENDED_SETTINGS: Avatar3dGenerationSettings = {
  modelId: 'latest',
  geometryQuality: 'high',
  textureQuality: '4k',
  pose: 'a-pose',
  topology: 'triangle',
  imageEnhancement: false,
  pbr: true,
  initialRemesh: false,
  targetPolycount: 50_000,
  outputFormat: 'glb',
  keepMaster: true,
  runtimePolycount: 50_000,
}
```

### DEFAULT_REMESH_BASE

`supabase/functions/_shared/avatar-meshy-remesh.ts:64`

```ts
DEFAULT_REMESH_BASE = 'https://api.meshy.ai/openapi/v1'
```

### DEFAULT_RIGGING_BASE

`supabase/functions/_shared/avatar-meshy-rigging.ts:75`

```ts
DEFAULT_RIGGING_BASE = 'https://api.meshy.ai/openapi/v1'
```

### DEFAULT_BASE

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:34`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v2'
```

### resolveMeshyTextTo3dConfig

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:54`

```ts
export function resolveMeshyTextTo3dConfig(
  env: { get(key: string): string | undefined } = Deno.env,
  apiKeyOverride?: string | null,
): MeshyTextTo3dProviderConfig | null {
  const apiKey = apiKeyOverride !== undefined
    ? (apiKeyOverride?.trim() ?? '')
    : (env.get('MESHY_API_KEY')?.trim() ?? '');
  if (!apiKey) return null;
  // Dedicated override wins; otherwise shared base (normalized) or v2 default.
  const explicit = env.get('MESHY_TEXT_TO_3D_BASE_URL')?.trim();
  const shared = env.get('MESHY_API_BASE_URL')?.trim();
  const baseUrl = normalizeMeshyTextTo3dBaseUrl(explicit || shared || DEFAULT_BASE);
  return { apiKey, baseUrl };
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

### DEFAULT_BASE

`supabase/functions/_shared/item-model3d-meshy.ts:52`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1'
```

### DEFAULT_MODEL

`supabase/functions/_shared/item-model3d-meshy.ts:53`

```ts
DEFAULT_MODEL = 'latest'
```

### resolveMeshyImageTo3dConfig

`supabase/functions/_shared/item-model3d-meshy.ts:60`

```ts
export function resolveMeshyImageTo3dConfig(
  env: { get(key: string): string | undefined } = Deno.env,
  apiKeyOverride?: string | null,
): MeshyImageTo3dProviderConfig | null {
  const apiKey = apiKeyOverride !== undefined
    ? (apiKeyOverride?.trim() ?? '')
    : (env.get('MESHY_API_KEY')?.trim() ?? '');
  if (!apiKey) return null;

  const baseUrl = (env.get('MESHY_API_BASE_URL')?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const model = env.get('MESHY_IMAGE_TO_3D_MODEL')?.trim() || DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
}
```

### CORS_OPTS

`supabase/functions/character-avatar-meshy/index.ts:66`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['CHARACTER_AI_ALLOWED_ORIGIN'],
  allowLocalhostWhenConfigured: true,
  missingOriginPolicy: 'configured-or-star',
}
```

### resolveTextProvider

`supabase/functions/character-avatar-meshy/index.ts:264`

```ts
function resolveTextProvider(apiKey: string | null): MeshyTextTo3dProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyTextTo3dProvider();
  }
  const config = resolveMeshyTextTo3dConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyTextTo3dProvider(config);
}
```

### resolveImageProvider

`supabase/functions/character-avatar-meshy/index.ts:273`

```ts
function resolveImageProvider(apiKey: string | null): MeshyImageTo3dProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyImageTo3dProvider();
  }
  const config = resolveMeshyImageTo3dConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyImageTo3dProvider(config);
}
```

### resolveRemeshProvider

`supabase/functions/character-avatar-meshy/index.ts:282`

```ts
function resolveRemeshProvider(apiKey: string | null): MeshyRemeshProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyRemeshProvider();
  }
  if (!apiKey?.trim()) return null;
  const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim()
    || 'https://api.meshy.ai/openapi/v1';
  return createLiveMeshyRemeshProvider({ apiKey: apiKey.trim(), baseUrl });
}
```

### resolveRiggingProvider

`supabase/functions/character-avatar-meshy/index.ts:292`

```ts
function resolveRiggingProvider(apiKey: string | null): MeshyRiggingProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyRiggingProvider();
  }
  if (!apiKey?.trim()) return null;
  const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim()
    || 'https://api.meshy.ai/openapi/v1';
  return createLiveMeshyRiggingProvider({ apiKey: apiKey.trim(), baseUrl });
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |
| edge | `ai-provider-credentials` | #818 |  |
| table | `character_avatar_meshy_jobs` | #791 | Policy #792 |
| table | `characters` | #791 | Policy #792 |
| table | `user_ai_provider_credentials` | #791 | Policy #792 |
| storage | `character-avatars` | #841 |  |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['CHARACTER_AI_ALLOWED_ORIGIN'],
  allowLocalhostWhenConfigured: true,
  missingOriginPolicy: 'configured-or-star',
}
```


## Acceptance and negative tests (required, not executed)

- Owner start/poll/retry works without project membership; account X jobId returns404 and cannot sign owner storage path.
- Text8..500, nonce1..80,4MiB image and settings enums enforced; unsupported provider rejects400.
- Identical start key replays existing own row, but third start attempt inside60s is429 even if replay; do not claim durable quota.
- Two concurrent polls do not both start remesh/rig task; retry with existing provider task resumes without paid create.
- Provider failure is a provider_unavailable pseudo-job, missing provider not-configured; all GLB downloads/paths obey allowlist and size limits.

## Observed legacy defects and explicit successor decisions

- start creates provider task before DB insert; replay key uses prompt length rather than content hash. Equal-length changed input may collide and concurrent starts may orphan a paid provider task. Successor cutover requires an explicit tested idempotency/compensation decision; current worker is allowlisted.
- meshyConfigured can be true from an active credential row without proving successful decryption; config is availability metadata, not a verified provider request. Avatar image validation checks data-URI grammar and approximate byte count, not decoded image magic.

## All adapter call sites

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:90


```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('character-avatar-meshy', { body });
  if (error) {
    return { status: 'error', message: error.message || 'Edge Function fehlgeschlagen.' };
  }
  return parseResponse(data);
}
```


## Exact ordered operations

### character-avatar-meshy:1

Predicate: `action === 'config'`. Source: `supabase/functions/character-avatar-meshy/index.ts:367`.


```ts
{
    const configured = await isMeshyConfiguredForUser(userId, {
      url: supabaseUrl,
      serviceRoleKey,
    });
    return json(200, {
      status: 'ok',
      meshyConfigured: configured || Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1',
      promptMinChars: 8,
      promptMaxChars: 500,
      imageMaxBytes: IMAGE_MAX_BYTES,
      supportsImageTo3d: true,
      defaultProviderId: 'meshy',
      defaultPresetId: 'recommended',
      /** Client loads full capability/preset schema from domain; edge confirms wired ids. */
      wiredProviderIds: ['meshy'],
      costHintDe:
        'Externe KI. Provider + Preset steuern Qualität. Advanced-Einstellungen sind optional. Kein automatischer Paid-Retry.',
    }, request);
  }
```

### character-avatar-meshy:2

Predicate: `action === 'start'`. Source: `supabase/functions/character-avatar-meshy/index.ts:388`.


```ts
{
    const generationMode = parseGenerationMode(payload.generationMode);
    const clientNonce = typeof payload.clientNonce === 'string' ? payload.clientNonce.trim() : '';
    if (!clientNonce || clientNonce.length > 80) {
      return json(400, { status: 'error', message: 'clientNonce fehlt oder ist ungültig.' }, request);
    }
    const characterIdRaw = typeof payload.characterId === 'string' ? payload.characterId : null;
    const characterId = await resolveOwnedCharacterId(
      characterIdRaw,
      userId,
      supabaseUrl,
      serviceHeaders,
    );

    let jobPrompt: string;
    let imageDataUri: string | null = null;
    let texturePrompt = '';

    if (generationMode === 'text') {
      const promptCheck = validatePrompt(payload.prompt);
      if (!promptCheck.ok) {
        return json(400, { status: 'error', message: promptCheck.message }, request);
      }
      jobPrompt = promptCheck.prompt;
    } else {
      const imageCheck = validateImageDataUri(payload.imageDataUri);
      if (!imageCheck.ok) {
        return json(400, { status: 'error', message: imageCheck.message }, request);
      }
      const textureCheck = validateOptionalTexturePrompt(payload.texturePrompt ?? payload.prompt);
      if (!textureCheck.ok) {
        return json(400, { status: 'error', message: textureCheck.message }, request);
      }
      imageDataUri = imageCheck.dataUri;
      texturePrompt = textureCheck.prompt;
      jobPrompt = texturePrompt.length >= 8 ? texturePrompt : IMAGE_PLACEHOLDER_PROMPT;
    }

    const idempotencyKey = `${userId}|${clientNonce}|${generationMode}|${jobPrompt.length}`;

    const rate = consumeAvatarMeshyRateLimit({
      userId,
      limit: RATE_LIMIT,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
    if (!rate.ok) {
      return json(429, {
        status: 'error',
        code: 'rate_limited',
        message: `Zu viele Anfragen. Bitte in ${rate.retryAfterSeconds}s erneut versuchen.`,
      }, request);
    }

    const apiKey = await resolveMeshyApiKeyForUser(userId, {
      url: supabaseUrl,
      serviceRoleKey,
    });

    // Idempotent replay
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?owner_user_id=eq.${encodeURIComponent(userId)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=*&limit=1`,
      { headers: { ...serviceHeaders, Prefer: 'return=representation' } },
    );
    if (existingRes.ok) {
      const rows: unknown = await existingRes.json();
      if (Array.isArray(rows) && rows.length > 0 && isRecord(rows[0])) {
        return json(200, { status: 'ok', job: rows[0], replayed: true }, request);
      }
    }

    let providerTaskId: string;
    const providerId = parseProviderId(payload.providerId) ?? 'meshy';
    if (payload.providerId !== undefined && parseProviderId(payload.providerId) === null) {
      return json(400, {
        status: 'error',
        code: 'unsupported_provider',
        message: 'Dieser 3D-Provider ist noch nicht angebunden.',
      }, request);
    }

    const presetMeta = parsePresetMeta(payload);
    let generationSettings: Avatar3dGenerationSettings = DEFAULT_RECOMMENDED_SETTINGS;
    if (payload.settings !== undefined) {
      const settingsCheck = validateGenerationSettings(payload.settings);
      if (!settingsCheck.ok) {
        return json(400, { status: 'error', code: 'validation', message: settingsCheck.message }, request);
      }
      generationSettings = settingsCheck.settings;
    }
    const meshyMapped = mapSettingsToMeshyImageTo3d(generationSettings);

    try {
      if (generationMode === 'image') {
        const provider = resolveImageProvider(apiKey);
        if (!provider || !imageDataUri) {
          return json(200, {
            status: 'not-configured',
            message: 'Meshy ist nicht konfiguriert. Bitte API-Key unter KI-Anbieter hinterlegen.',
          }, request);
        }
        const created = await provider.createTask({
          kind: 'image_url',
          imageUrl: imageDataUri,
          texturePrompt: texturePrompt || undefined,
          poseMode: meshyMapped.pose_mode,
          shouldRemesh: meshyMapped.should_remesh,
          targetPolycount: meshyMapped.target_polycount,
          aiModel: meshyMapped.ai_model,
          modelType: meshyMapped.model_type,
          textureResolution: meshyMapped.texture_resolution,
          enablePbr: meshyMapped.enable_pbr,
          imageEnhancement: meshyMapped.image_enhancement,
          topology: meshyMapped.topology,
          ultraMode: meshyMapped.ultra_mode,
          savePreRemeshedModel: meshyMapped.save_pre_remeshed_model,
        });
        providerTaskId = created.taskId;
      } else {
        const provider = resolveTextProvider(apiKey);
        if (!provider) {
          return json(200, {
            status: 'not-configured',
            message: 'Meshy ist nicht konfiguriert. Bitte API-Key unter KI-Anbieter hinterlegen.',
          }, request);
        }
        const created = await provider.createTask(jobPrompt);
        providerTaskId = created.taskId;
      }
    } catch (error) {
      console.error('meshy avatar create failed', error instanceof Error ? error.message : 'unknown');
      return json(200, {
        status: 'ok',
        job: {
          id: null,
          status: 'provider_unavailable',
          progress: 0,
          prompt: jobPrompt,
          generation_mode: generationMode,
          error_message: publicMeshyFailure('unavailable'),
          rig_analysis_status: 'pending',
        },
      }, request);
    }

    const generationSettingsJson = buildGenerationSettingsJson({
      providerId,
      providerModel: generationSettings.modelId,
      presetId: presetMeta.presetId,
      presetVersion: presetMeta.presetVersion,
      presetDirty: presetMeta.presetDirty,
      settings: generationSettings,
      sourceMode: generationMode,
      providerTaskId,
      mappedProviderParams: generationMode === 'image'
        ? (meshyMapped as unknown as Record<string, unknown>)
        : { mode: 'preview' },
    });

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/character_avatar_meshy_jobs`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        owner_user_id: userId,
        character_id: characterId,
        prompt: jobPrompt,
        generation_mode: generationMode,
        idempotency_key: idempotencyKey,
        status: 'generating',
        progress: 5,
        provider_task_id: providerTaskId,
        provider_id: providerId,
        provider_model: generationSettings.modelId,
        preset_id: presetMeta.presetId,
        preset_version: presetMeta.presetVersion,
        generation_settings: generationSettingsJson,
        rig_analysis_status: 'pending',
      }),
    });
    if (!insertRes.ok) {
      const detail = await insertRes.text();
      console.error('meshy job insert failed', detail);
      return json(500, { status: 'error', message: 'Job konnte nicht gespeichert werden.' }, request);
    }
    const inserted: unknown = await insertRes.json();
    const job = Array.isArray(inserted) ? inserted[0] : inserted;
    return json(200, { status: 'ok', job }, request);
  }
```

### character-avatar-meshy:3

Predicate: `action === 'poll' \|\| action === 'retry'`. Source: `supabase/functions/character-avatar-meshy/index.ts:576`.


```ts
{
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : '';
    if (!jobId) return json(400, { status: 'error', message: 'jobId fehlt.' }, request);

    const jobRes = await fetch(
      `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&owner_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      { headers: serviceHeaders },
    );
    if (!jobRes.ok) {
      return json(500, { status: 'error', message: 'Job konnte nicht geladen werden.' }, request);
    }
    const jobs: unknown = await jobRes.json();
    if (!Array.isArray(jobs) || jobs.length === 0 || !isRecord(jobs[0])) {
      return json(404, { status: 'error', message: 'Job nicht gefunden.' }, request);
    }
    const job = jobs[0];

    if (action === 'retry') {
      if (job.status !== 'failed' && job.status !== 'provider_unavailable') {
        return json(400, { status: 'error', message: 'Retry nur nach Fehler.' }, request);
      }
      // If Meshy already produced a task, resume materialize (no second paid create).
      if (typeof job.provider_task_id === 'string' && job.provider_task_id.trim()) {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'rigging',
              progress: 90,
              error_message: null,
              updated_at: new Date().toISOString(),
            }),
          },
        );
      } else {
        // Paid recreate only for text mode (image bytes are not persisted).
        if (jobGenerationMode(job) === 'image') {
          return json(400, {
            status: 'error',
            message: 'Bild-Job erneut starten: bitte neues Referenzbild hochladen.',
          }, request);
        }
        const apiKey = await resolveMeshyApiKeyForUser(userId, { url: supabaseUrl, serviceRoleKey });
        const provider = resolveTextProvider(apiKey);
        if (!provider) {
          return json(200, {
            status: 'not-configured',
            message: 'Meshy ist nicht konfiguriert.',
          }, request);
        }
        try {
          const created = await provider.createTask(String(job.prompt ?? ''));
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'generating',
                progress: 5,
                provider_task_id: created.taskId,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
        } catch {
          return json(200, {
            status: 'ok',
            job: { ...job, status: 'provider_unavailable', error_message: publicMeshyFailure('unavailable') },
          }, request);
        }
      }
    }

    // Refresh job after possible retry
    const refreshedRes = await fetch(
      `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&owner_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      { headers: serviceHeaders },
    );
    const refreshedJobs: unknown = await refreshedRes.json();
    const current = Array.isArray(refreshedJobs) && isRecord(refreshedJobs[0])
      ? refreshedJobs[0]
      : job;

    if (current.status === 'succeeded' && typeof current.storage_path === 'string') {
      let storagePath: string;
      try {
        storagePath = assertOwnerScopedStoragePath(userId, current.storage_path);
      } catch {
        return json(403, {
          status: 'error',
          message: 'Speicherpfad gehört nicht zu diesem Account.',
        }, request);
      }
      const signed = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
        },
      );
      let modelUrl: string | undefined;
      if (signed.ok) {
        const signedBody: unknown = await signed.json();
        if (isRecord(signedBody) && typeof signedBody.signedURL === 'string') {
          modelUrl = `${supabaseUrl}/storage/v1${signedBody.signedURL}`;
        }
      }
      return json(200, {
        status: 'ok',
        job: current,
        modelUrl,
        // Explicit: still pending until client/runtime runs #6
        rigAnalysisStatus: 'pending',
      }, request);
    }

    if (
      current.status === 'failed' ||
      current.status === 'provider_unavailable' ||
      current.status === 'canceled'
    ) {
      return json(200, { status: 'ok', job: current }, request);
    }

    const apiKey = await resolveMeshyApiKeyForUser(userId, { url: supabaseUrl, serviceRoleKey });
    if (typeof current.provider_task_id !== 'string') {
      return json(200, {
        status: 'ok',
        job: { ...current, status: 'provider_unavailable' },
      }, request);
    }
    const mode = jobGenerationMode(current);

    try {
      const task = await fetchAvatarMeshyTask(mode, apiKey, current.provider_task_id);
      if (!task) {
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'provider_unavailable' },
        }, request);
      }
      const mapped = mapMeshyTextTo3dStatusToJob(
        task.status as 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED',
      );
      if (mapped === 'generating') {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'generating',
              progress: Math.max(5, task.progress),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'generating', progress: Math.max(5, task.progress) },
        }, request);
      }
      if (mapped === 'failed') {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'failed',
              error_message: publicMeshyFailure('generate'),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: {
            ...current,
            status: 'failed',
            error_message: publicMeshyFailure('generate'),
          },
        }, request);
      }

      const glbUrl = task.model_urls?.glb;
      if (!glbUrl) {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'failed',
              error_message: publicMeshyFailure('no_model'),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'failed', error_message: publicMeshyFailure('no_model') },
        }, request);
      }

      // Split materialize across polls: first mark rigging and return (avoids Edge CPU kill
      // when download+upload runs in the same isolate turn as a long Meshy wait).
      if (current.status !== 'rigging') {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'rigging',
              progress: 90,
              error_message: null,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'rigging', progress: 90, error_message: null },
        }, request);
      }

      // Second+ polls: optional remesh → Meshy Auto-Rig → (later poll) download + upload.
      // pending_glb_url means Auto-Rig already succeeded — materialize alone this turn.
      const pendingGlbUrl =
        typeof current.pending_glb_url === 'string' && current.pending_glb_url.trim()
          ? current.pending_glb_url.trim()
          : '';
      let glbDownloadUrl = pendingGlbUrl;

      let meshSourceTaskId =
        typeof current.provider_task_id === 'string' && current.provider_task_id.trim()
          ? current.provider_task_id.trim()
          : '';
      const existingRemeshId =
        typeof current.remesh_task_id === 'string' && current.remesh_task_id.trim()
          ? current.remesh_task_id.trim()
          : '';

      if (!glbDownloadUrl && existingRemeshId) {
        if (isPipelineClaimId(existingRemeshId)) {
          return json(200, {
            status: 'ok',
            job: { ...current, status: 'rigging', progress: 92, error_message: null },
          }, request);
        }
        const remeshProvider = resolveRemeshProvider(apiKey);
        if (!remeshProvider) {
          return json(200, {
            status: 'ok',
            job: { ...current, status: 'provider_unavailable' },
          }, request);
        }
        const remeshTask = await remeshProvider.getTask(existingRemeshId);
        if (remeshTask.status === 'PENDING' || remeshTask.status === 'IN_PROGRESS') {
          const remeshProgress = Math.max(92, Math.min(94, remeshTask.progress || 92));
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'rigging',
                progress: remeshProgress,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'rigging',
              progress: remeshProgress,
              error_message: null,
            },
          }, request);
        }
        if (remeshTask.status !== 'SUCCEEDED' || !remeshTask.model_urls?.glb) {
          const remeshFail = remeshTask.task_error?.message ?? 'Remesh fehlgeschlagen.';
          console.error('meshy avatar remesh failed', remeshFail);
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'failed',
                error_message: publicMeshyFailure('remesh'),
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'failed',
              error_message: publicMeshyFailure('remesh'),
            },
          }, request);
        }
        meshSourceTaskId = existingRemeshId;
        // Split: remesh getTask success and Auto-Rig create never share one isolate turn.
        const hasRigAlready =
          typeof current.rig_task_id === 'string' && current.rig_task_id.trim().length > 0;
        const remeshAcked = jobPipelineFlags(current).remeshAcked === true;
        if (!hasRigAlready && !remeshAcked) {
          const nextSettings = withPipelineFlag(current, 'remeshAcked', true);
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'rigging',
                progress: 94,
                generation_settings: nextSettings,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'rigging',
              progress: 94,
              generation_settings: nextSettings,
              error_message: null,
            },
          }, request);
        }
      } else if (!glbDownloadUrl) {
        const contentLength = await probeMeshyGlbContentLength(glbUrl).catch(() => null);
        const keepMaster = jobKeepMaster(current);
        const oversized =
          typeof contentLength === 'number' && contentLength > AVATAR_MESHY_GLB_SOFT_BYTES;
        // Pipeline: high-detail master → remesh to runtime polycount; also remesh oversized GLBs.
        const needsRemesh = oversized || keepMaster;
        if (needsRemesh && meshSourceTaskId) {
          // Persist unoptimized master once before remesh (owner-scoped path).
          if (
            keepMaster
            && (typeof current.master_storage_path !== 'string' || !current.master_storage_path.trim())
          ) {
            try {
              const masterDl = await downloadMeshyGlbBytes(glbUrl, fetch, {
                maxBytes: AVATAR_MESHY_GLB_MAX_BYTES,
                timeoutMs: 120_000,
              });
              if (masterDl.bytes.byteLength <= AVATAR_MESHY_GLB_STORE_MAX_BYTES) {
                const masterPath = `${userId}/meshy/${crypto.randomUUID()}-master.glb`;
                // Deno fetch body: copy Uint8Array before body (lesson from #140)
                const masterPayload = new Uint8Array(masterDl.bytes.byteLength);
                masterPayload.set(masterDl.bytes);
                const uploadMaster = await fetch(
                  `${supabaseUrl}/storage/v1/object/${BUCKET}/${masterPath}`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${serviceRoleKey}`,
                      apikey: serviceRoleKey,
                      'Content-Type': 'model/gltf-binary',
                      'x-upsert': 'true',
                    },
                    body: masterPayload,
                  },
                );
                if (uploadMaster.ok) {
                  await fetch(
                    `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
                    {
                      method: 'PATCH',
                      headers: serviceHeaders,
                      body: JSON.stringify({
                        master_storage_path: masterPath,
                        status: 'rigging',
                        progress: 91,
                        updated_at: new Date().toISOString(),
                      }),
                    },
                  );
                  // Split: master upload and remesh create never share one isolate turn.
                  return json(200, {
                    status: 'ok',
                    job: {
                      ...current,
                      master_storage_path: masterPath,
                      status: 'rigging',
                      progress: 91,
                      error_message: null,
                    },
                  }, request);
                } else {
                  console.error('meshy avatar master upload failed', await uploadMaster.text());
                }
              }
            } catch (masterError) {
              console.error(
                'meshy avatar master store failed',
                masterError instanceof Error ? masterError.message : 'unknown',
              );
            }
          }
          const remeshProvider = resolveRemeshProvider(apiKey);
          if (!remeshProvider) {
            return json(200, {
              status: 'ok',
              job: {
                ...current,
                status: 'failed',
                error_message: publicMeshyFailure('remesh'),
              },
            }, request);
          }
          try {
            const claimId = `${PIPELINE_CLAIM_PREFIX}${crypto.randomUUID()}`;
            const claimRes = await fetch(
              `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&remesh_task_id=is.null`,
              {
                method: 'PATCH',
                headers: serviceHeaders,
                body: JSON.stringify({
                  status: 'rigging',
                  progress: 92,
                  remesh_task_id: claimId,
                  error_message: null,
                  updated_at: new Date().toISOString(),
                }),
              },
            );
            const claimRows = claimRes.ok ? await claimRes.json() : [];
            if (!Array.isArray(claimRows) || claimRows.length !== 1) {
              // Another poll claimed remesh — wait for next poll with their task id.
              return json(200, {
                status: 'ok',
                job: { ...current, status: 'rigging', progress: 92, error_message: null },
              }, request);
            }
            try {
              const remeshCreated = await remeshProvider.createTask({
                inputTaskId: meshSourceTaskId,
                targetPolycount: jobRuntimePolycount(current),
              });
              await fetch(
                `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&remesh_task_id=eq.${encodeURIComponent(claimId)}`,
                {
                  method: 'PATCH',
                  headers: serviceHeaders,
                  body: JSON.stringify({
                    status: 'rigging',
                    progress: 92,
                    remesh_task_id: remeshCreated.taskId,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                  }),
                },
              );
              return json(200, {
                status: 'ok',
                job: {
                  ...current,
                  status: 'rigging',
                  progress: 92,
                  remesh_task_id: remeshCreated.taskId,
                  error_message: null,
                },
              }, request);
            } catch (remeshError) {
              console.error(
                'meshy avatar remesh create failed',
                remeshError instanceof Error ? remeshError.message : 'unknown',
              );
              await fetch(
                `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&remesh_task_id=eq.${encodeURIComponent(claimId)}`,
                {
                  method: 'PATCH',
                  headers: serviceHeaders,
                  body: JSON.stringify({
                    remesh_task_id: null,
                    updated_at: new Date().toISOString(),
                  }),
                },
              ).catch(() => undefined);
              // Fall through to Auto-Rig with original provider task — may still succeed.
            }
          } catch (claimError) {
            console.error(
              'meshy avatar remesh claim failed',
              claimError instanceof Error ? claimError.message : 'unknown',
            );
          }
        }
      }

      // Auto-Rig (Meshy /openapi/v1/rigging) — required before store; #6 still owns capabilities.
      // Skip when pending_glb_url already set (download-only turn).
      if (!glbDownloadUrl) {
      const existingRigId =
        typeof current.rig_task_id === 'string' && current.rig_task_id.trim()
          ? current.rig_task_id.trim()
          : '';
      const riggingProvider = resolveRiggingProvider(apiKey);
      if (!riggingProvider) {
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'provider_unavailable' },
        }, request);
      }

      if (existingRigId) {
        if (isPipelineClaimId(existingRigId)) {
          return json(200, {
            status: 'ok',
            job: { ...current, status: 'rigging', progress: 95, error_message: null },
          }, request);
        }
        const rigTask = await riggingProvider.getTask(existingRigId);
        if (rigTask.status === 'PENDING' || rigTask.status === 'IN_PROGRESS') {
          const rigProgress = Math.max(95, Math.min(99, rigTask.progress || 95));
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'rigging',
                progress: rigProgress,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'rigging',
              progress: rigProgress,
              error_message: null,
            },
          }, request);
        }
        if (rigTask.status !== 'SUCCEEDED' || !rigTask.riggedGlbUrl) {
          const rigFail = rigTask.task_error?.message ?? 'Auto-Rig fehlgeschlagen.';
          console.error('meshy avatar auto-rig failed', rigFail);
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'failed',
                error_message: publicMeshyFailure('rig'),
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'failed',
              error_message: publicMeshyFailure('rig'),
            },
          }, request);
        }
        // Split: persist CDN URL and return — download+upload on the next poll alone.
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'rigging',
              progress: 99,
              pending_glb_url: rigTask.riggedGlbUrl,
              error_message: null,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: {
            ...current,
            status: 'rigging',
            progress: 99,
            pending_glb_url: rigTask.riggedGlbUrl,
            error_message: null,
          },
        }, request);
      } else {
        if (!meshSourceTaskId) {
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'failed',
                error_message: publicMeshyFailure('rig'),
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'failed',
              error_message: publicMeshyFailure('rig'),
            },
          }, request);
        }
        try {
          const claimId = `${PIPELINE_CLAIM_PREFIX}${crypto.randomUUID()}`;
          const claimRes = await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&rig_task_id=is.null`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'rigging',
                progress: 95,
                rig_task_id: claimId,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          const claimRows = claimRes.ok ? await claimRes.json() : [];
          if (!Array.isArray(claimRows) || claimRows.length !== 1) {
            return json(200, {
              status: 'ok',
              job: { ...current, status: 'rigging', progress: 95, error_message: null },
            }, request);
          }
          try {
            const rigCreated = await riggingProvider.createTask({
              inputTaskId: meshSourceTaskId,
              heightMeters: 1.7,
            });
            await fetch(
              `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&rig_task_id=eq.${encodeURIComponent(claimId)}`,
              {
                method: 'PATCH',
                headers: serviceHeaders,
                body: JSON.stringify({
                  status: 'rigging',
                  progress: 95,
                  rig_task_id: rigCreated.taskId,
                  error_message: null,
                  updated_at: new Date().toISOString(),
                }),
              },
            );
            return json(200, {
              status: 'ok',
              job: {
                ...current,
                status: 'rigging',
                progress: 95,
                rig_task_id: rigCreated.taskId,
                error_message: null,
              },
            }, request);
          } catch (rigError) {
            const detail = rigError instanceof Error ? rigError.message : 'unbekannt';
            console.error('meshy avatar auto-rig create failed', detail);
            await fetch(
              `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}&rig_task_id=eq.${encodeURIComponent(claimId)}`,
              {
                method: 'PATCH',
                headers: serviceHeaders,
                body: JSON.stringify({
                  status: 'failed',
                  error_message: publicMeshyFailure('rig'),
                  rig_task_id: null,
                  updated_at: new Date().toISOString(),
                }),
              },
            ).catch(() => undefined);
            return json(200, {
              status: 'ok',
              job: {
                ...current,
                status: 'failed',
                error_message: publicMeshyFailure('rig'),
              },
            }, request);
          }
        } catch (claimError) {
          console.error(
            'meshy avatar auto-rig claim failed',
            claimError instanceof Error ? claimError.message : 'unknown',
          );
          return json(200, {
            status: 'ok',
            job: {
              ...current,
              status: 'failed',
              error_message: publicMeshyFailure('rig'),
            },
          }, request);
        }
      }
      } // end !glbDownloadUrl auto-rig

      if (!glbDownloadUrl) {
        console.error('meshy avatar materialize missing glb url');
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'failed',
              error_message: publicMeshyFailure('download'),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: {
            ...current,
            status: 'failed',
            error_message: publicMeshyFailure('download'),
          },
        }, request);
      }

      let downloaded: { bytes: Uint8Array };
      try {
        downloaded = await downloadMeshyGlbBytes(glbDownloadUrl, fetch, {
          maxBytes: AVATAR_MESHY_GLB_MAX_BYTES,
          timeoutMs: 120_000,
        });
        if (downloaded.bytes.byteLength > AVATAR_MESHY_GLB_STORE_MAX_BYTES) {
          throw new Error(
            `Geriggtes Modell zu groß (${Math.ceil(downloaded.bytes.byteLength / (1024 * 1024))} MB).`,
          );
        }
      } catch (downloadError) {
        const message = downloadError instanceof Error
          ? downloadError.message
          : 'Modell-Download fehlgeschlagen.';
        console.error('meshy avatar rigged download failed', message);

        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'failed',
              error_message: publicMeshyFailure('download'),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: {
            ...current,
            status: 'failed',
            error_message: publicMeshyFailure('download'),
          },
        }, request);
      }

      const artifactId = crypto.randomUUID();
      const storagePath = `${userId}/meshy/${artifactId}.glb`;
      // Deno fetch body: copy Uint8Array before body (lesson from #140)
      const runtimePayload = new Uint8Array(downloaded.bytes.byteLength);
      runtimePayload.set(downloaded.bytes);
      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            'Content-Type': 'model/gltf-binary',
            'x-upsert': 'false',
          },
          body: runtimePayload,
        },
      );
      if (!uploadRes.ok) {
        const detail = await uploadRes.text();
        console.error('meshy avatar upload failed', detail);
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'failed',
              error_message: publicMeshyFailure('store'),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json(200, {
          status: 'ok',
          job: { ...current, status: 'failed', error_message: publicMeshyFailure('store') },
        }, request);
      }

      // analyzing = handoff to #6 — still pending capabilities
      await fetch(
        `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
        {
          method: 'PATCH',
          headers: serviceHeaders,
          body: JSON.stringify({
            status: 'succeeded',
            progress: 100,
            storage_path: storagePath,
            pending_glb_url: null,
            rig_analysis_status: 'pending',
            error_message: null,
            updated_at: new Date().toISOString(),
          }),
        },
      );

      const signed = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
        },
      );
      let modelUrl: string | undefined;
      if (signed.ok) {
        const signedBody: unknown = await signed.json();
        if (isRecord(signedBody) && typeof signedBody.signedURL === 'string') {
          modelUrl = `${supabaseUrl}/storage/v1${signedBody.signedURL}`;
        }
      }

      return json(200, {
        status: 'ok',
        job: {
          ...current,
          status: 'succeeded',
          progress: 100,
          storage_path: storagePath,
          rig_analysis_status: 'pending',
          error_message: null,
        },
        modelUrl,
        rigAnalysisStatus: 'pending',
      }, request);
    } catch (error) {
      console.error('meshy avatar poll failed', error instanceof Error ? error.message : 'unknown');
      return json(200, {
        status: 'ok',
        job: {
          ...current,
          status: 'provider_unavailable',
          error_message: publicMeshyFailure('status'),
        },
      }, request);
    }
  }
```

### character-avatar-meshy:4

Predicate: `action === 'retry'`. Source: `supabase/functions/character-avatar-meshy/index.ts:593`.


```ts
{
      if (job.status !== 'failed' && job.status !== 'provider_unavailable') {
        return json(400, { status: 'error', message: 'Retry nur nach Fehler.' }, request);
      }
      // If Meshy already produced a task, resume materialize (no second paid create).
      if (typeof job.provider_task_id === 'string' && job.provider_task_id.trim()) {
        await fetch(
          `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
              status: 'rigging',
              progress: 90,
              error_message: null,
              updated_at: new Date().toISOString(),
            }),
          },
        );
      } else {
        // Paid recreate only for text mode (image bytes are not persisted).
        if (jobGenerationMode(job) === 'image') {
          return json(400, {
            status: 'error',
            message: 'Bild-Job erneut starten: bitte neues Referenzbild hochladen.',
          }, request);
        }
        const apiKey = await resolveMeshyApiKeyForUser(userId, { url: supabaseUrl, serviceRoleKey });
        const provider = resolveTextProvider(apiKey);
        if (!provider) {
          return json(200, {
            status: 'not-configured',
            message: 'Meshy ist nicht konfiguriert.',
          }, request);
        }
        try {
          const created = await provider.createTask(String(job.prompt ?? ''));
          await fetch(
            `${supabaseUrl}/rest/v1/character_avatar_meshy_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              headers: serviceHeaders,
              body: JSON.stringify({
                status: 'generating',
                progress: 5,
                provider_task_id: created.taskId,
                error_message: null,
                updated_at: new Date().toISOString(),
              }),
            },
          );
        } catch {
          return json(200, {
            status: 'ok',
            job: { ...job, status: 'provider_unavailable', error_message: publicMeshyFailure('unavailable') },
          }, request);
        }
      }
    }
```


## Exact type declarations

### SupabaseServiceConfig

`supabase/functions/_shared/ai-provider-resolve-meshy.ts:10`

```ts
export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}
```

### GeometryQuality

`supabase/functions/_shared/avatar-3d-generation.ts:9`

```ts
export type GeometryQuality = 'low' | 'standard' | 'high' | 'maximum' | 'smart-topology';
```

### TextureQuality

`supabase/functions/_shared/avatar-3d-generation.ts:10`

```ts
export type TextureQuality = 'standard' | '2k' | '4k' | '8k';
```

### PoseMode

`supabase/functions/_shared/avatar-3d-generation.ts:11`

```ts
export type PoseMode = 'a-pose' | 't-pose' | 'none';
```

### TopologyMode

`supabase/functions/_shared/avatar-3d-generation.ts:12`

```ts
export type TopologyMode = 'triangle' | 'quad';
```

### Avatar3dGenerationSettings

`supabase/functions/_shared/avatar-3d-generation.ts:14`

```ts
export interface Avatar3dGenerationSettings {
  modelId: string;
  geometryQuality: GeometryQuality;
  textureQuality: TextureQuality;
  pose: PoseMode;
  topology: TopologyMode;
  imageEnhancement: boolean;
  pbr: boolean;
  initialRemesh: boolean;
  targetPolycount: number;
  outputFormat: 'glb';
  keepMaster: boolean;
  runtimePolycount: number;
  providerExtras?: Record<string, string | number | boolean>;
}
```

### MeshyImageTo3dMappedParams

`supabase/functions/_shared/avatar-3d-generation.ts:30`

```ts
export interface MeshyImageTo3dMappedParams {
  ai_model: string;
  model_type: 'standard' | 'smart-topology';
  texture_resolution: '2k' | '4k' | '8k';
  pose_mode: 'a-pose' | 't-pose' | '';
  enable_pbr: boolean;
  image_enhancement: boolean;
  should_texture: boolean;
  should_remesh: boolean;
  topology: 'triangle' | 'quad';
  target_polycount?: number;
  ultra_mode: boolean;
  save_pre_remeshed_model: boolean;
  target_formats: ['glb'];
}
```

### FetchLike

`supabase/functions/_shared/avatar-meshy-remesh.ts:6`

```ts
type FetchLike = typeof fetch;
```

### MeshyRemeshTask

`supabase/functions/_shared/avatar-meshy-remesh.ts:8`

```ts
export interface MeshyRemeshTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}
```

### MeshyRemeshProvider

`supabase/functions/_shared/avatar-meshy-remesh.ts:16`

```ts
export interface MeshyRemeshProvider {
  createTask(input: {
    inputTaskId: string;
    targetPolycount: number;
  }): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyRemeshTask>;
}
```

### FetchLike

`supabase/functions/_shared/avatar-meshy-rigging.ts:9`

```ts
type FetchLike = typeof fetch;
```

### MeshyRiggingTask

`supabase/functions/_shared/avatar-meshy-rigging.ts:11`

```ts
export interface MeshyRiggingTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  /** Rigged character GLB — Meshy nests this under `result`. */
  riggedGlbUrl?: string;
  task_error?: { message?: string };
}
```

### MeshyRiggingCreateInput

`supabase/functions/_shared/avatar-meshy-rigging.ts:20`

```ts
export interface MeshyRiggingCreateInput {
  /** Prefer Meshy task id (text/image/remesh). Takes priority over modelUrl. */
  inputTaskId?: string;
  /** Public https GLB URL or data URI — only when no inputTaskId. */
  modelUrl?: string;
  heightMeters?: number;
}
```

### MeshyRiggingProvider

`supabase/functions/_shared/avatar-meshy-rigging.ts:28`

```ts
export interface MeshyRiggingProvider {
  createTask(input: MeshyRiggingCreateInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyRiggingTask>;
}
```

### MeshyTextTo3dTaskStatus

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:7`

```ts
export type MeshyTextTo3dTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED';
```

### MeshyTextTo3dTask

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:14`

```ts
export interface MeshyTextTo3dTask {
  id: string;
  status: MeshyTextTo3dTaskStatus;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}
```

### MeshyTextTo3dProviderConfig

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:22`

```ts
export interface MeshyTextTo3dProviderConfig {
  apiKey: string;
  baseUrl: string;
}
```

### MeshyTextTo3dProvider

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:27`

```ts
export interface MeshyTextTo3dProvider {
  createTask(prompt: string): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyTextTo3dTask>;
}
```

### FetchLike

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:32`

```ts
type FetchLike = typeof fetch;
```

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

### ItemModel3dMime

`supabase/functions/_shared/item-model3d-glb.ts:17`

```ts
export type ItemModel3dMime = typeof ITEM_MODEL3D_MIME;
```

### MeshyTaskStatus

`supabase/functions/_shared/item-model3d-meshy.ts:7`

```ts
export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
```

### MeshyImageTo3dTask

`supabase/functions/_shared/item-model3d-meshy.ts:9`

```ts
export interface MeshyImageTo3dTask {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}
```

### MeshyImageTo3dProviderConfig

`supabase/functions/_shared/item-model3d-meshy.ts:17`

```ts
export interface MeshyImageTo3dProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
```

### MeshyImageTo3dCreateOptions

`supabase/functions/_shared/item-model3d-meshy.ts:24`

```ts
export interface MeshyImageTo3dCreateOptions {
  texturePrompt?: string;
  poseMode?: 'a-pose' | 't-pose' | '';
  /** When true, Meshy remeshes to targetPolycount before returning GLB. */
  shouldRemesh?: boolean;
  targetPolycount?: number;
  aiModel?: string;
  modelType?: 'standard' | 'smart-topology';
  textureResolution?: '2k' | '4k' | '8k';
  enablePbr?: boolean;
  imageEnhancement?: boolean;
  topology?: 'triangle' | 'quad';
  ultraMode?: boolean;
  savePreRemeshedModel?: boolean;
}
```

### MeshyImageTo3dCreateInput

`supabase/functions/_shared/item-model3d-meshy.ts:41`

```ts
export type MeshyImageTo3dCreateInput =
  | ({ kind: 'input_task_id'; inputTaskId: string } & MeshyImageTo3dCreateOptions)
  | ({ kind: 'image_url'; imageUrl: string } & MeshyImageTo3dCreateOptions);
```

### MeshyImageTo3dProvider

`supabase/functions/_shared/item-model3d-meshy.ts:45`

```ts
export interface MeshyImageTo3dProvider {
  createTask(input: MeshyImageTo3dCreateInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyImageTo3dTask>;
}
```

### FetchLike

`supabase/functions/_shared/item-model3d-meshy.ts:50`

```ts
type FetchLike = typeof fetch;
```

### JsonRecord

`supabase/functions/character-avatar-meshy/index.ts:63`

```ts
type JsonRecord = Record<string, unknown>;
```

### GenerationMode

`supabase/functions/character-avatar-meshy/index.ts:64`

```ts
type GenerationMode = 'text' | 'image';
```

### PublicMeshyFailure

`supabase/functions/character-avatar-meshy/index.ts:82`

```ts
type PublicMeshyFailure =
  | 'generate'
  | 'remesh'
  | 'rig'
  | 'download'
  | 'store'
  | 'status'
  | 'unavailable'
  | 'no_model';
```

### AvatarMeshyTask

`supabase/functions/character-avatar-meshy/index.ts:130`

```ts
type AvatarMeshyTask = {
  status: string;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
};
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

### DEFAULT_RECOMMENDED_SETTINGS

`supabase/functions/_shared/avatar-3d-generation.ts:46`

```ts
DEFAULT_RECOMMENDED_SETTINGS: Avatar3dGenerationSettings = {
  modelId: 'latest',
  geometryQuality: 'high',
  textureQuality: '4k',
  pose: 'a-pose',
  topology: 'triangle',
  imageEnhancement: false,
  pbr: true,
  initialRemesh: false,
  targetPolycount: 50_000,
  outputFormat: 'glb',
  keepMaster: true,
  runtimePolycount: 50_000,
}
```

### GEOMETRY

`supabase/functions/_shared/avatar-3d-generation.ts:61`

```ts
GEOMETRY = new Set(['low', 'standard', 'high', 'maximum', 'smart-topology'])
```

### TEXTURE

`supabase/functions/_shared/avatar-3d-generation.ts:62`

```ts
TEXTURE = new Set(['standard', '2k', '4k', '8k'])
```

### POSE

`supabase/functions/_shared/avatar-3d-generation.ts:63`

```ts
POSE = new Set(['a-pose', 't-pose', 'none'])
```

### TOPOLOGY

`supabase/functions/_shared/avatar-3d-generation.ts:64`

```ts
TOPOLOGY = new Set(['triangle', 'quad'])
```

### PRESET_IDS

`supabase/functions/_shared/avatar-3d-generation.ts:65`

```ts
PRESET_IDS = new Set(['fast', 'recommended', 'maximum', 'custom'])
```

### MESHY_MODEL_IDS

`supabase/functions/_shared/avatar-3d-generation.ts:67`

```ts
MESHY_MODEL_IDS = new Set(['latest', 'meshy-5', 'meshy-6', 'meshy-7', 'meshy-t1', 'meshy-t2'])
```

### validateGenerationSettings

`supabase/functions/_shared/avatar-3d-generation.ts:73`

```ts
export function validateGenerationSettings(
  raw: unknown,
): { ok: true; settings: Avatar3dGenerationSettings } | { ok: false; message: string } {
  if (!isRecord(raw)) return { ok: false, message: 'Generation-Einstellungen ungültig.' };
  const modelId = typeof raw.modelId === 'string' ? raw.modelId.trim() : '';
  if (!modelId || !MESHY_MODEL_IDS.has(modelId)) {
    return { ok: false, message: 'Modell ungültig oder nicht erlaubt.' };
  }
  if (!GEOMETRY.has(String(raw.geometryQuality))) return { ok: false, message: 'Geometrie-Qualität ungültig.' };
  if (!TEXTURE.has(String(raw.textureQuality))) return { ok: false, message: 'Texture-Qualität ungültig.' };
  if (!POSE.has(String(raw.pose))) return { ok: false, message: 'Pose ungültig.' };
  if (!TOPOLOGY.has(String(raw.topology))) return { ok: false, message: 'Topology ungültig.' };
  const targetPolycount = Number(raw.targetPolycount);
  const runtimePolycount = Number(raw.runtimePolycount);
  if (!Number.isFinite(targetPolycount) || targetPolycount < 100 || targetPolycount > 300_000) {
    return { ok: false, message: 'Polycount ungültig.' };
  }
  if (!Number.isFinite(runtimePolycount) || runtimePolycount < 1000 || runtimePolycount > 300_000) {
    return { ok: false, message: 'Runtime-Polycount ungültig.' };
  }
  if (raw.outputFormat !== 'glb') return { ok: false, message: 'Output-Format muss GLB sein.' };

  let providerExtras: Record<string, string | number | boolean> | undefined;
  if (raw.providerExtras !== undefined) {
    if (!isRecord(raw.providerExtras)) return { ok: false, message: 'Provider-Extras ungültig.' };
    providerExtras = {};
    for (const [key, value] of Object.entries(raw.providerExtras)) {
      if (!/^[a-z][a-z0-9_]{0,40}$/i.test(key)) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        providerExtras[key] = value;
      }
    }
    if (Object.keys(providerExtras).length === 0) providerExtras = undefined;
  }

  return {
    ok: true,
    settings: {
      modelId,
      geometryQuality: raw.geometryQuality as GeometryQuality,
      textureQuality: raw.textureQuality as TextureQuality,
      pose: raw.pose as PoseMode,
      topology: raw.topology as TopologyMode,
      imageEnhancement: raw.imageEnhancement === true,
      pbr: raw.pbr === true,
      initialRemesh: raw.initialRemesh === true,
      targetPolycount: Math.round(targetPolycount),
      outputFormat: 'glb',
      keepMaster: raw.keepMaster === true,
      runtimePolycount: Math.round(runtimePolycount),
      ...(providerExtras ? { providerExtras } : {}),
    },
  };
}
```

### parseProviderId

`supabase/functions/_shared/avatar-3d-generation.ts:128`

```ts
export function parseProviderId(value: unknown): 'meshy' | null {
  return value === 'meshy' ? 'meshy' : null;
}
```

### parsePresetMeta

`supabase/functions/_shared/avatar-3d-generation.ts:132`

```ts
export function parsePresetMeta(payload: Record<string, unknown>): {
  presetId: string;
  presetVersion: number;
  presetDirty: boolean;
} {
  const presetId =
    typeof payload.presetId === 'string' && PRESET_IDS.has(payload.presetId)
      ? payload.presetId
      : 'recommended';
  const presetVersion =
    typeof payload.presetVersion === 'number' && Number.isFinite(payload.presetVersion)
      ? Math.max(1, Math.round(payload.presetVersion))
      : 1;
  const presetDirty = payload.presetDirty === true;
  return { presetId, presetVersion, presetDirty };
}
```

### parseCreateResponse

`supabase/functions/_shared/avatar-meshy-remesh.ts:28`

```ts
function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy remesh create response missing result id');
  }
  return body.result.trim();
}
```

### parseTask

`supabase/functions/_shared/avatar-meshy-remesh.ts:35`

```ts
function parseTask(body: unknown): MeshyRemeshTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy remesh task response invalid');
  }
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  let model_urls: { glb?: string } | undefined;
  if (isRecord(body.model_urls)) {
    const glb = typeof body.model_urls.glb === 'string' && body.model_urls.glb.startsWith('https://')
      ? body.model_urls.glb
      : undefined;
    if (glb) model_urls = { glb };
  }
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return {
    id: body.id,
    status: body.status as MeshyRemeshTask['status'],
    progress,
    model_urls,
    task_error,
  };
}
```

### DEFAULT_REMESH_BASE

`supabase/functions/_shared/avatar-meshy-remesh.ts:64`

```ts
DEFAULT_REMESH_BASE = 'https://api.meshy.ai/openapi/v1'
```

### parseCreateResponse

`supabase/functions/_shared/avatar-meshy-rigging.ts:37`

```ts
function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy rigging create response missing result id');
  }
  return body.result.trim();
}
```

### parseHttpsUrl

`supabase/functions/_shared/avatar-meshy-rigging.ts:44`

```ts
function parseHttpsUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}
```

### parseMeshyRiggingTask

`supabase/functions/_shared/avatar-meshy-rigging.ts:48`

```ts
export function parseMeshyRiggingTask(body: unknown): MeshyRiggingTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy rigging task response invalid');
  }
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  let riggedGlbUrl: string | undefined;
  if (isRecord(body.result)) {
    riggedGlbUrl = parseHttpsUrl(body.result.rigged_character_glb_url);
  }
  // Some responses may also expose top-level model_urls.glb — accept as fallback.
  if (!riggedGlbUrl && isRecord(body.model_urls)) {
    riggedGlbUrl = parseHttpsUrl(body.model_urls.glb);
  }
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return {
    id: body.id,
    status: body.status as MeshyRiggingTask['status'],
    progress,
    riggedGlbUrl,
    task_error,
  };
}
```

### DEFAULT_RIGGING_BASE

`supabase/functions/_shared/avatar-meshy-rigging.ts:75`

```ts
DEFAULT_RIGGING_BASE = 'https://api.meshy.ai/openapi/v1'
```

### DEFAULT_BASE

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:34`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v2'
```

### parseCreateResponse

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:69`

```ts
function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy create response missing result id');
  }
  return body.result.trim();
}
```

### parseTask

`supabase/functions/_shared/avatar-meshy-text-to-3d.ts:76`

```ts
function parseTask(body: unknown): MeshyTextTo3dTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy task response invalid');
  }
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;
  let model_urls: { glb?: string } | undefined;
  if (isRecord(body.model_urls)) {
    const glb = typeof body.model_urls.glb === 'string' && body.model_urls.glb.startsWith('https://')
      ? body.model_urls.glb
      : undefined;
    if (glb) model_urls = { glb };
  }
  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;
  return {
    id: body.id,
    status: body.status as MeshyTextTo3dTaskStatus,
    progress,
    model_urls,
    task_error,
  };
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

### buildItemModel3dStoragePath

`supabase/functions/_shared/item-model3d-glb.ts:37`

```ts
export function buildItemModel3dStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
}): string {
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.glb`;
  }
  return `${options.ownerUserId}/${options.definitionId}/${options.assetId}.glb`;
}
```

### buildItemModel3dAssetKey

`supabase/functions/_shared/item-model3d-glb.ts:49`

```ts
export function buildItemModel3dAssetKey(assetId: string): string {
  return `model3d:${assetId}`;
}
```

### validateGlbBytes

`supabase/functions/_shared/item-model3d-glb.ts:70`

```ts
export function validateGlbBytes(
  bytes: Uint8Array,
  claimedMime?: string,
  maxBytes: number = ITEM_MODEL3D_MAX_BYTES,
): { mime: ItemModel3dMime; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty GLB');
  if (bytes.byteLength > maxBytes) throw new Error('GLB exceeds size limit');
  if (!sniffItemModel3dGlb(bytes)) throw new Error('Only GLB (glTF binary) files are allowed');
  if (
    claimedMime &&
    claimedMime !== ITEM_MODEL3D_MIME &&
    claimedMime !== 'application/octet-stream'
  ) {
    throw new Error('Declared MIME does not match GLB contents');
  }
  return { mime: ITEM_MODEL3D_MIME, bytes };
}
```

### DEFAULT_BASE

`supabase/functions/_shared/item-model3d-meshy.ts:52`

```ts
DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1'
```

### DEFAULT_MODEL

`supabase/functions/_shared/item-model3d-meshy.ts:53`

```ts
DEFAULT_MODEL = 'latest'
```

### parseCreateResponse

`supabase/functions/_shared/item-model3d-meshy.ts:79`

```ts
function parseCreateResponse(body: unknown): string {
  if (!isRecord(body) || typeof body.result !== 'string' || !body.result.trim()) {
    throw new Error('Meshy create response missing result id');
  }
  return body.result.trim();
}
```

### parseTask

`supabase/functions/_shared/item-model3d-meshy.ts:86`

```ts
function parseTask(body: unknown): MeshyImageTo3dTask {
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string') {
    throw new Error('Meshy task response invalid');
  }
  const status = body.status as MeshyTaskStatus;
  const progress = typeof body.progress === 'number' && Number.isFinite(body.progress)
    ? Math.max(0, Math.min(100, Math.round(body.progress)))
    : 0;

  let model_urls: { glb?: string } | undefined;
  if (isRecord(body.model_urls)) {
    const glb = typeof body.model_urls.glb === 'string' && body.model_urls.glb.startsWith('https://')
      ? body.model_urls.glb
      : undefined;
    if (glb) model_urls = { glb };
  } else if (typeof body.model_url === 'string' && body.model_url.startsWith('https://')) {
    model_urls = { glb: body.model_url };
  }

  const task_error = isRecord(body.task_error)
    ? { message: typeof body.task_error.message === 'string' ? body.task_error.message : undefined }
    : undefined;

  return { id: body.id, status, progress, model_urls, task_error };
}
```

### CORS_OPTS

`supabase/functions/character-avatar-meshy/index.ts:66`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['CHARACTER_AI_ALLOWED_ORIGIN'],
  allowLocalhostWhenConfigured: true,
  missingOriginPolicy: 'configured-or-star',
}
```

### RATE_LIMIT

`supabase/functions/character-avatar-meshy/index.ts:74`

```ts
RATE_LIMIT = 2
```

### RATE_WINDOW_SECONDS

`supabase/functions/character-avatar-meshy/index.ts:75`

```ts
RATE_WINDOW_SECONDS = 60
```

### SIGNED_URL_SECONDS

`supabase/functions/character-avatar-meshy/index.ts:77`

```ts
SIGNED_URL_SECONDS = 60 * 60 * 24 * 7
```

### IMAGE_PLACEHOLDER_PROMPT

`supabase/functions/character-avatar-meshy/index.ts:78`

```ts
IMAGE_PLACEHOLDER_PROMPT = 'Image-to-3D reference'
```

### IMAGE_MAX_BYTES

`supabase/functions/character-avatar-meshy/index.ts:79`

```ts
IMAGE_MAX_BYTES = 4 * 1024 * 1024
```

### validatePrompt

`supabase/functions/character-avatar-meshy/index.ts:167`

```ts
function validatePrompt(prompt: unknown): { ok: true; prompt: string } | { ok: false; message: string } {
  if (typeof prompt !== 'string') return { ok: false, message: 'Prompt fehlt.' };
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (normalized.length < 8) return { ok: false, message: 'Prompt zu kurz (min. 8 Zeichen).' };
  if (normalized.length > 500) return { ok: false, message: 'Prompt zu lang (max. 500 Zeichen).' };
  return { ok: true, prompt: normalized };
}
```

### validateOptionalTexturePrompt

`supabase/functions/character-avatar-meshy/index.ts:175`

```ts
function validateOptionalTexturePrompt(
  prompt: unknown,
): { ok: true; prompt: string } | { ok: false; message: string } {
  if (prompt === undefined || prompt === null || prompt === '') {
    return { ok: true, prompt: '' };
  }
  if (typeof prompt !== 'string') return { ok: false, message: 'Textur-Prompt ungültig.' };
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (normalized.length > 500) return { ok: false, message: 'Textur-Prompt zu lang (max. 500 Zeichen).' };
  return { ok: true, prompt: normalized };
}
```

### validateImageDataUri

`supabase/functions/character-avatar-meshy/index.ts:187`

```ts
function validateImageDataUri(
  value: unknown,
): { ok: true; dataUri: string } | { ok: false; message: string } {
  if (typeof value !== 'string') return { ok: false, message: 'Bild fehlt.' };
  const normalized = value.trim();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(normalized);
  if (!match) return { ok: false, message: 'Bild muss PNG, JPEG oder WebP als Data-URI sein.' };
  const b64 = match[2]!.replace(/\s+/g, '');
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes <= 0) return { ok: false, message: 'Bild ist leer.' };
  if (approxBytes > IMAGE_MAX_BYTES) {
    return { ok: false, message: 'Bild zu groß (max. 4 MB).' };
  }
  return { ok: true, dataUri: `data:image/${match[1]!.toLowerCase()};base64,${b64}` };
}
```

### parseGenerationMode

`supabase/functions/character-avatar-meshy/index.ts:243`

```ts
function parseGenerationMode(value: unknown): GenerationMode {
  return value === 'image' ? 'image' : 'text';
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/infrastructure/character/avatar/character-avatar-meshy-service.ts` | `d651c0cac61f73bdd668c86f536d338411383ffc2b72792ad3b20c276b07147d` |
| `supabase/functions/_shared/ai-provider-crypto.ts` | `45e60f76f744077e8d9b243719dcdba5d58a047d36a1c141df830afa2de16532` |
| `supabase/functions/_shared/ai-provider-resolve-meshy.ts` | `b65f8aa91c02871a2661e1ca697c6115f3c7c4ec07c683d1e7ed19c39287a842` |
| `supabase/functions/_shared/avatar-3d-generation.ts` | `59f0507973e94af6aff505622204a8f580a2b1594e6167943c888b4c7b0e250d` |
| `supabase/functions/_shared/avatar-meshy-rate-limit.ts` | `e2eeddfa2628c9e7e64cb386bb7e0f9933632df8240b1906a80c1970f2e3eb68` |
| `supabase/functions/_shared/avatar-meshy-remesh.ts` | `cb2133152780c8d8ffb9b69e5358c676c672a41eb1e103b98c29c9dc16fe31e0` |
| `supabase/functions/_shared/avatar-meshy-rigging.ts` | `2d1686c1b38dfdeea5299565756adbbc72db600bec8e98dfe73ce9ba55abca6b` |
| `supabase/functions/_shared/avatar-meshy-text-to-3d.ts` | `247fbcf43b0b9425f147b4b87337f13bfca52199c575bbf27cbd25b8c55be2ca` |
| `supabase/functions/_shared/client-trust-body.ts` | `33c68553dbd89d9c7899520b0ebfa35c4f245ed8ab8ebd242c6f79e9852add95` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/_shared/item-model3d-glb.ts` | `f227056ed5d1041def2009c37224c8df1139098bb3be8859bba984845fb7410e` |
| `supabase/functions/_shared/item-model3d-meshy.ts` | `8b194b23304884c8ca3d2c0935e8b67e27decfaca3e1e2657b1901dfb69d8355` |
| `supabase/functions/character-avatar-meshy/index.ts` | `c29eca334121056bf317025aecd3d2c9eb91bac9a16cea94bebbeae8f4148200` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

