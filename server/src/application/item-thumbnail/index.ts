/**
 * item-thumbnail use-cases (MIG-410 / #826).
 * Location: server/src/application/item-thumbnail/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
  createItemThumbnailStore,
  itemThumbnailConfig,
  itemThumbnailGenerate,
  itemThumbnailLatestJob,
  itemThumbnailRemove,
  itemThumbnailResolve,
  itemThumbnailStatus,
  itemThumbnailUpload,
  type ItemThumbnailStore,
} from '../../modules/inventory/item-thumbnail.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export function createItemThumbnailUseCases(
  store: ItemThumbnailStore = createItemThumbnailStore(),
) {
  return {
    publicActivationAuthorized: ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    config: (actor: Actor) => {
      if (!actorUserId(actor)) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailConfig(store);
    },
    upload: (
      actor: Actor,
      input: { definitionId: string; contentBase64: string; mime?: string },
    ) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailUpload(store, userId, input);
    },
    generate: (actor: Actor, definitionId: string, userExtra?: unknown) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailGenerate(store, userId, definitionId, userExtra);
    },
    status: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailStatus(store, userId, jobId, claimerId);
    },
    resolve: (actor: Actor, input: { assetKey?: string; assetId?: string }) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailResolve(store, userId, input);
    },
    remove: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailRemove(store, userId, definitionId);
    },
    latestJob: (actor: Actor, definitionId: string) => {
      const userId = actorUserId(actor);
      if (!userId) {
        return { status: 'error' as const, message: 'Authentication required', httpStatus: 401 };
      }
      return itemThumbnailLatestJob(store, userId, definitionId);
    },
  };
}

export type ItemThumbnailUseCases = ReturnType<typeof createItemThumbnailUseCases>;
