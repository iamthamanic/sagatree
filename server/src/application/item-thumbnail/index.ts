/**
 * item-thumbnail use-cases (MIG-410 / #826 → CUT-16 / #1151).
 * Location: server/src/application/item-thumbnail/index.ts
 *
 * Host HTTP activation via `/api/v1/items/thumbnail`. Edge remains allowlisted until dual-path removal.
 * When AssetPorts are wired, upload/resolve/generate publish durable bytes (Codex P1).
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AssetPorts } from '../../assets/index.ts';
import {
  ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
  assertItemThumbnailDefinitionAuthorized,
  buildItemThumbnailAssetKey,
  createItemThumbnailStore,
  decodeStrictBase64Image,
  itemThumbnailConfig,
  itemThumbnailGenerate,
  itemThumbnailLatestJob,
  itemThumbnailRemove,
  itemThumbnailResolve,
  itemThumbnailStatus,
  itemThumbnailUpload,
  validateItemThumbnailBytes,
  type ItemThumbnailStore,
} from '../../modules/inventory/item-thumbnail.ts';

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

export type ItemThumbnailUseCaseDeps = {
  readonly store?: ItemThumbnailStore;
  /** Durable byte store — required for activated host path (CUT-16). */
  readonly assets?: AssetPorts | null;
  /** Origin used to build same-host asset URLs (e.g. http://127.0.0.1:PORT). */
  readonly publicOrigin?: string;
};

function assetUrl(origin: string | undefined, assetId: string): string {
  const base = (origin ?? '').replace(/\/$/, '');
  if (!base) return `/api/v1/assets/${encodeURIComponent(assetId)}`;
  return `${base}/api/v1/assets/${encodeURIComponent(assetId)}`;
}

