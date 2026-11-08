/**
 * item-thumbnail Edge Function — secure upload + optional Meshy text-to-image (#140).
 * Secrets stay server-side; Meshy uses user BYOK (host key only if AI_PROVIDER_ALLOW_HOST_KEYS=1).
 * Location: supabase/functions/item-thumbnail/index.ts
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  isMeshyConfiguredForUser,
  resolveMeshyApiKeyForUser,
} from '../_shared/ai-provider-resolve-meshy.ts';
import {
  assertSafeUserExtra,
  buildItemThumbnailPrompt,
} from '../_shared/item-thumbnail-prompt.ts';
import {
  buildItemThumbnailAssetKey,
  buildItemThumbnailStoragePath,
  decodeBase64Image,
  downloadMeshyImageBytes,
  validateThumbnailBytes,
  type ItemThumbnailMime,
} from '../_shared/item-thumbnail-image.ts';
import {
  createLiveMeshyProvider,
  createMockMeshyProvider,
  mapMeshyStatusToJob,
  resolveMeshyProviderConfig,
  type MeshyTextToImageProvider,
} from '../_shared/item-thumbnail-meshy.ts';
import { consumeItemThumbnailRateLimit } from '../_shared/item-thumbnail-rate-limit.ts';
import {
  optimizeProviderThumbnailBytes,
  providerOptimizeFailureMessage,
} from '../_shared/media-server-raster-optimize.ts';
import {
  corsHeaders,
  handleOptions,
  jsonResponse as sharedJsonResponse,
  type CorsOptions,
} from '../_shared/cors.ts';
import { privilegedClientBodyRejectionMessage } from '../_shared/client-trust-body.ts';

type JsonRecord = Record<string, unknown>;

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
};

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

interface DefinitionRow {
  id: string;
  scope: 'personal' | 'world';
  owner_user_id: string;
  world_profile_id: string | null;
  status: 'active' | 'archived';
  payload: JsonRecord;
}

const BUCKET = 'item-thumbnails';
const MAX_REQUEST_BYTES = 14 * 1024 * 1024;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT = 4;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getCorsHeaders(request: Request): HeadersInit {
  return corsHeaders(request, CORS_OPTS);
}

function jsonResponse(request: Request, body: JsonRecord, status = 200): Response {
  return sharedJsonResponse(request, body, status, CORS_OPTS);
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey, serviceRoleKey };
}

function getRateLimit(): number {
  const configured = Number.parseInt(Deno.env.get('ITEM_THUMBNAIL_RATE_LIMIT_PER_MINUTE') || '', 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60) : DEFAULT_RATE_LIMIT;
}

async function resolveProvider(
  userId: string,
  supabaseConfig: SupabaseConfig,
): Promise<MeshyTextToImageProvider | null> {
  if (Deno.env.get('ITEM_THUMBNAIL_MESHY_MOCK') === '1') {
    return createMockMeshyProvider();
  }
  const apiKey = await resolveMeshyApiKeyForUser(userId, {
    url: supabaseConfig.url,
    serviceRoleKey: supabaseConfig.serviceRoleKey,
  });
  const config = resolveMeshyProviderConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyProvider(config);
}

async function authenticate(request: Request, config: SupabaseConfig): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: config.anonKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return isRecord(body) && typeof body.id === 'string' ? body.id : null;
}

async function serviceFetch(
  config: SupabaseConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
}

async function loadDefinition(
  config: SupabaseConfig,
  definitionId: string,
): Promise<DefinitionRow | null> {
  const response = await serviceFetch(
    config,
    `/rest/v1/inventory_item_definitions?select=id,scope,owner_user_id,world_profile_id,status,payload&id=eq.${encodeURIComponent(definitionId)}&limit=1`,
  );
  if (!response.ok) throw new Error(`Definition lookup failed (${response.status})`);
  const body: unknown = await response.json();
  const row = Array.isArray(body) ? body[0] : null;
  if (!isRecord(row)) return null;
  if (
    typeof row.id !== 'string' ||
    (row.scope !== 'personal' && row.scope !== 'world') ||
    typeof row.owner_user_id !== 'string' ||
    (row.status !== 'active' && row.status !== 'archived') ||
    !isRecord(row.payload)
  ) {
    return null;
  }
  return {
    id: row.id,
    scope: row.scope,
    owner_user_id: row.owner_user_id,
    world_profile_id: typeof row.world_profile_id === 'string' ? row.world_profile_id : null,
    status: row.status,
    payload: row.payload,
  };
}

async function canEditWorld(config: SupabaseConfig, userId: string, worldProfileId: string): Promise<boolean> {
  const response = await serviceFetch(
    config,
    `/rest/v1/world_profiles?select=id&id=eq.${encodeURIComponent(worldProfileId)}&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return false;
  const body: unknown = await response.json();
  return Array.isArray(body) && body.length > 0;
}

async function assertCanMutateDefinition(
  config: SupabaseConfig,
  userId: string,
  definition: DefinitionRow,
): Promise<void> {
  if (definition.status !== 'active') throw new Error('DEFINITION_ARCHIVED');
  if (definition.scope === 'personal') {
    if (definition.owner_user_id !== userId) throw new Error('FORBIDDEN');
    return;
  }
  if (!definition.world_profile_id) throw new Error('FORBIDDEN');
  const ok = await canEditWorld(config, userId, definition.world_profile_id);
  if (!ok) throw new Error('FORBIDDEN');
}

async function assertCanReadAsset(
  config: SupabaseConfig,
  userId: string,
  ownerUserId: string,
  worldProfileId: string | null,
): Promise<boolean> {
  if (ownerUserId === userId) return true;
  if (!worldProfileId) return false;
  // World read: owner of world profile (same helper as edit for V1; broader read later)
  return canEditWorld(config, userId, worldProfileId);
}

async function uploadToStorage(
  config: SupabaseConfig,
  path: string,
  bytes: Uint8Array,
  mime: ItemThumbnailMime,
): Promise<void> {
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': mime,
      'x-upsert': 'false',
    },
    body: payload,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status})`);
  }
}

async function createSignedUrl(config: SupabaseConfig, path: string): Promise<string> {
  const response = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Signed URL failed (${response.status})`);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.signedURL !== 'string') {
    throw new Error('Signed URL response invalid');
  }
  const signed = body.signedURL.startsWith('http')
    ? body.signedURL
    : `${config.url}/storage/v1${body.signedURL}`;
  return signed;
}

async function softDeleteStorage(config: SupabaseConfig, path: string): Promise<void> {
  await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [path] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

async function insertAsset(
  config: SupabaseConfig,
  row: {
    id: string;
    definitionId: string;
    ownerUserId: string;
    worldProfileId: string | null;
    mime: ItemThumbnailMime;
    byteSize: number;
    storagePath: string;
    origin: 'upload' | 'meshy';
    providerTaskId?: string;
  },
): Promise<void> {
  const response = await serviceFetch(config, '/rest/v1/item_thumbnail_assets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: row.id,
      kind: 'thumbnail2d',
      definition_id: row.definitionId,
      owner_user_id: row.ownerUserId,
      world_profile_id: row.worldProfileId,
      mime: row.mime,
      byte_size: row.byteSize,
      storage_path: row.storagePath,
      origin: row.origin,
      provider_task_id: row.providerTaskId ?? null,
    }),
  });
  if (!response.ok) throw new Error(`Asset insert failed (${response.status})`);
}

async function patchDefinitionAssetKey(
  config: SupabaseConfig,
  definition: DefinitionRow,
  assetKey: string | null,
): Promise<void> {
  const payload = { ...definition.payload };
  if (assetKey) payload.assetKey = assetKey;
  else delete payload.assetKey;

  const response = await serviceFetch(
    config,
    `/rest/v1/inventory_item_definitions?id=eq.${encodeURIComponent(definition.id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ payload }),
    },
  );
  if (!response.ok) throw new Error(`Definition assetKey update failed (${response.status})`);
}

serve(async (request: Request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return jsonResponse(request, { status: 'error', message: 'Method not allowed' }, 405);
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(request, { status: 'error', message: 'Request body too large' }, 413);
  }

  const config = getSupabaseConfig();
  if (!config) {
    return jsonResponse(request, {
      status: 'error',
      message: 'Thumbnail-Dienst ist nicht konfiguriert.',
    }, 503);
  }

  const userId = await authenticate(request, config);
  if (!userId) {
    return jsonResponse(request, { status: 'error', message: 'Authentication required' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { status: 'error', message: 'Invalid JSON body' }, 400);
  }
  const privilegedReject = privilegedClientBodyRejectionMessage(body);
  if (privilegedReject) {
    return jsonResponse(request, { status: 'error', message: privilegedReject }, 400);
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse(request, { status: 'error', message: 'action required' }, 400);
  }

  const action = body.action;

  try {
    if (action === 'config') {
      const meshyConfigured = await isMeshyConfiguredForUser(userId, {
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
      });
      return jsonResponse(request, {
        status: 'ok',
        meshyConfigured,
        maxBytes: 10 * 1024 * 1024,
        allowedMime: ['image/png', 'image/jpeg', 'image/webp'],
      });
    }

    if (action === 'upload') {
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

      const raw = decodeBase64Image(contentBase64);
      const { mime, bytes } = validateThumbnailBytes(raw, claimedMime);
      const assetId = crypto.randomUUID();
      const storagePath = buildItemThumbnailStoragePath({
        ownerUserId: userId,
        definitionId,
        worldProfileId: definition.world_profile_id,
        assetId,
        mime,
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

      const assetKey = buildItemThumbnailAssetKey(assetId);
      await patchDefinitionAssetKey(config, definition, assetKey);
      const signedUrl = await createSignedUrl(config, storagePath);

      return jsonResponse(request, {
        status: 'ok',
        assetId,
        assetKey,
        signedUrl,
        mime,
        byteSize: bytes.byteLength,
      });
    }

    if (action === 'generate') {
      const provider = await resolveProvider(userId, config);
      if (!provider) {
        return jsonResponse(request, {
          status: 'not-configured',
          message: 'Meshy ist nicht konfiguriert. Upload bleibt verfügbar.',
        }, 503);
      }

      const allowed = await consumeItemThumbnailRateLimit({
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

      let userExtra = '';
      try {
        userExtra = assertSafeUserExtra(body.userExtra);
      } catch {
        return jsonResponse(request, { status: 'error', message: 'Ungültiger Zusatzprompt' }, 400);
      }

      const payload = definition.payload;
      const prompt = buildItemThumbnailPrompt({
        name: typeof payload.name === 'string' ? payload.name : 'Item',
        description: typeof payload.description === 'string' ? payload.description : '',
        setting: Array.isArray(payload.settingTags)
          ? payload.settingTags.filter((t): t is string => typeof t === 'string').join(', ')
          : undefined,
        kindKey: typeof payload.kindKey === 'string' ? payload.kindKey : undefined,
        userExtra,
      });

      const jobId = crypto.randomUUID();
      let providerTaskId: string;
      try {
        const created = await provider.createTask(prompt);
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

      const insertJob = await serviceFetch(config, '/rest/v1/item_thumbnail_jobs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: jobId,
          definition_id: definitionId,
          owner_user_id: userId,
          world_profile_id: definition.world_profile_id,
          status: 'waiting',
          progress: 5,
          prompt,
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

    if (action === 'status') {
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      if (!jobId) {
        return jsonResponse(request, { status: 'error', message: 'jobId required' }, 400);
      }

      const jobRes = await serviceFetch(
        config,
        `/rest/v1/item_thumbnail_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
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
        let assetKey: string | undefined;
        if (typeof job.asset_id === 'string') {
          assetKey = buildItemThumbnailAssetKey(job.asset_id);
          const assetRes = await serviceFetch(
            config,
            `/rest/v1/item_thumbnail_assets?select=storage_path&id=eq.${encodeURIComponent(job.asset_id)}&limit=1`,
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
          assetKey,
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
      const mapped = mapMeshyStatusToJob(task.status);

      if (mapped.status === 'succeeded') {
        const definitionId = typeof job.definition_id === 'string' ? job.definition_id : '';
        const definition = await loadDefinition(config, definitionId);
        if (!definition || definition.status !== 'active') {
          await serviceFetch(
            config,
            `/rest/v1/item_thumbnail_jobs?id=eq.${encodeURIComponent(jobId)}`,
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

        const imageUrl = task.image_urls?.[0];
        if (!imageUrl) throw new Error('Meshy succeeded without image URL');

        const downloaded = await downloadMeshyImageBytes(imageUrl);
        // #647: profile-conform server optimize after AuthZ + SSRF fetch; never persist silent original.
        const optimized = await optimizeProviderThumbnailBytes(downloaded.bytes);
        if (!optimized.ok) {
          const errorMessage = providerOptimizeFailureMessage(optimized);
          console.error('[item-thumbnail] provider optimize failed', optimized.status, errorMessage);
          await serviceFetch(
            config,
            `/rest/v1/item_thumbnail_jobs?id=eq.${encodeURIComponent(jobId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'failed',
                progress: 0,
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          return jsonResponse(request, {
            status: 'ok',
            jobId,
            jobStatus: 'failed',
            progress: 0,
            errorMessage,
          });
        }
        const { mime, bytes } = optimized;
        const assetId = crypto.randomUUID();
        const storagePath = buildItemThumbnailStoragePath({
          ownerUserId: userId,
          definitionId,
          worldProfileId: definition.world_profile_id,
          assetId,
          mime,
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
          origin: 'meshy',
          providerTaskId: job.provider_task_id,
        });
        const assetKey = buildItemThumbnailAssetKey(assetId);
        await patchDefinitionAssetKey(config, definition, assetKey);
        await serviceFetch(
          config,
          `/rest/v1/item_thumbnail_jobs?id=eq.${encodeURIComponent(jobId)}`,
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
          assetKey,
          signedUrl,
        });
      }

      if (mapped.status === 'failed' || mapped.status === 'canceled') {
        const errorMessage = task.task_error?.message || 'Generierung fehlgeschlagen';
        await serviceFetch(
          config,
          `/rest/v1/item_thumbnail_jobs?id=eq.${encodeURIComponent(jobId)}`,
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
        `/rest/v1/item_thumbnail_jobs?id=eq.${encodeURIComponent(jobId)}`,
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

    if (action === 'resolve') {
      const assetKey = typeof body.assetKey === 'string' ? body.assetKey.trim() : '';
      const assetId = assetKey.startsWith('thumbnail2d:')
        ? assetKey.slice('thumbnail2d:'.length)
        : (typeof body.assetId === 'string' ? body.assetId.trim() : '');
      if (!assetId) {
        return jsonResponse(request, { status: 'error', message: 'assetKey required' }, 400);
      }
      const assetRes = await serviceFetch(
        config,
        `/rest/v1/item_thumbnail_assets?select=*&id=eq.${encodeURIComponent(assetId)}&deleted_at=is.null&limit=1`,
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
        assetKey: buildItemThumbnailAssetKey(assetId),
        signedUrl,
      });
    }

    if (action === 'remove') {
      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      if (!definitionId) {
        return jsonResponse(request, { status: 'error', message: 'definitionId required' }, 400);
      }
      const definition = await loadDefinition(config, definitionId);
      if (!definition) {
        return jsonResponse(request, { status: 'error', message: 'Definition not found' }, 404);
      }
      await assertCanMutateDefinition(config, userId, definition);

      const previousKey = typeof definition.payload.assetKey === 'string'
        ? definition.payload.assetKey
        : null;
      await patchDefinitionAssetKey(config, definition, null);

      if (previousKey?.startsWith('thumbnail2d:')) {
        const assetId = previousKey.slice('thumbnail2d:'.length);
        const assetRes = await serviceFetch(
          config,
          `/rest/v1/item_thumbnail_assets?select=id,storage_path,owner_user_id&id=eq.${encodeURIComponent(assetId)}&limit=1`,
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
            `/rest/v1/item_thumbnail_assets?id=eq.${encodeURIComponent(assetId)}`,
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

    if (action === 'latest-job') {
      const definitionId = typeof body.definitionId === 'string' ? body.definitionId.trim() : '';
      if (!definitionId) {
        return jsonResponse(request, { status: 'error', message: 'definitionId required' }, 400);
      }
      const jobRes = await serviceFetch(
        config,
        `/rest/v1/item_thumbnail_jobs?select=id,status,progress,error_message,asset_id,created_at&definition_id=eq.${encodeURIComponent(definitionId)}&owner_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`,
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
          assetKey: typeof job.asset_id === 'string'
            ? buildItemThumbnailAssetKey(job.asset_id)
            : undefined,
        },
      });
    }

    return jsonResponse(request, { status: 'error', message: 'Unknown action' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('item-thumbnail error:', message);
    if (message === 'FORBIDDEN' || message === 'DEFINITION_ARCHIVED') {
      return jsonResponse(request, {
        status: 'error',
        message: message === 'DEFINITION_ARCHIVED'
          ? 'Archivierte Definitionen können keine Thumbnails erhalten.'
          : 'Keine Berechtigung für diese Definition.',
      }, 403);
    }
    return jsonResponse(request, {
      status: 'error',
      message: 'Thumbnail-Aktion fehlgeschlagen. Bitte erneut versuchen.',
    }, 500);
  }
});
