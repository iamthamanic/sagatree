# Edge contract: item-model3d

**Status: SPEC; current branch source verified.** Implementation issue: **#825**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-item-model3d.json](source-contracts/edge-item-model3d.json) (SHA-256 `a00d97d525219dbafacf2b682912b4e1b0c554ec402d6348aabc672061303c32`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**allowlisted-worker** — Current branch mount; a successor cutover still requires gates and contract tests.

Owner/world-owner item GLB image-to-3D upload, generation and persisted asset/job resolution.

Authenticate /auth/v1/user. Definition must be active: personal.owner_user_id===caller, or world_profiles.owner_user_id===caller for world scope. Project membership/GM role is insufficient. status/latest-job filter owner_user_id. resolve allows asset owner or referenced world-profile owner. remove clears pointer but only deletes physical asset owned by caller.

## Request variants, fields and defaults

- **transport:** POST any worker subpath, OPTIONS204, other methods405; Content-Length preflight <= 70MiB, no independent actual JSON byte bound; JSON object with string action
- **config:** {action:'config'}
- **upload:** {action:'upload',definitionId:string(trimmed nonempty),contentBase64:string(nonempty),mime?:string}; validates four-byte glTF magic and claimed MIME (model/gltf-binary or application/octet-stream); no version/chunk structure validation, decoded <= 52428800 bytes. Definition lookup/authz precede upload.
- **generate:** {action:'generate',definitionId:string(trimmed nonempty)}; source is definition.payload.assetKey pointing at saved non-deleted thumbnail, or thumbnail Meshy task result; absent =>400 THUMBNAIL_REQUIRED
- **status:** {action:'status',jobId:string(trimmed nonempty)}; lookup only caller-owned job
- **resolve:** {action:'resolve',model3d?:string,assetId?:string}; valid model3d: prefix wins over fallback assetId; nonempty required, UUID format not independently checked
- **removeLatestJob:** {action:'remove'|'latest-job',definitionId:string(trimmed nonempty)}; latest returns newest own job only

## Success and error contracts

- **config:** {status:'ok',meshyConfigured:boolean,maxBytes:52428800,allowedMime:['model/gltf-binary']}
- **upload:** {status:'ok',assetId,model3d,signedUrl,mime,byteSize}
- **generate:** {status:'ok',jobId,jobStatus:'waiting',progress:5}
- **status:** {status:'ok',jobId,jobStatus,progress,errorMessage?:string,model3d?:string,signedUrl?:string}; terminal failed/canceled/succeeded replay; missing provider/task returns stored status/progress; completed active definition materializes asset and progress100
- **resolve:** {status:'ok',model3d:'model3d:'+assetId,signedUrl}
- **remove:** {status:'ok',removed:true}
- **latest:** {status:'ok',job:null|{jobId,jobStatus,progress,errorMessage?:string,model3d?:string}}; latest has no signedUrl
- **optionalFields:** JSON.stringify omits undefined optional properties rather than returning null; progress falls back0 for stored row,10 for active provider mapping

- Error envelope {status:'error',message:string,code?:string}; method405, body header413, missing Supabase config503, auth401, malformed JSON/missing action/required fields400, unknown action404.
- Absent definition/job/asset404; foreign access or archived definition403; failed decode/validation and unexpected provider/DB/storage failure caught as generic500. Auth network errors occur before action catch.
- Missing provider503 {status:'not-configured',message}; credits402 code PAYMENT_REQUIRED; provider/quota429 code RATE_LIMIT. Missing saved thumbnail400 code THUMBNAIL_REQUIRED.
- Provider terminal failed/canceled or inactive definition returns HTTP200 status ok with failed/canceled job and errorMessage. Several job PATCH and list/asset response statuses are unchecked; response alone does not prove durable update.

## Side effects and transaction boundaries

- Upload: item-models storage POST -> item_model3d_assets INSERT -> inventory_item_definitions.payload.model3d PATCH -> seven-day signed URL. This is a multi-request sequence, not an atomic transaction.
- Generate: resolve caller Meshy BYOK (host key only explicit AI_PROVIDER_ALLOW_HOST_KEYS=1), persistent quota RPC, provider paid create -> item_model3d_jobs INSERT. No idempotency key or automatic paid retry.
- Status may poll provider, download validated GLB, materialize, upload asset, insert metadata, patch definition pointer and job. Definition is rechecked active/authorized before materialization.
- Remove first unsets definition payload.model3d; marks caller-owned linked asset deleted_at and attempts storage cleanup. World owner can clear other-owner pointer without deleting that user's physical asset.
- resolve/status create seven-day signed URLs. latest-job is owner-filtered read. No realtime publishing.

