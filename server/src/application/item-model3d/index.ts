/**
 * item-model3d use-cases (MIG-409 / #825 → CUT-17 / #1152).
 * Location: server/src/application/item-model3d/index.ts
 *
 * Host HTTP activation via `/api/v1/items/model3d`. Edge remains allowlisted until dual-path removal.
 * When AssetPorts are wired, upload/resolve/status publish durable GLB bytes.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AssetPorts } from '../../assets/index.ts';
import {
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_FIXTURE_GLB,
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

  return {
    publicActivationAuthorized: ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
    store: resolved,
    config: (actor: Actor) => {
      if (!actorUserId(actor)) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dConfig(resolved);
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
        return itemModel3dUpload(resolved, authorizedAs, input);
      }

      try {
        const bytes = decodeStrictBase64(input.contentBase64);
        const validated = validateItemModel3dGlbBytes(bytes, input.mime);
        const published = assets.publish(actor, {
          bytes: validated.bytes,
          contentType: ITEM_MODEL3D_MIME,
        });
        if (!published.ok) {
          return {
            status: 'error' as const,
            message: published.error,
            httpStatus: published.error === 'not-authorized' ? 403 : 500,
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
    generate: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
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
    },
    status: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      const runStatus = (asUser: string) => {
        const result = itemModel3dStatus(resolved, asUser, jobId, claimerId);
        if (result.status !== 'ok' || !assets) return result;
        const job = resolved.jobs.get(jobId.trim());
        if (!job?.assetId) return result;
        const already = assets.get(actor, job.assetId);
        if (already.ok) {
          return {
            ...result,
            assetId: job.assetId,
            model3d: buildItemModel3dAssetKey(job.assetId),
            signedUrl: assetUrl(publicOrigin, job.assetId),
          };
        }
        const bytes = job.providerModelBytes ?? ITEM_MODEL3D_FIXTURE_GLB;
        const published = assets.publish(actor, {
          bytes,
          contentType: ITEM_MODEL3D_MIME,
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
          storagePath: `${asUser}/${durableId}.glb`,
          deletedAt: null,
          byteSize: published.value.byteSize,
        });
        const def = resolved.definitions.get(job.definitionId);
        if (def) def.payload.model3d = buildItemModel3dAssetKey(durableId);
        return {
          ...result,
          assetId: durableId,
          model3d: buildItemModel3dAssetKey(durableId),
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
          return itemModel3dRemove(resolved, id, definitionId);
        } catch {
          // try next
        }
      }
      return itemModel3dRemove(resolved, userId, definitionId);
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
