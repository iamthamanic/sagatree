/**
 * item-model3d use-cases (MIG-409 / #825).
 * Location: server/src/application/item-model3d/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  createItemModel3dStore,
  itemModel3dConfig,
  itemModel3dGenerate,
  itemModel3dLatestJob,
  itemModel3dRemove,
  itemModel3dResolve,
  itemModel3dStatus,
  itemModel3dUpload,
  type ItemModel3dStore,
} from '../../modules/inventory/index.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export function createItemModel3dUseCases(
  store: ItemModel3dStore = createItemModel3dStore(),
) {
  return {
    publicActivationAuthorized: ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    config: (actor: Actor) => {
      if (!actorUserId(actor)) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dConfig(store);
    },
    upload: (
      actor: Actor,
      input: { definitionId: string; contentBase64: string; mime?: string },
    ) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dUpload(store, userId, input);
    },
    generate: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dGenerate(store, userId, definitionId);
    },
    status: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dStatus(store, userId, jobId, claimerId);
    },
    resolve: (actor: Actor, input: { model3d?: string; assetId?: string }) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dResolve(store, userId, input);
    },
    remove: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dRemove(store, userId, definitionId);
    },
    latestJob: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemModel3dLatestJob(store, userId, definitionId);
    },
  };
}

export type ItemModel3dUseCases = ReturnType<typeof createItemModel3dUseCases>;