## Quota, environment and transport


```json
{
  "kind": "persistent-rpc",
  "rpc": "consume_item_model3d_rate_limit",
  "scope": "authenticated userId",
  "defaultLimit": 2,
  "maxConfiguredLimit": 60,
  "windowSeconds": 60,
  "env": "ITEM_MODEL3D_RATE_LIMIT_PER_MINUTE",
  "chargedActions": [
    "generate after provider resolve but before definition/body validation"
  ],
  "failure": "false =>429; RPC HTTP/invalid response throws => generic500; no provider create when quota fails"
}
```

Auth10s, BYOK lookup10s, service20s, quota10s; storage GLB upload60s, stored thumbnail download30s, signing/cleanup10s; signed URLs604800s. Meshy create30s,poll20s; provider GLB download60s (HTTPS allowlist and<=2 redirects). No request retry loop; status calls poll explicitly.

- `AI_PROVIDER_ALLOW_HOST_KEYS`
- `CHARACTER_AI_ALLOWED_ORIGIN`
- `CREDENTIALS_ENCRYPTION_KEY`
- `ITEM_MODEL3D_ALLOWED_ORIGIN`
- `ITEM_MODEL3D_MESHY_MOCK`
- `ITEM_MODEL3D_RATE_LIMIT_PER_MINUTE`
- `ITEM_THUMBNAIL_ALLOWED_ORIGIN`
- `ITEM_THUMBNAIL_MESHY_MOCK`
- `MESHY_API_BASE_URL`
- `MESHY_API_KEY`
- `MESHY_IMAGE_TO_3D_MODEL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

- `supabase/functions/_shared/ai-provider-resolve-meshy.ts:45` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/ai-provider-resolve-meshy.ts:99` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/item-model3d-glb.ts:122` — `AbortSignal.timeout(timeoutMs)`
- `supabase/functions/_shared/item-model3d-glb.ts:211` — `AbortSignal.timeout(timeoutMs)`
- `supabase/functions/_shared/item-model3d-meshy.ts:183` — `AbortSignal.timeout(30_000)`
- `supabase/functions/_shared/item-model3d-meshy.ts:203` — `AbortSignal.timeout(20_000)`
- `supabase/functions/_shared/item-model3d-rate-limit.ts:50` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/item-thumbnail-image.ts:138` — `AbortSignal.timeout(20_000)`
- `supabase/functions/item-model3d/index.ts:117` — `AbortSignal.timeout(10_000)`
- `supabase/functions/item-model3d/index.ts:138` — `AbortSignal.timeout(20_000)`
- `supabase/functions/item-model3d/index.ts:227` — `AbortSignal.timeout(60_000)`
- `supabase/functions/item-model3d/index.ts:246` — `AbortSignal.timeout(30_000)`
- `supabase/functions/item-model3d/index.ts:265` — `AbortSignal.timeout(10_000)`
- `supabase/functions/item-model3d/index.ts:287` — `AbortSignal.timeout(10_000)`

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