export function createItemThumbnailUseCases(deps?: ItemThumbnailUseCaseDeps | ItemThumbnailStore) {
  // Back-compat: mig-410 passes a bare store.
  const normalized: ItemThumbnailUseCaseDeps =
    deps && typeof deps === 'object' && 'definitions' in deps
      ? { store: deps }
      : (deps as ItemThumbnailUseCaseDeps | undefined) ?? {};

  const resolved =
    normalized.store ??
    createItemThumbnailStore(true, {
      assetBaseUrl: process.env.MESHY_ASSET_BASE_URL?.trim(),
    });
  const assets = normalized.assets ?? null;
  const publicOrigin = normalized.publicOrigin;

  return {
    publicActivationAuthorized: ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
    store: resolved,
    config: (actor: Actor) => {
      if (!actorUserId(actor)) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailConfig(resolved);
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
      // Authorize via any linked id that owns the definition.
      let authorizedAs = userId;
      try {
        for (const id of ids) {
          try {
            assertItemThumbnailDefinitionAuthorized(resolved, id, input.definitionId.trim());
            authorizedAs = id;
            break;
          } catch {
            // try next linked id
          }
        }
        assertItemThumbnailDefinitionAuthorized(resolved, authorizedAs, input.definitionId.trim());
      } catch (e) {
        return {
          status: 'error' as const,
          message: e instanceof Error ? e.message : 'upload failed',
          httpStatus: 403,
        };
      }

      if (!assets) {
        // Isolated-contract / tests without AssetPorts — characterization path.
        return itemThumbnailUpload(resolved, authorizedAs, input);
      }

      try {
        const bytes = decodeStrictBase64Image(input.contentBase64);
        const validated = validateItemThumbnailBytes(bytes, input.mime);
        const published = assets.publish(actor, {
          bytes: validated.bytes,
          contentType: validated.mime,
        });
        if (!published.ok) {
          return {
            status: 'error' as const,
            message: published.error,
            httpStatus: published.error === 'not-authorized' ? 403 : 500,
          };
        }
        const assetId = published.value.assetId;
        const assetKey = buildItemThumbnailAssetKey(assetId);
        const def = assertItemThumbnailDefinitionAuthorized(
          resolved,
          authorizedAs,
          input.definitionId.trim(),
        );
        def.payload.assetKey = assetKey;
        resolved.assets.set(assetId, {
          id: assetId,
          ownerUserId: authorizedAs,
          definitionId: def.id,
          storagePath: `${authorizedAs}/${assetId}`,
          deletedAt: null,
          byteSize: published.value.byteSize,
          mime: validated.mime,
        });
        return {
          status: 'ok' as const,
          assetId,
          assetKey,
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
    generate: (actor: Actor, definitionId: string, userExtra?: unknown) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const ids = actorIdsForAuthz(actor);
      let authorizedAs = userId;
      for (const id of ids) {
        try {
          assertItemThumbnailDefinitionAuthorized(resolved, id, definitionId.trim());
          authorizedAs = id;
          break;
        } catch {
          // continue
        }
      }
      return itemThumbnailGenerate(resolved, authorizedAs, definitionId, userExtra);
    },
    status: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const runStatus = (asUser: string) => {
        const result = itemThumbnailStatus(resolved, asUser, jobId, claimerId);
        if (result.status !== 'ok' || !assets) return result;
        const job = resolved.jobs.get(jobId.trim());
        if (!job?.assetId) return result;
        const already = assets.get(actor, job.assetId);
        if (already.ok) {
          return {
            ...result,
            assetId: job.assetId,
            assetKey: buildItemThumbnailAssetKey(job.assetId),
            signedUrl: assetUrl(publicOrigin, job.assetId),
          };
        }
        if (!job.providerImageBytes || job.providerImageBytes.byteLength === 0) {
          return result;
        }
        // Durable publish of materialized provider bytes (Codex P1).
        const published = assets.publish(actor, {
          bytes: job.providerImageBytes,
          contentType: 'image/png',
        });
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
          storagePath: `${asUser}/${durableId}`,
          deletedAt: null,
          byteSize: published.value.byteSize,
          mime: 'image/png',
        });
        const def = resolved.definitions.get(job.definitionId);
        if (def) def.payload.assetKey = buildItemThumbnailAssetKey(durableId);
        return {
          ...result,
          assetId: durableId,
          assetKey: buildItemThumbnailAssetKey(durableId),
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
    resolve: (actor: Actor, input: { assetKey?: string; assetId?: string }) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const rawId =
        typeof input.assetId === 'string' && input.assetId.trim()
          ? input.assetId.trim()
          : typeof input.assetKey === 'string' && input.assetKey.startsWith('thumbnail2d:')
            ? input.assetKey.slice('thumbnail2d:'.length)
            : '';
      if (assets && rawId) {
        const got = assets.get(actor, rawId);
        if (got.ok) {
          return {
            status: 'ok' as const,
            assetId: rawId,
            assetKey: buildItemThumbnailAssetKey(rawId),
            signedUrl: assetUrl(publicOrigin, rawId),
            mime: got.value.contentType,
            byteSize: got.value.byteSize,
          };
        }
      }
      for (const id of actorIdsForAuthz(actor)) {
        const alt = itemThumbnailResolve(resolved, id, input);
        if (alt.status === 'ok') {
          if (assets && rawId) {
            return { ...alt, signedUrl: assetUrl(publicOrigin, rawId) };
          }
          return alt;
        }
      }
      return itemThumbnailResolve(resolved, userId, input);
    },
    remove: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      for (const id of actorIdsForAuthz(actor)) {
        try {
          assertItemThumbnailDefinitionAuthorized(resolved, id, definitionId.trim());
          return itemThumbnailRemove(resolved, id, definitionId);
        } catch {
          // try next
        }
      }
      return itemThumbnailRemove(resolved, userId, definitionId);
    },
    latestJob: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      for (const id of actorIdsForAuthz(actor)) {
        try {
          assertItemThumbnailDefinitionAuthorized(resolved, id, definitionId.trim());
          return itemThumbnailLatestJob(resolved, id, definitionId);
        } catch {
          // try next
        }
      }
      return itemThumbnailLatestJob(resolved, userId, definitionId);
    },
  };
}

export type ItemThumbnailUseCases = ReturnType<typeof createItemThumbnailUseCases>;
