/**
 * character-avatar-meshy use-cases (MIG-404 / #820 → CUT-18 / #1153).
 * Location: server/src/application/character-avatar-meshy/index.ts
 *
 * Host HTTP activation via `/api/v1/ai/character-avatar-meshy`.
 * Edge remains allowlisted until dual-path removal. Mock Meshy advances
 * create→poll→durable AssetPorts GLB; live provider adapter is mock-gated.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AssetPorts } from '../../assets/index.ts';
import {
  CHARACTER_AVATAR_MESHY_FIXTURE_GLB,
  CHARACTER_AVATAR_MESHY_MIME,
  CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
  assertAvatarMeshyStoragePathOwner,
  claimAvatarMeshyRemesh,
  createCharacterAvatarMeshyStore,
  getAvatarMeshyConfig,
  getAvatarMeshyJob,
  markAvatarMeshyGenerationComplete,
  retryAvatarMeshyJob,
  startAvatarMeshyJob,
  type CharacterAvatarMeshyStore,
  type MeshyAvatarJob,
  type StartAvatarMeshyInput,
} from '../../modules/character/character-avatar-meshy.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export type CharacterAvatarMeshyUseCaseDeps = {
  readonly store?: CharacterAvatarMeshyStore;
  readonly assets?: AssetPorts | null;
  readonly publicOrigin?: string;
  /** True only for CHARACTER_AVATAR_MESHY_MOCK / ITEM_*_MESHY_MOCK — fixture materialize. */
  readonly meshyMockMode?: boolean;
  /** Env MESHY_API_KEY present (server-wide). */
  readonly meshyEnvConfigured?: boolean;
  /** Per-user BYOK Meshy credential lookup. */
  readonly resolveUserMeshyConfigured?: (actor: Actor) => boolean | Promise<boolean>;
};

function assetUrl(origin: string | undefined, assetId: string): string {
  const base = (origin ?? '').replace(/\/$/, '');
  if (!base) return `/api/v1/assets/${encodeURIComponent(assetId)}`;
  return `${base}/api/v1/assets/${encodeURIComponent(assetId)}`;
}

/** Edge-shaped job row for FE mapJob (snake_case). */
function toEdgeJob(job: MeshyAvatarJob, extra?: { assetId?: string }) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    prompt: job.prompt,
    generation_mode: job.generationMode,
    idempotency_key: job.idempotencyKey,
    error_message: job.status === 'provider_unavailable' ? 'Meshy nicht erreichbar.' : undefined,
    storage_path: job.storagePath,
    rig_analysis_status: 'pending',
    ...(extra?.assetId ? { asset_id: extra.assetId } : {}),
  };
}

type HttpOk = { status: 'ok'; httpStatus?: number; [key: string]: unknown };
type HttpFail = {
  status: 'error' | 'not-configured';
  message: string;
  httpStatus?: number;
  code?: string;
};
export type CharacterAvatarMeshyHttpResult = HttpOk | HttpFail;