`supabase/functions/item-model3d/index.ts:39`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```

### DEFAULT_RATE_LIMIT

`supabase/functions/item-model3d/index.ts:67`

```ts
DEFAULT_RATE_LIMIT = 2
```

### getSupabaseConfig

`supabase/functions/item-model3d/index.ts:83`

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

`supabase/functions/item-model3d/index.ts:91`

```ts
function getRateLimit(): number {
  const configured = Number.parseInt(Deno.env.get('ITEM_MODEL3D_RATE_LIMIT_PER_MINUTE') || '', 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60) : DEFAULT_RATE_LIMIT;
}
```

### resolveProvider

`supabase/functions/item-model3d/index.ts:96`

```ts
async function resolveProvider(
  userId: string,
  supabaseConfig: SupabaseConfig,
): Promise<MeshyImageTo3dProvider | null> {
  if (Deno.env.get('ITEM_MODEL3D_MESHY_MOCK') === '1') {
    return createMockMeshyImageTo3dProvider();
  }
  const apiKey = await resolveMeshyApiKeyForUser(userId, {
    url: supabaseConfig.url,
    serviceRoleKey: supabaseConfig.serviceRoleKey,
  });
  const config = resolveMeshyImageTo3dConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyImageTo3dProvider(config);
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |
| edge | `ai-provider-credentials` | #818 |  |
| internal-rpc | `consume_item_model3d_rate_limit` | #825 | quota prerequisite owned by this Edge port |
| table | `inventory_item_definitions` | #791 | Policy #792 |
| table | `item_model3d_assets` | #791 | Policy #792 |
| table | `item_model3d_jobs` | #791 | Policy #792 |
| table | `item_thumbnail_assets` | #791 | Policy #792 |
| table | `user_ai_provider_credentials` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| storage | `item-models` | #841 |  |
| storage | `item-thumbnails` | #841 |  |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```


## Acceptance and negative tests (required, not executed)

- Personal owner and world-profile owner can upload valid GLB<=50MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- generate consumes 2/60s per user; request3429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- Each action returns its exact documented union; model3d uses model3d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- Foreign jobId404, foreign resolve403; remove of absent pointer succeeds and cannot delete a different owner's object; traversal/off-allowlist provider redirect/oversize asset never materializes.
- Provider failure and unchecked job PATCH persistence failure are distinguished in the tested successor contract; no API keys in public failure bodies.

## Observed legacy defects and explicit successor decisions

- Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
- Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.
- GLB validator checks magic, size and MIME only; it does not validate GLB version/declared length/chunk structure.

## All adapter call sites

### src/infrastructure/inventory/item-model3d-service.ts:89


```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('item-model3d', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? '3D-Modell-Dienst nicht erreichbar.');
  }
  return parseResponse(data);
}
```


## Exact ordered operations

### item-model3d:1

Predicate: `action === 'config'`. Source: `supabase/functions/item-model3d/index.ts:433`.


```ts
{
      const meshyConfigured = await isMeshyConfiguredForUser(userId, {
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
      });
      return jsonResponse(request, {
        status: 'ok',
        meshyConfigured,
        maxBytes: 50 * 1024 * 1024,
        allowedMime: ['model/gltf-binary'],
      });
    }
```

### item-model3d:2

Predicate: `action === 'upload'`. Source: `supabase/functions/item-model3d/index.ts:446`.


```ts
{
      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64 : '';
      const claimedMime = typeof body.mime === 'string' ? body.mime : undefined;
      if (!definitionId || !contentBase64) {
        return jsonResponse(request, { status: 'error', message: 'definitionId and contentBase64 required' }, 400);
      }

      const definition = await loadDefinition(config, definitionId);
      if (!definition) {
        return jsonResponse(request, { status: 'error', message: 'Definition not found' }, 404);
      }
      await assertCanMutateDefinition(config, userId, definition);

      const raw = decodeBase64Glb(contentBase64);
      const { mime, bytes } = validateGlbBytes(raw, claimedMime);
      const assetId = crypto.randomUUID();
      const storagePath = buildItemModel3dStoragePath({
        ownerUserId: userId,
        definitionId,
        worldProfileId: definition.world_profile_id,
        assetId,
      });

      await uploadToStorage(config, storagePath, bytes, mime);
      await insertAsset(config, {
        id: assetId,
        definitionId,
        ownerUserId: userId,
        worldProfileId: definition.world_profile_id,
        mime,
        byteSize: bytes.byteLength,
        storagePath,
        origin: 'upload',
      });

      const model3d = buildItemModel3dAssetKey(assetId);
      await patchDefinitionModel3d(config, definition, model3d);
      const signedUrl = await createSignedUrl(config, storagePath);

      return jsonResponse(request, {
        status: 'ok',
        assetId,
        model3d,
        signedUrl,
        mime,
        byteSize: bytes.byteLength,
      });
    }
```

### item-model3d:3

Predicate: `action === 'generate'`. Source: `supabase/functions/item-model3d/index.ts:496`.


```ts
{
      const provider = await resolveProvider(userId, config);
      if (!provider) {
        return jsonResponse(request, {
          status: 'not-configured',
          message: 'Meshy ist nicht konfiguriert. GLB-Upload bleibt verfügbar.',
        }, 503);
      }

      const allowed = await consumeItemModel3dRateLimit({
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
        limit: getRateLimit(),
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      }, userId);
      if (!allowed) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Zu viele Generierungen. Bitte kurz warten.',
          code: 'RATE_LIMIT',
        }, 429);
      }

      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      if (!definitionId) {
        return jsonResponse(request, { status: 'error', message: 'definitionId required' }, 400);
      }
      const definition = await loadDefinition(config, definitionId);
      if (!definition) {
        return jsonResponse(request, { status: 'error', message: 'Definition not found' }, 404);
      }
      await assertCanMutateDefinition(config, userId, definition);

      let generateInput: Awaited<ReturnType<typeof resolveGenerateInput>>;
      try {
        generateInput = await resolveGenerateInput(config, definition);
      } catch (error) {
        if (error instanceof Error && error.message === 'THUMBNAIL_REQUIRED') {
          return jsonResponse(request, {
            status: 'error',
            message: 'Für Image-to-3D wird ein gespeichertes Thumbnail benötigt.',
            code: 'THUMBNAIL_REQUIRED',
          }, 400);
        }
        throw error;
      }

      const jobId = crypto.randomUUID();
      let providerTaskId: string;
      try {
        const created = await provider.createTask(generateInput.createInput);
        providerTaskId = created.taskId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meshy error';
        if (message === 'MESHY_CREDITS') {
          return jsonResponse(request, {
            status: 'error',
            message: 'Meshy-Guthaben erschöpft.',
            code: 'PAYMENT_REQUIRED',
          }, 402);
        }
        if (message === 'MESHY_RATE') {
          return jsonResponse(request, {
            status: 'error',
            message: 'Meshy Rate-Limit erreicht.',
            code: 'RATE_LIMIT',
          }, 429);
        }
        throw error;
      }

      const insertJob = await serviceFetch(config, '/rest/v1/item_model3d_jobs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: jobId,
          definition_id: definitionId,
          owner_user_id: userId,
          world_profile_id: definition.world_profile_id,
          status: 'waiting',
          progress: 5,
          input_thumbnail_asset_id: generateInput.thumbnailAssetId,
          input_provider_task_id: generateInput.inputProviderTaskId,
          provider_task_id: providerTaskId,
        }),
      });
      if (!insertJob.ok) throw new Error(`Job insert failed (${insertJob.status})`);

      return jsonResponse(request, {
        status: 'ok',
        jobId,
        jobStatus: 'waiting',
        progress: 5,
      });
    }
```

### item-model3d:4

Predicate: `action === 'status'`. Source: `supabase/functions/item-model3d/index.ts:592`.


```ts
{
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      if (!jobId) {
        return jsonResponse(request, { status: 'error', message: 'jobId required' }, 400);
      }

      const jobRes = await serviceFetch(
        config,
        `/rest/v1/item_model3d_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (!jobRes.ok) throw new Error(`Job lookup failed (${jobRes.status})`);
      const jobs: unknown = await jobRes.json();
      const job = Array.isArray(jobs) ? jobs[0] : null;
      if (!isRecord(job)) {
        return jsonResponse(request, { status: 'error', message: 'Job not found' }, 404);
      }

      const terminal = job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled';
      if (terminal) {
        let signedUrl: string | undefined;
        let model3d: string | undefined;
        if (typeof job.asset_id === 'string') {
          model3d = buildItemModel3dAssetKey(job.asset_id);
          const assetRes = await serviceFetch(
            config,
            `/rest/v1/item_model3d_assets?select=storage_path&id=eq.${encodeURIComponent(job.asset_id)}&limit=1`,
          );
          const assets: unknown = await assetRes.json();
          const asset = Array.isArray(assets) ? assets[0] : null;
          if (isRecord(asset) && typeof asset.storage_path === 'string') {
            signedUrl = await createSignedUrl(config, asset.storage_path);
          }
        }
        return jsonResponse(request, {
          status: 'ok',
          jobId,
          jobStatus: job.status,
          progress: typeof job.progress === 'number' ? job.progress : 0,
          errorMessage: typeof job.error_message === 'string' ? job.error_message : undefined,
          model3d,
          signedUrl,
        });
      }

      const provider = await resolveProvider(userId, config);
      if (!provider || typeof job.provider_task_id !== 'string') {
        return jsonResponse(request, {
          status: 'ok',
          jobId,
          jobStatus: job.status,
          progress: typeof job.progress === 'number' ? job.progress : 0,
        });
      }

      const task = await provider.getTask(job.provider_task_id);
      const mapped = mapMeshyImageTo3dStatusToJob(task.status);

      if (mapped.status === 'succeeded') {
        const definitionId = typeof job.definition_id === 'string' ? job.definition_id : '';
        const definition = await loadDefinition(config, definitionId);
        if (!definition || definition.status !== 'active') {
          await serviceFetch(
            config,
            `/rest/v1/item_model3d_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'failed',
                progress: 0,
                error_message: 'Definition nicht mehr aktiv.',
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return jsonResponse(request, {
            status: 'ok',
            jobId,
            jobStatus: 'failed',
            progress: 0,
            errorMessage: 'Definition nicht mehr aktiv.',
          });
        }
        await assertCanMutateDefinition(config, userId, definition);

        const glbUrl = task.model_urls?.glb;
        if (!glbUrl) throw new Error('Meshy succeeded without GLB URL');

        const downloaded = await downloadMeshyGlbBytes(glbUrl);
        const assetId = crypto.randomUUID();
        const storagePath = buildItemModel3dStoragePath({
          ownerUserId: userId,
          definitionId,
          worldProfileId: definition.world_profile_id,
          assetId,
        });
        await uploadToStorage(config, storagePath, downloaded.bytes, downloaded.mime);
        await insertAsset(config, {
          id: assetId,
          definitionId,
          ownerUserId: userId,
          worldProfileId: definition.world_profile_id,
          mime: downloaded.mime,
          byteSize: downloaded.bytes.byteLength,
          storagePath,
          origin: 'meshy',
          providerTaskId: job.provider_task_id,
        });
        const model3d = buildItemModel3dAssetKey(assetId);
        await patchDefinitionModel3d(config, definition, model3d);
        await serviceFetch(
          config,
          `/rest/v1/item_model3d_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'succeeded',
              progress: 100,
              asset_id: assetId,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        const signedUrl = await createSignedUrl(config, storagePath);
        return jsonResponse(request, {
          status: 'ok',
          jobId,
          jobStatus: 'succeeded',
          progress: 100,
          model3d,
          signedUrl,
        });
      }

      if (mapped.status === 'failed' || mapped.status === 'canceled') {
        const errorMessage = task.task_error?.message || 'Generierung fehlgeschlagen';
        await serviceFetch(
          config,
          `/rest/v1/item_model3d_jobs?id=eq.${encodeURIComponent(jobId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: mapped.status,
              progress: 0,
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return jsonResponse(request, {
          status: 'ok',
          jobId,
          jobStatus: mapped.status,
          progress: 0,
          errorMessage,
        });
      }

      await serviceFetch(
        config,
        `/rest/v1/item_model3d_jobs?id=eq.${encodeURIComponent(jobId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: mapped.status,
            progress: mapped.progress || (typeof job.progress === 'number' ? job.progress : 10),
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return jsonResponse(request, {
        status: 'ok',
        jobId,
        jobStatus: mapped.status,
        progress: mapped.progress || 10,
      });
    }
```

### item-model3d:5

Predicate: `action === 'resolve'`. Source: `supabase/functions/item-model3d/index.ts:770`.


```ts
{
      const model3dKey = typeof body.model3d === 'string' ? body.model3d.trim() : '';
      const assetId = model3dKey.startsWith('model3d:')
        ? model3dKey.slice('model3d:'.length)
        : (typeof body.assetId === 'string' ? body.assetId.trim() : '');
      if (!assetId) {
        return jsonResponse(request, { status: 'error', message: 'model3d required' }, 400);
      }
      const assetRes = await serviceFetch(
        config,
        `/rest/v1/item_model3d_assets?select=*&id=eq.${encodeURIComponent(assetId)}&deleted_at=is.null&limit=1`,
      );
      const assets: unknown = await assetRes.json();
      const asset = Array.isArray(assets) ? assets[0] : null;
      if (!isRecord(asset) || typeof asset.storage_path !== 'string' || typeof asset.owner_user_id !== 'string') {
        return jsonResponse(request, { status: 'error', message: 'Asset not found' }, 404);
      }
      const worldId = typeof asset.world_profile_id === 'string' ? asset.world_profile_id : null;
      const allowed = await assertCanReadAsset(config, userId, asset.owner_user_id, worldId);
      if (!allowed) {
        return jsonResponse(request, { status: 'error', message: 'Forbidden' }, 403);
      }
      const signedUrl = await createSignedUrl(config, asset.storage_path);
      return jsonResponse(request, {
        status: 'ok',
        model3d: buildItemModel3dAssetKey(assetId),
        signedUrl,
      });
    }
```

### item-model3d:6

Predicate: `action === 'remove'`. Source: `supabase/functions/item-model3d/index.ts:800`.


```ts
{
      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      if (!definitionId) {
        return jsonResponse(request, { status: 'error', message: 'definitionId required' }, 400);
      }
      const definition = await loadDefinition(config, definitionId);
      if (!definition) {
        return jsonResponse(request, { status: 'error', message: 'Definition not found' }, 404);
      }
      await assertCanMutateDefinition(config, userId, definition);

      const previousKey = typeof definition.payload.model3d === 'string'
        ? definition.payload.model3d
        : null;
      await patchDefinitionModel3d(config, definition, null);

      if (previousKey?.startsWith('model3d:')) {
        const assetId = previousKey.slice('model3d:'.length);
        const assetRes = await serviceFetch(
          config,
          `/rest/v1/item_model3d_assets?select=id,storage_path,owner_user_id&id=eq.${encodeURIComponent(assetId)}&limit=1`,
        );
        const assets: unknown = await assetRes.json();
        const asset = Array.isArray(assets) ? assets[0] : null;
        if (
          isRecord(asset) &&
          typeof asset.storage_path === 'string' &&
          asset.owner_user_id === userId
        ) {
          await serviceFetch(
            config,
            `/rest/v1/item_model3d_assets?id=eq.${encodeURIComponent(assetId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ deleted_at: new Date().toISOString() }),
            },
          );
          await softDeleteStorage(config, asset.storage_path);
        }
      }

      return jsonResponse(request, { status: 'ok', removed: true });
    }
```

### item-model3d:7

Predicate: `action === 'latest-job'`. Source: `supabase/functions/item-model3d/index.ts:844`.


```ts
{
      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      if (!definitionId) {
        return jsonResponse(request, { status: 'error', message: 'definitionId required' }, 400);
      }
      const jobRes = await serviceFetch(
        config,
        `/rest/v1/item_model3d_jobs?select=id,status,progress,error_message,asset_id,created_at&definition_id=eq.${encodeURIComponent(definitionId)}&owner_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`,
      );
      const jobs: unknown = await jobRes.json();
      const job = Array.isArray(jobs) ? jobs[0] : null;
      if (!isRecord(job) || typeof job.id !== 'string') {
        return jsonResponse(request, { status: 'ok', job: null });
      }
      return jsonResponse(request, {
        status: 'ok',
        job: {
          jobId: job.id,
          jobStatus: job.status,
          progress: typeof job.progress === 'number' ? job.progress : 0,
          errorMessage: typeof job.error_message === 'string' ? job.error_message : undefined,
          model3d: typeof job.asset_id === 'string'
            ? buildItemModel3dAssetKey(job.asset_id)
            : undefined,
        },
      });
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

### ItemModel3dRateLimitConfig

`supabase/functions/_shared/item-model3d-rate-limit.ts:6`

```ts
export interface ItemModel3dRateLimitConfig {
  url: string;
  serviceRoleKey: string;
  limit: number;
  windowSeconds: number;
}
```

### FetchLike

`supabase/functions/_shared/item-model3d-rate-limit.ts:13`

```ts
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
```

### ItemThumbnailMime

`supabase/functions/_shared/item-thumbnail-image.ts:8`

```ts
export type ItemThumbnailMime = (typeof ITEM_THUMBNAIL_ALLOWED_MIME)[number];
```

### JsonRecord

`supabase/functions/item-model3d/index.ts:37`

```ts
type JsonRecord = Record<string, unknown>;
```

### SupabaseConfig

`supabase/functions/item-model3d/index.ts:48`

```ts
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}
```

### DefinitionRow

`supabase/functions/item-model3d/index.ts:54`

```ts
interface DefinitionRow {
  id: string;
  scope: 'personal' | 'world';
  owner_user_id: string;
  world_profile_id: string | null;
  status: 'active' | 'archived';
  payload: JsonRecord;
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

### RATE_LIMIT_RPC

`supabase/functions/_shared/item-model3d-rate-limit.ts:18`

```ts
RATE_LIMIT_RPC = '/rest/v1/rpc/consume_item_model3d_rate_limit'
```

### buildItemThumbnailStoragePath

`supabase/functions/_shared/item-thumbnail-image.ts:61`

```ts
export function buildItemThumbnailStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
  mime: ItemThumbnailMime;
}): string {
  const ext = extensionForItemThumbnailMime(options.mime);
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.${ext}`;
  }
  return `${options.ownerUserId}/${options.definitionId}/${options.assetId}.${ext}`;
}
```

### buildItemThumbnailAssetKey

`supabase/functions/_shared/item-thumbnail-image.ts:75`

```ts
export function buildItemThumbnailAssetKey(assetId: string): string {
  return `thumbnail2d:${assetId}`;
}
```

### validateThumbnailBytes

`supabase/functions/_shared/item-thumbnail-image.ts:93`

```ts
export function validateThumbnailBytes(
  bytes: Uint8Array,
  claimedMime?: string,
): { mime: ItemThumbnailMime; bytes: Uint8Array } {
  if (bytes.byteLength === 0) throw new Error('Empty image');
  if (bytes.byteLength > ITEM_THUMBNAIL_MAX_BYTES) throw new Error('Image exceeds 10 MB limit');
  const sniffed = sniffItemThumbnailMime(bytes);
  if (!sniffed) throw new Error('Only PNG, JPEG and WebP images are allowed');
  if (claimedMime && claimedMime !== sniffed && !(claimedMime === 'image/jpg' && sniffed === 'image/jpeg')) {
    throw new Error('Declared MIME does not match file contents');
  }
  return { mime: sniffed, bytes };
}
```

### CORS_OPTS

`supabase/functions/item-model3d/index.ts:39`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
}
```

### MAX_REQUEST_BYTES

`supabase/functions/item-model3d/index.ts:65`

```ts
MAX_REQUEST_BYTES = 70 * 1024 * 1024
```

### RATE_LIMIT_WINDOW_SECONDS

`supabase/functions/item-model3d/index.ts:66`

```ts
RATE_LIMIT_WINDOW_SECONDS = 60
```

### DEFAULT_RATE_LIMIT

`supabase/functions/item-model3d/index.ts:67`

```ts
DEFAULT_RATE_LIMIT = 2
```

### SIGNED_URL_SECONDS

`supabase/functions/item-model3d/index.ts:68`

```ts
SIGNED_URL_SECONDS = 60 * 60 * 24 * 7
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/infrastructure/inventory/item-model3d-service.ts` | `c2ab599cea52e8ba923fc12c71129d38801dc00027064c5fe72aa2ceffafff55` |
| `supabase/functions/_shared/ai-provider-crypto.ts` | `45e60f76f744077e8d9b243719dcdba5d58a047d36a1c141df830afa2de16532` |
| `supabase/functions/_shared/ai-provider-resolve-meshy.ts` | `b65f8aa91c02871a2661e1ca697c6115f3c7c4ec07c683d1e7ed19c39287a842` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/_shared/item-model3d-glb.ts` | `f227056ed5d1041def2009c37224c8df1139098bb3be8859bba984845fb7410e` |
| `supabase/functions/_shared/item-model3d-meshy.ts` | `8b194b23304884c8ca3d2c0935e8b67e27decfaca3e1e2657b1901dfb69d8355` |
| `supabase/functions/_shared/item-model3d-rate-limit.ts` | `2fdf5ca32dccf1cca8eac0de1d86d6926a671a9be9e0d1887e1fe607e9670a9d` |
| `supabase/functions/_shared/item-thumbnail-image.ts` | `caf768022788be451fdfc5dfeadf837fd48e2edecc26a68d14794f6a21853713` |
| `supabase/functions/item-model3d/index.ts` | `929ede1136b60facc537d6f83e9678daf6f84abd7101f1fc4e0e1a7a40818dab` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

