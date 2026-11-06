/**
 * item-model3d use-cases (MIG-409 / #825 → CUT-17 / #1152).
 * Location: server/src/application/item-model3d/index.ts
 *
 * Host HTTP activation via `/api/v1/items/model3d`. Edge remains allowlisted until dual-path removal.
 * When AssetPorts are wired, upload/resolve/status publish durable GLB bytes.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AssetPorts } from '../../assets/index.ts';
import { DEFAULT_ASSET_MAX_BYTES } from '../../assets/index.ts';
import {
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_FIXTURE_GLB,
  ITEM_MODEL3D_MAX_BYTES,
  ITEM_MODEL3D_MIME,
  assertDefinitionAuthorized,
  buildItemModel3dAssetKey,
  createItemModel3dStore,
  decodeStrictBase64,
  itemModel3dConfig,
  itemModel3dGenerate,
  itemModel3dLatestJob,
  itemModel3dRemove,
  itemModel3dResolve,
  itemModel3dStatus,
  itemModel3dUpload,
  validateItemModel3dGlbBytes,
  type ItemModel3dStore,
} from '../../modules/inventory/item-model3d.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

function actorIdsForAuthz(actor: Actor): readonly string[] {
  const primary = actorUserId(actor);
  if (!primary) return [];
  const linked =
    actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)
      ? actor.linkedSoloActorIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        )
      : [];
  return [...new Set([primary, ...linked])];
}

export type ItemModel3dUseCaseDeps = {
  readonly store?: ItemModel3dStore;
  readonly assets?: AssetPorts | null;
  readonly publicOrigin?: string;
  /** True only for ITEM_*_MESHY_MOCK — enables fixture generate materialize. */
  readonly meshyMockMode?: boolean;
  /** Env MESHY_API_KEY present (server-wide). */
  readonly meshyEnvConfigured?: boolean;
  /** Per-user BYOK Meshy credential lookup (Codex P1). */
  readonly resolveUserMeshyConfigured?: (actor: Actor) => boolean | Promise<boolean>;
  /** Persist model3d key onto inventory_item_definitions.payload (Codex P1). */
  readonly persistModel3dKey?: (
    actorIds: readonly string[],
    definitionId: string,
    model3d: string | null,
  ) => void;
};

function assetUrl(origin: string | undefined, assetId: string): string {
  const base = (origin ?? '').replace(/\/$/, '');
  if (!base) return `/api/v1/assets/${encodeURIComponent(assetId)}`;
  return `${base}/api/v1/assets/${encodeURIComponent(assetId)}`;
}