export function createCharacterAvatarMeshyUseCases(
  deps?: CharacterAvatarMeshyUseCaseDeps | CharacterAvatarMeshyStore,
) {
  const normalized: CharacterAvatarMeshyUseCaseDeps =
    deps && typeof deps === 'object' && 'jobs' in deps
      ? { store: deps as CharacterAvatarMeshyStore }
      : ((deps as CharacterAvatarMeshyUseCaseDeps | undefined) ?? {});

  const resolved = normalized.store ?? createCharacterAvatarMeshyStore();
  const assets = normalized.assets ?? null;
  const publicOrigin = normalized.publicOrigin;
  const meshyMockMode =
    normalized.meshyMockMode === true ||
    (normalized.meshyMockMode === undefined &&
      resolved.meshyConfigured === true &&
      normalized.meshyEnvConfigured !== true &&
      !normalized.resolveUserMeshyConfigured);
  const meshyEnvConfigured = normalized.meshyEnvConfigured === true;
  const resolveUserMeshy = normalized.resolveUserMeshyConfigured;

  /** jobId → published asset id (durable mock artifact). */
  const publishedAssets = new Map<string, string>();

  async function meshyConfiguredFor(actor: Actor): Promise<boolean> {
    if (meshyMockMode || meshyEnvConfigured) return true;
    if (!resolveUserMeshy) return false;
    return Boolean(await resolveUserMeshy(actor));
  }

  function materializeSucceeded(actor: Actor, job: MeshyAvatarJob): {
    job: MeshyAvatarJob;
    modelUrl?: string;
    assetId?: string;
  } {
    if (!meshyMockMode) {
      return { job };
    }
    const existing = publishedAssets.get(job.id);
    if (existing) {
      return {
        job,
        assetId: existing,
        modelUrl: assetUrl(publicOrigin, existing),
      };
    }
    if (!assets) {
      job.status = 'succeeded';
      job.progress = 100;
      return { job };
    }
    const published = assets.publish(actor, {
      bytes: CHARACTER_AVATAR_MESHY_FIXTURE_GLB,
      contentType: CHARACTER_AVATAR_MESHY_MIME,
    });
    if (!published.ok) {
      job.status = 'failed';
      job.progress = Math.max(job.progress, 90);
      return { job };
    }
    publishedAssets.set(job.id, published.value.assetId);
    job.status = 'succeeded';
    job.progress = 100;
    job.storagePath = `${job.ownerUserId}/avatars/${job.id}.glb`;
    return {
      job,
      assetId: published.value.assetId,
      modelUrl: assetUrl(publicOrigin, published.value.assetId),
    };
  }

  function advanceMockPoll(actor: Actor, job: MeshyAvatarJob, claimerId: string) {
    if (!meshyMockMode) {
      return { job, modelUrl: undefined as string | undefined, assetId: undefined as string | undefined };
    }
    if (job.status === 'succeeded') {
      return materializeSucceeded(actor, job);
    }
    if (job.status === 'generating' || job.status === 'queued') {
      if (!job.generationComplete) {
        markAvatarMeshyGenerationComplete(resolved, job.ownerUserId, job.id);
      }
      claimAvatarMeshyRemesh(resolved, job.ownerUserId, job.id, claimerId);
      return materializeSucceeded(actor, job);
    }
    if (job.status === 'remeshing' || job.status === 'rigging') {
      return materializeSucceeded(actor, job);
    }
    return { job, modelUrl: undefined, assetId: undefined };
  }

  return {
    publicActivationAuthorized: CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
    store: resolved,

    /**
     * Isolated-contract port API (mig-404). Sync Actor → MeshyAvatarPortsResult.
     * Host routes use http* methods below.
     */
    config: () => getAvatarMeshyConfig(resolved),
    start: (actor: Actor, input: Omit<StartAvatarMeshyInput, 'ownerUserId'>) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return startAvatarMeshyJob(resolved, { ...input, ownerUserId });
    },
    poll: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return claimAvatarMeshyRemesh(resolved, ownerUserId, jobId, claimerId);
    },
    get: (actor: Actor, jobId: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return getAvatarMeshyJob(resolved, ownerUserId, jobId);
    },
    retry: (actor: Actor, jobId: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return retryAvatarMeshyJob(resolved, ownerUserId, jobId);
    },
    signStoragePath: (actor: Actor, storagePath: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return assertAvatarMeshyStoragePathOwner(ownerUserId, storagePath);
    },

    httpConfig: async (actor: Actor): Promise<CharacterAvatarMeshyHttpResult> => {
      if (!actorUserId(actor)) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const configured = await meshyConfiguredFor(actor);
      const prev = resolved.meshyConfigured;
      resolved.meshyConfigured = configured;
      try {
        const base = getAvatarMeshyConfig(resolved);
        return {
          status: 'ok',
          meshyConfigured: configured,
          promptMinChars: base.promptMinChars,
          promptMaxChars: base.promptMaxChars,
          imageMaxBytes: base.imageMaxBytes,
          supportsImageTo3d: true,
          defaultProviderId: 'meshy',
          defaultPresetId: 'recommended',
          wiredProviderIds: ['meshy'],
          costHintDe:
            'Externe KI. Provider + Preset steuern Qualität. Advanced-Einstellungen sind optional. Kein automatischer Paid-Retry.',
        };
      } finally {
        resolved.meshyConfigured = prev;
      }
    },

    httpStart: async (
      actor: Actor,
      input: {
        clientNonce?: unknown;
        generationMode?: unknown;
        prompt?: unknown;
        imageDataUri?: unknown;
        texturePrompt?: unknown;
        providerId?: unknown;
        settings?: unknown;
      },
    ): Promise<CharacterAvatarMeshyHttpResult> => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const configured = await meshyConfiguredFor(actor);
      if (!configured) {
        return {
          status: 'not-configured',
          message: 'Meshy ist nicht konfiguriert. Bitte API-Key unter KI-Anbieter hinterlegen.',
          httpStatus: 503,
        };
      }
      if (!meshyMockMode) {
        return {
          status: 'not-configured',
          message:
            'Live Meshy Avatar host adapter is not enabled (set CHARACTER_AVATAR_MESHY_MOCK=1 for isolated characterization).',
          httpStatus: 503,
        };
      }
      const prev = resolved.meshyConfigured;
      resolved.meshyConfigured = true;
      try {
        const started = startAvatarMeshyJob(resolved, {
          ownerUserId,
          clientNonce: input.clientNonce,
          generationMode: input.generationMode,
          prompt: input.prompt,
          imageDataUri: input.imageDataUri,
          texturePrompt: input.texturePrompt,
          providerId: input.providerId,
          settings: input.settings,
        });
        if (!started.ok) {
          if (started.code === 'not_configured') {
            return {
              status: 'not-configured',
              message: 'Meshy ist nicht konfiguriert. Bitte API-Key unter KI-Anbieter hinterlegen.',
              httpStatus: 503,
            };
          }
          const httpStatus =
            started.status === 429 ? 429 : started.status === 401 ? 401 : 400;
          return {
            status: 'error',
            message:
              started.code === 'rate_limited'
                ? 'Zu viele Anfragen. Bitte später erneut versuchen.'
                : started.error,
            httpStatus,
            code: started.code,
          };
        }
        return {
          status: 'ok',
          job: toEdgeJob(started.value),
          replayed: started.replayed === true,
        };
      } finally {
        resolved.meshyConfigured = prev;
      }
    },

    httpPoll: async (
      actor: Actor,
      jobId: string,
      claimerId = 'poller',
    ): Promise<CharacterAvatarMeshyHttpResult> => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const got = getAvatarMeshyJob(resolved, ownerUserId, jobId.trim());
      if (!got.ok) {
        return {
          status: 'error',
          message: 'Job nicht gefunden.',
          httpStatus: got.status === 404 ? 404 : 400,
          code: got.code,
        };
      }
      const advanced = advanceMockPoll(actor, got.value, claimerId);
      return {
        status: 'ok',
        job: toEdgeJob(advanced.job, { assetId: advanced.assetId }),
        ...(advanced.modelUrl ? { modelUrl: advanced.modelUrl } : {}),
      };
    },

    httpGet: async (actor: Actor, jobId: string): Promise<CharacterAvatarMeshyHttpResult> => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const got = getAvatarMeshyJob(resolved, ownerUserId, jobId.trim());
      if (!got.ok) {
        return {
          status: 'error',
          message: 'Job nicht gefunden.',
          httpStatus: 404,
          code: got.code,
        };
      }
      const assetId = publishedAssets.get(got.value.id);
      return {
        status: 'ok',
        job: toEdgeJob(got.value, { assetId }),
        ...(assetId ? { modelUrl: assetUrl(publicOrigin, assetId) } : {}),
      };
    },

    httpRetry: async (actor: Actor, jobId: string): Promise<CharacterAvatarMeshyHttpResult> => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const configured = await meshyConfiguredFor(actor);
      if (!configured) {
        return {
          status: 'not-configured',
          message: 'Meshy ist nicht konfiguriert.',
          httpStatus: 503,
        };
      }
      if (!meshyMockMode) {
        return {
          status: 'not-configured',
          message:
            'Live Meshy Avatar host adapter is not enabled (set CHARACTER_AVATAR_MESHY_MOCK=1 for isolated characterization).',
          httpStatus: 503,
        };
      }
      const retried = retryAvatarMeshyJob(resolved, ownerUserId, jobId.trim());
      if (!retried.ok) {
        return {
          status: 'error',
          message:
            retried.error === 'retry only failed/provider_unavailable'
              ? 'Retry nur nach Fehler.'
              : retried.error,
          httpStatus: retried.status === 404 ? 404 : 400,
          code: retried.code,
        };
      }
      return {
        status: 'ok',
        job: toEdgeJob(retried.value.job),
        resumedWithoutPaidCreate: retried.value.resumedWithoutPaidCreate,
      };
    },

    httpSignStoragePath: (actor: Actor, storagePath: string): CharacterAvatarMeshyHttpResult => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { status: 'error', message: 'Nicht angemeldet.', httpStatus: 401, code: 'auth' };
      }
      const checked = assertAvatarMeshyStoragePathOwner(ownerUserId, storagePath);
      if (!checked.ok) {
        return {
          status: 'error',
          message: 'Pfad nicht erlaubt.',
          httpStatus: 403,
          code: checked.code,
        };
      }
      return { status: 'ok', storagePath: storagePath.trim() };
    },
  };
}

export type CharacterAvatarMeshyUseCases = ReturnType<typeof createCharacterAvatarMeshyUseCases>;
