/**
 * character-avatar-meshy use-cases (MIG-404 / #820).
 * Location: server/src/application/character-avatar-meshy/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
  assertAvatarMeshyStoragePathOwner,
  claimAvatarMeshyRemesh,
  createCharacterAvatarMeshyStore,
  getAvatarMeshyConfig,
  getAvatarMeshyJob,
  retryAvatarMeshyJob,
  startAvatarMeshyJob,
  type CharacterAvatarMeshyStore,
  type StartAvatarMeshyInput,
} from '../../modules/character/character-avatar-meshy.ts';

function actorUserId(actor: Actor): string | null {
  return actor?.actorId ? actor.actorId : null;
}

export function createCharacterAvatarMeshyUseCases(
  store: CharacterAvatarMeshyStore = createCharacterAvatarMeshyStore(),
) {
  return {
    publicActivationAuthorized: CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    config: () => getAvatarMeshyConfig(store),
    start: (actor: Actor, input: Omit<StartAvatarMeshyInput, 'ownerUserId'>) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return startAvatarMeshyJob(store, { ...input, ownerUserId });
    },
    poll: (actor: Actor, jobId: string, claimerId = 'poller') => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return claimAvatarMeshyRemesh(store, ownerUserId, jobId, claimerId);
    },
    get: (actor: Actor, jobId: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return getAvatarMeshyJob(store, ownerUserId, jobId);
    },
    retry: (actor: Actor, jobId: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return retryAvatarMeshyJob(store, ownerUserId, jobId);
    },
    signStoragePath: (actor: Actor, storagePath: string) => {
      const ownerUserId = actorUserId(actor);
      if (!ownerUserId) {
        return { ok: false as const, status: 401, error: 'unauthenticated', code: 'auth' };
      }
      return assertAvatarMeshyStoragePathOwner(ownerUserId, storagePath);
    },
  };
}

export type CharacterAvatarMeshyUseCases = ReturnType<typeof createCharacterAvatarMeshyUseCases>;
