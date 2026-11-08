/**
 * character-avatar-meshy Edge Function — provider-routed avatar 3D generation.
 * Meshy is the first adapter; settings come from SagaTree presets/capabilities.
 * Provider success does not set capabilities (#6). MESHY key never leaves the server.
 * Location: supabase/functions/character-avatar-meshy/index.ts
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  downloadMeshyGlbBytes,
  probeMeshyGlbContentLength,
  AVATAR_MESHY_GLB_MAX_BYTES,
  AVATAR_MESHY_GLB_SOFT_BYTES,
  AVATAR_MESHY_GLB_STORE_MAX_BYTES,
} from '../_shared/item-model3d-glb.ts';
import {
  isMeshyConfiguredForUser,
  resolveMeshyApiKeyForUser,
} from '../_shared/ai-provider-resolve-meshy.ts';
import {
  createLiveMeshyTextTo3dProvider,
  createMockMeshyTextTo3dProvider,
  mapMeshyTextTo3dStatusToJob,
  resolveMeshyTextTo3dConfig,
  type MeshyTextTo3dProvider,
  type MeshyTextTo3dTask,
} from '../_shared/avatar-meshy-text-to-3d.ts';
import {
  createLiveMeshyImageTo3dProvider,
  createMockMeshyImageTo3dProvider,
  resolveMeshyImageTo3dConfig,
  type MeshyImageTo3dProvider,
  type MeshyImageTo3dTask,
} from '../_shared/item-model3d-meshy.ts';
import {
  AVATAR_MESHY_REMESH_TARGET_POLYCOUNT,
  createLiveMeshyRemeshProvider,
  createMockMeshyRemeshProvider,
  type MeshyRemeshProvider,
} from '../_shared/avatar-meshy-remesh.ts';
import {
  createLiveMeshyRiggingProvider,
  createMockMeshyRiggingProvider,
  type MeshyRiggingProvider,
} from '../_shared/avatar-meshy-rigging.ts';
import { consumeAvatarMeshyRateLimit } from '../_shared/avatar-meshy-rate-limit.ts';
import {
  buildGenerationSettingsJson,
  DEFAULT_RECOMMENDED_SETTINGS,
  mapSettingsToMeshyImageTo3d,
  parsePresetMeta,
  parseProviderId,
  validateGenerationSettings,
  type Avatar3dGenerationSettings,
} from '../_shared/avatar-3d-generation.ts';
import {
  corsHeaders,
  handleOptions,
  jsonResponse as sharedJsonResponse,
  type CorsOptions,
} from '../_shared/cors.ts';
import { privilegedClientBodyRejectionMessage } from '../_shared/client-trust-body.ts';

type JsonRecord = Record<string, unknown>;
type GenerationMode = 'text' | 'image';

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['CHARACTER_AI_ALLOWED_ORIGIN'],
  allowLocalhostWhenConfigured: true,
  missingOriginPolicy: 'configured-or-star',
};

const BUCKET = 'character-avatars';
const RATE_LIMIT = 2;
const RATE_WINDOW_SECONDS = 60;
/** 7 days — shorter bearer window than annual URLs (refresh via poll). */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;
const IMAGE_PLACEHOLDER_PROMPT = 'Image-to-3D reference';
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicMeshyFailure =
  | 'generate'
  | 'remesh'
  | 'rig'
  | 'download'
  | 'store'
  | 'status'
  | 'unavailable'
  | 'no_model';

function publicMeshyFailure(kind: PublicMeshyFailure): string {
  switch (kind) {
    case 'generate':
      return 'Meshy-Generierung fehlgeschlagen.';
    case 'remesh':
      return 'Modell-Verkleinerung fehlgeschlagen.';
    case 'rig':
      return 'Auto-Rig fehlgeschlagen.';
    case 'download':
      return 'Modell-Download fehlgeschlagen.';
    case 'store':
      return 'Speichern des Modells fehlgeschlagen.';
    case 'status':
      return 'Meshy-Status konnte nicht geladen werden.';
    case 'unavailable':
      return 'Meshy nicht erreichbar.';
    case 'no_model':
      return 'Meshy lieferte keine Modell-URL.';
  }
}

async function resolveOwnedCharacterId(
  characterId: string | null,
  userId: string,
  supabaseUrl: string,
  serviceHeaders: Record<string, string>,
): Promise<string | null> {
  if (!characterId || !UUID_RE.test(characterId)) return null;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/characters?id=eq.${encodeURIComponent(characterId)}&owner_user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: serviceHeaders },
  );
  if (!res.ok) return null;
  const rows: unknown = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return characterId;
}

