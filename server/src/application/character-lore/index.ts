/**
 * character-lore use-cases (MIG-405 / #821).
 * Location: server/src/application/character-lore/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
  createCharacterLoreStore,
  generateCharacterLoreBackground,
  type CharacterLoreGenerateDeps,
  type CharacterLoreGenerateResult,
  type CharacterLoreStore,
} from '../../modules/character/character-lore.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export type CharacterLoreUseCaseDeps = Omit<CharacterLoreGenerateDeps, 'store'> & {
  readonly store?: CharacterLoreStore;
};

export function createCharacterLoreUseCases(deps: CharacterLoreUseCaseDeps) {
  const store = deps.store ?? createCharacterLoreStore();
  const generateDeps: CharacterLoreGenerateDeps = { ...deps, store };

  return {
    publicActivationAuthorized: CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    generate: async (
      actor: Actor,
      input: {
        readonly contentLengthHeader: string | null;
        readonly rawBodyUtf8Bytes?: number;
        readonly body: unknown;
      },
    ): Promise<CharacterLoreGenerateResult> => {
      const userId = actorUserId(actor);
      if (!userId) {
        return {
          status: 'error',
          message: 'Authentication required',
          httpStatus: 401,
        };
      }
      return generateCharacterLoreBackground(generateDeps, {
        userId,
        contentLengthHeader: input.contentLengthHeader,
        rawBodyUtf8Bytes: input.rawBodyUtf8Bytes,
        body: input.body,
      });
    },
  };
}

export type CharacterLoreUseCases = ReturnType<typeof createCharacterLoreUseCases>;