export function createItemModel3dUseCases(deps?: ItemModel3dUseCaseDeps | ItemModel3dStore) {
  const normalized: ItemModel3dUseCaseDeps =
    deps && typeof deps === 'object' && 'definitions' in deps
      ? { store: deps as ItemModel3dStore }
      : (deps as ItemModel3dUseCaseDeps | undefined) ?? {};

  const resolved = normalized.store ?? createItemModel3dStore();
  const assets = normalized.assets ?? null;
  const publicOrigin = normalized.publicOrigin;
  // Bare-store callers (mig-409) pass a configured store without mock flag — treat as mock.
  const meshyMockMode =
    normalized.meshyMockMode === true ||
    (normalized.meshyMockMode === undefined &&
      resolved.meshyConfigured === true &&
      normalized.meshyEnvConfigured !== true &&
      !normalized.resolveUserMeshyConfigured);
  const meshyEnvConfigured = normalized.meshyEnvConfigured === true;
  const resolveUserMeshy = normalized.resolveUserMeshyConfigured;
  const persistKey = normalized.persistModel3dKey;

  const publishGlb = (actor: Actor, bytes: Uint8Array) => {
    if (!assets) return { ok: false as const, error: 'store-unavailable' };
    if (bytes.byteLength > DEFAULT_ASSET_MAX_BYTES) {
      // Prefer elevated finalize when large-upload capability is on; else fail closed with 413.
      const elevated = assets.publishResumableFinalize(actor, {
        bytes,
        contentType: ITEM_MODEL3D_MIME,
      });
      if (elevated.ok) return elevated;
      if (elevated.error === 'capability-disabled' || elevated.error === 'bytes-too-large') {
        return { ok: false as const, error: 'bytes-too-large' };
      }
      return elevated;
    }
    return assets.publish(actor, { bytes, contentType: ITEM_MODEL3D_MIME });
  };

  async function meshyConfiguredFor(actor: Actor): Promise<boolean> {
    if (meshyMockMode || meshyEnvConfigured) return true;
    if (!resolveUserMeshy) return false;
    return Boolean(await resolveUserMeshy(actor));
  }

  function persist(actor: Actor, definitionId: string, model3d: string | null): void {
    if (!persistKey) return;
    persistKey(actorIdsForAuthz(actor), definitionId, model3d);
  }

  return {
    publicActivationAuthorized: ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
    store: resolved,
    config: async (actor: Actor) => {
      if (!actorUserId(actor)) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const configured = await meshyConfiguredFor(actor);
      const base = itemModel3dConfig(resolved);
      const maxBytes = assets
        ? Math.min(ITEM_MODEL3D_MAX_BYTES, DEFAULT_ASSET_MAX_BYTES)
        : ITEM_MODEL3D_MAX_BYTES;
      return {
        ...base,
        meshyConfigured: configured,
        maxBytes,
      };
    },
    upload: (
      actor: Actor,
      input: { definitionId: string; contentBase64: string; mime?: string },
    ) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const ids = actorIdsForAuthz(actor);
      let authorizedAs = userId;
      try {
        for (const id of ids) {
          try {
            assertDefinitionAuthorized(resolved, id, input.definitionId.trim());
            authorizedAs = id;
            break;
          } catch {
            // try next
          }
        }
        assertDefinitionAuthorized(resolved, authorizedAs, input.definitionId.trim());
      } catch (e) {
        return {
          status: 'error' as const,
          message: e instanceof Error ? e.message : 'upload failed',
          httpStatus: 403,
        };
      }

      if (!assets) {
        const uploaded = itemModel3dUpload(resolved, authorizedAs, input);
        if (uploaded.status === 'ok' && typeof uploaded.model3d === 'string') {
          persist(actor, input.definitionId.trim(), uploaded.model3d);
        }
        return uploaded;
      }

      try {
        const bytes = decodeStrictBase64(input.contentBase64);
        const validated = validateItemModel3dGlbBytes(bytes, input.mime);
        if (validated.bytes.byteLength > ITEM_MODEL3D_MAX_BYTES) {
          return { status: 'error' as const, message: 'GLB exceeds size limit', httpStatus: 413 };
        }
        const published = publishGlb(actor, validated.bytes);
        if (!published.ok) {
          const tooLarge = published.error === 'bytes-too-large';
          return {
            status: 'error' as const,
            message: tooLarge
              ? `GLB exceeds durable asset limit (${DEFAULT_ASSET_MAX_BYTES} bytes)`
              : published.error,
            httpStatus: tooLarge ? 413 : published.error === 'not-authorized' ? 403 : 500,
          };
        }
        const assetId = published.value.assetId;
        const model3d = buildItemModel3dAssetKey(assetId);
        const def = assertDefinitionAuthorized(
          resolved,
          authorizedAs,
          input.definitionId.trim(),
        );
        def.payload.model3d = model3d;
        resolved.assets.set(assetId, {
          id: assetId,
          ownerUserId: authorizedAs,
          definitionId: def.id,
          storagePath: `${authorizedAs}/${assetId}.glb`,
          deletedAt: null,
          byteSize: published.value.byteSize,
        });
        persist(actor, def.id, model3d);
        return {
          status: 'ok' as const,
          assetId,
          model3d,
          signedUrl: assetUrl(publicOrigin, assetId),
          mime: validated.mime,
          byteSize: published.value.byteSize,
        };
      } catch (e) {
        return {
          status: 'error' as const,
          message: e instanceof Error ? e.message : 'upload failed',
          httpStatus: 400,
        };
      }
    },
    generate: async (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const configured = await meshyConfiguredFor(actor);
      if (!configured) {
        return {
          status: 'not-configured' as const,
          message: 'Meshy is not configured',
          httpStatus: 503,
        };
      }
      // Codex P1: fixture materialize only in explicit mock mode — never for live BYOK/env key.
      if (!meshyMockMode) {
        return {
          status: 'not-configured' as const,
          message:
            'Live Meshy Image-to-3D host adapter is not enabled (set ITEM_MODEL3D_MESHY_MOCK=1 for isolated characterization).',
          httpStatus: 503,
        };
      }
      // Temporarily flip store flag so isolated generate path runs under mock.
      const prev = resolved.meshyConfigured;
      resolved.meshyConfigured = true;
      try {
        const ids = actorIdsForAuthz(actor);
        let authorizedAs = userId;
        for (const id of ids) {
          try {
            assertDefinitionAuthorized(resolved, id, definitionId.trim());
            authorizedAs = id;
            break;
          } catch {
            // continue
          }
        }
        return itemModel3dGenerate(resolved, authorizedAs, definitionId);
      } finally {
        resolved.meshyConfigured = prev;
      }
    },
    status: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const runStatus = (asUser: string) => {
        const result = itemModel3dStatus(resolved, asUser, jobId, claimerId);
        if (result.status !== 'ok' || !assets) {
          if (
            result.status === 'ok' &&
            typeof result.model3d === 'string' &&
            typeof jobId === 'string'
          ) {
            const job = resolved.jobs.get(jobId.trim());
            if (job?.definitionId) persist(actor, job.definitionId, result.model3d);
          }
          return result;
        }
        const job = resolved.jobs.get(jobId.trim());
        if (!job?.assetId) return result;
        const already = assets.get(actor, job.assetId);
        if (already.ok) {
          const model3d = buildItemModel3dAssetKey(job.assetId);
          persist(actor, job.definitionId, model3d);
          return {
            ...result,
            assetId: job.assetId,
            model3d,
            signedUrl: assetUrl(publicOrigin, job.assetId),
          };
        }
        if (!meshyMockMode) {
          return {
            status: 'error' as const,
            message: 'Provider model bytes unavailable without Meshy mock',
            httpStatus: 503,
          };
        }
        const bytes = job.providerModelBytes ?? ITEM_MODEL3D_FIXTURE_GLB;
        const published = publishGlb(actor, bytes);
        if (!published.ok) {
          return {
            status: 'error' as const,
            message: published.error,
            httpStatus: published.error === 'not-authorized' ? 403 : 500,
          };
        }
        const durableId = published.value.assetId;
        const prevId = job.assetId;
        job.assetId = durableId;
        resolved.assets.delete(prevId);
        resolved.assets.set(durableId, {
          id: durableId,
          ownerUserId: asUser,
          definitionId: job.definitionId,
          storagePath: `${asUser}/${durableId}.glb`,
          deletedAt: null,
          byteSize: published.value.byteSize,
        });
        const def = resolved.definitions.get(job.definitionId);
        const model3d = buildItemModel3dAssetKey(durableId);
        if (def) def.payload.model3d = model3d;
        persist(actor, job.definitionId, model3d);
        return {
          ...result,
          assetId: durableId,
          model3d,
          signedUrl: assetUrl(publicOrigin, durableId),
        };
      };

      const primary = runStatus(userId);
      if (primary.status === 'ok') return primary;
      if (primary.status === 'error' && (primary.httpStatus === 403 || primary.httpStatus === 404)) {
        for (const id of actorIdsForAuthz(actor)) {
          if (id === userId) continue;
          const alt = runStatus(id);
          if (alt.status === 'ok') return alt;
        }
      }
      return primary;
    },
    resolve: (actor: Actor, input: { model3d?: string; assetId?: string }) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const rawId =
        typeof input.assetId === 'string' && input.assetId.trim()
          ? input.assetId.trim()
          : typeof input.model3d === 'string' && input.model3d.startsWith('model3d:')
            ? input.model3d.slice('model3d:'.length)
            : '';
      if (assets && rawId) {
        const got = assets.get(actor, rawId);
        if (got.ok) {
          return {
            status: 'ok' as const,
            assetId: rawId,
            model3d: buildItemModel3dAssetKey(rawId),
            signedUrl: assetUrl(publicOrigin, rawId),
            mime: got.value.contentType,
            byteSize: got.value.byteSize,
          };
        }
      }
      for (const id of actorIdsForAuthz(actor)) {
        const alt = itemModel3dResolve(resolved, id, input);
        if (alt.status === 'ok') {
          if (assets && rawId) {
            return { ...alt, signedUrl: assetUrl(publicOrigin, rawId) };
          }
          return alt;
        }
      }
      return itemModel3dResolve(resolved, userId, input);
    },
    remove: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      for (const id of actorIdsForAuthz(actor)) {
        try {
          assertDefinitionAuthorized(resolved, id, definitionId.trim());
          const removed = itemModel3dRemove(resolved, id, definitionId);
          if (removed.status === 'ok') {
            persist(actor, definitionId.trim(), null);
          }
          // Durable AssetPorts bytes are not deleted — no revoke API on AssetPorts yet (Codex P2).
          return removed;
        } catch {
          // try next
        }
      }
      const removed = itemModel3dRemove(resolved, userId, definitionId);
      if (removed.status === 'ok') persist(actor, definitionId.trim(), null);
      return removed;
    },
    latestJob: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      for (const id of actorIdsForAuthz(actor)) {
        try {
          assertDefinitionAuthorized(resolved, id, definitionId.trim());
          return itemModel3dLatestJob(resolved, id, definitionId);
        } catch {
          // try next
        }
      }
      return itemModel3dLatestJob(resolved, userId, definitionId);
    },
  };
}

export type ItemModel3dUseCases = ReturnType<typeof createItemModel3dUseCases>;