type AvatarMeshyTask = {
  status: string;
  progress: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

/**
 * Defense-in-depth: never sign/serve storage paths outside the caller's folder.
 * Blocks confused-deputy if a job row's storage_path was tampered via client RLS.
 */
function assertOwnerScopedStoragePath(userId: string, storagePath: string): string {
  const normalized = storagePath.trim().replace(/^\/+/, '');
  const prefix = `${userId}/`;
  if (
    !normalized
    || normalized.includes('..')
    || normalized.includes('\\')
    || !normalized.startsWith(prefix)
  ) {
    throw new Error('Ungültiger Storage-Pfad für diesen Account.');
  }
  return normalized;
}

function getCorsHeaders(request: Request): HeadersInit {
  return corsHeaders(request, CORS_OPTS);
}

function json(status: number, body: JsonRecord, request: Request): Response {
  return sharedJsonResponse(request, body, status, CORS_OPTS);
}

function validatePrompt(prompt: unknown): { ok: true; prompt: string } | { ok: false; message: string } {
  if (typeof prompt !== 'string') return { ok: false, message: 'Prompt fehlt.' };
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (normalized.length < 8) return { ok: false, message: 'Prompt zu kurz (min. 8 Zeichen).' };
  if (normalized.length > 500) return { ok: false, message: 'Prompt zu lang (max. 500 Zeichen).' };
  return { ok: true, prompt: normalized };
}

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

function jobRuntimePolycount(job: JsonRecord): number {
  const settings = isRecord(job.generation_settings) && isRecord(job.generation_settings.settings)
    ? job.generation_settings.settings
    : null;
  const runtime = settings && typeof settings.runtimePolycount === 'number'
    ? settings.runtimePolycount
    : null;
  if (typeof runtime === 'number' && Number.isFinite(runtime)) {
    return Math.max(10_000, Math.min(100_000, Math.round(runtime)));
  }
  return AVATAR_MESHY_REMESH_TARGET_POLYCOUNT;
}

function jobKeepMaster(job: JsonRecord): boolean {
  const settings = isRecord(job.generation_settings) && isRecord(job.generation_settings.settings)
    ? job.generation_settings.settings
    : null;
  return settings?.keepMaster === true;
}

/** Soft pipeline checkpoints in generation_settings.pipeline (no extra columns). */
function jobPipelineFlags(job: JsonRecord): JsonRecord {
  const gs = isRecord(job.generation_settings) ? job.generation_settings : null;
  return gs && isRecord(gs.pipeline) ? gs.pipeline : {};
}

function withPipelineFlag(job: JsonRecord, key: string, value: boolean): JsonRecord {
  const base = isRecord(job.generation_settings) ? { ...job.generation_settings } : {};
  const pipeline = isRecord(base.pipeline) ? { ...base.pipeline } : {};
  pipeline[key] = value;
  return { ...base, pipeline };
}

/** In-flight claim tokens so concurrent polls do not create duplicate paid Meshy tasks. */
const PIPELINE_CLAIM_PREFIX = 'claim:';

function isPipelineClaimId(id: string): boolean {
  return id.startsWith(PIPELINE_CLAIM_PREFIX);
}

function parseGenerationMode(value: unknown): GenerationMode {
  return value === 'image' ? 'image' : 'text';
}

function jobGenerationMode(job: JsonRecord): GenerationMode {
  return job.generation_mode === 'image' ? 'image' : 'text';
}

async function getUserId(request: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anonKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.id !== 'string') return null;
  return body.id;
}

function resolveTextProvider(apiKey: string | null): MeshyTextTo3dProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyTextTo3dProvider();
  }
  const config = resolveMeshyTextTo3dConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyTextTo3dProvider(config);
}

function resolveImageProvider(apiKey: string | null): MeshyImageTo3dProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyImageTo3dProvider();
  }
  const config = resolveMeshyImageTo3dConfig(Deno.env, apiKey);
  if (!config) return null;
  return createLiveMeshyImageTo3dProvider(config);
}

function resolveRemeshProvider(apiKey: string | null): MeshyRemeshProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyRemeshProvider();
  }
  if (!apiKey?.trim()) return null;
  const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim()
    || 'https://api.meshy.ai/openapi/v1';
  return createLiveMeshyRemeshProvider({ apiKey: apiKey.trim(), baseUrl });
}

function resolveRiggingProvider(apiKey: string | null): MeshyRiggingProvider | null {
  if (Deno.env.get('MESHY_AVATAR_USE_MOCK') === '1') {
    return createMockMeshyRiggingProvider();
  }
  if (!apiKey?.trim()) return null;
  const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim()
    || 'https://api.meshy.ai/openapi/v1';
  return createLiveMeshyRiggingProvider({ apiKey: apiKey.trim(), baseUrl });
}

function toAvatarTask(task: MeshyTextTo3dTask | MeshyImageTo3dTask): AvatarMeshyTask {
  return {
    status: task.status,
    progress: task.progress,
    model_urls: task.model_urls,
    task_error: task.task_error,
  };
}

async function fetchAvatarMeshyTask(
  mode: GenerationMode,
  apiKey: string | null,
  taskId: string,
): Promise<AvatarMeshyTask | null> {
  if (mode === 'image') {
    const provider = resolveImageProvider(apiKey);
    if (!provider) return null;
    return toAvatarTask(await provider.getTask(taskId));
  }
  const provider = resolveTextProvider(apiKey);
  if (!provider) return null;
  return toAvatarTask(await provider.getTask(taskId));
}

serve(async (request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return json(405, { status: 'error', message: 'Nur POST erlaubt.' }, request);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { status: 'error', message: 'Server-Konfiguration unvollständig.' }, request);
  }

  const userId = await getUserId(request, supabaseUrl, anonKey);
  if (!userId) {
    return json(401, { status: 'error', message: 'Anmeldung erforderlich.' }, request);
  }

  let payload: JsonRecord;
  try {
    const raw: unknown = await request.json();
    if (!isRecord(raw)) throw new Error('invalid');
    payload = raw;
  } catch {
    return json(400, { status: 'error', message: 'Ungültiger JSON-Body.' }, request);
  }

  const privilegedReject = privilegedClientBodyRejectionMessage(payload);
  if (privilegedReject) {
    return json(400, { status: 'error', message: privilegedReject }, request);
  }

  const action = typeof payload.action === 'string' ? payload.action : '';
  const serviceHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (action === 'config') {
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

  if (action === 'start') {
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

  if (action === 'poll' || action === 'retry') {
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

  return json(400, { status: 'error', message: 'Unbekannte action.' }, request);
});
