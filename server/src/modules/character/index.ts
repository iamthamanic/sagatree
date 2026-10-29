/**
 * character module public API — quarantine (MIG-406) + membership PC port (#874).
 * Location: server/src/modules/character/index.ts
 *
 * Characters Edge worker remains unmounted. Durable `characters` rows are owned here
 * for project-membership ownership checks only — not a full character CRUD surface.
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  CharacterMembershipStore,
  type CharacterMembershipCheck,
  type SeededPc,
} from './internal/character-membership-store.ts';

export {
  CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED,
  addExperienceLegacyUnsafe,
  applyCharacterUpdate,
  calculateProficiencyBonus,
  createCharacterRecord,
  describeNonAdvancingXpLoopDefect,
  getXpThreshold,
  mergeNestedPartial,
  resolveLevelUpTargetId,
  type QuarantineCharacter,
} from './internal/characters-quarantine.ts';

export {
  CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
  MESHY_AVATAR_IMAGE_MAX_BYTES,
  MESHY_AVATAR_PROMPT_MAX,
  MESHY_AVATAR_PROMPT_MIN,
  MESHY_AVATAR_RATE_LIMIT,
  MESHY_AVATAR_RATE_WINDOW_SECONDS,
  assertAvatarMeshyStoragePathOwner,
  buildAvatarMeshyIdempotencyKey,
  claimAvatarMeshyRemesh,
  consumeAvatarMeshyQuota,
  createCharacterAvatarMeshyStore,
  markAvatarMeshyGenerationComplete,
  describeAvatarMeshyConfigLegacyDefect,
  describeAvatarMeshyIdempotencyLegacyDefect,
  describeAvatarMeshyStartOrderingLegacyDefect,
  getAvatarMeshyConfig,
  getAvatarMeshyJob,
  isAllowedAvatarMeshyGlbUrl,
  retryAvatarMeshyJob,
  startAvatarMeshyJob,
  validateAvatarMeshyImageDataUri,
  validateAvatarMeshyNonce,
  validateAvatarMeshyProvider,
  validateAvatarMeshySettings,
  validateAvatarMeshyTextPrompt,
  type CharacterAvatarMeshyStore,
  type MeshyAvatarJob,
  type StartAvatarMeshyInput,
} from './internal/character-avatar-meshy.ts';

export {
  CHARACTER_LORE_DEFAULT_RATE_LIMIT,
  CHARACTER_LORE_MAX_REQUEST_BYTES,
  CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
  CHARACTER_LORE_RATE_WINDOW_SECONDS,
  canUseWorldLoreReference,
  createCharacterLoreStore,
  describeCharacterLoreAuthDenialLegacyDefect,
  generateCharacterLoreBackground,
  parseCharacterLoreRequestBody,
  type CharacterLoreStore,
} from './internal/character-lore.ts';

export type { CharacterMembershipCheck, SeededPc };

export type CharacterPorts = {
  readonly moduleId: 'character';
  readonly assertOwnedCompletePc: (
    ownerUserId: string,
    characterId: string,
  ) => CharacterMembershipCheck;
  /** Display name for projections (ensemble); null when missing. */
  readonly getDisplayName: (characterId: string) => string | null;
  /** Test / fixture helper — not a product HTTP API. */
  readonly seedPcForTests: (input: {
    readonly ownerUserId: string;
    readonly name?: string;
    readonly sheetStatus?: 'complete' | 'incomplete' | 'draft';
    readonly id?: string;
  }) => SeededPc;
};

export function createCharacterPorts(db?: HostDatabase): CharacterPorts {
  if (!db) {
    return {
      moduleId: 'character',
      assertOwnedCompletePc: () => ({ ok: false, error: '42501' }),
      getDisplayName: () => null,
      seedPcForTests: () => {
        throw new Error('store-unavailable');
      },
    };
  }
  const store = new CharacterMembershipStore(db);
  return {
    moduleId: 'character',
    assertOwnedCompletePc: (ownerUserId, characterId) =>
      store.assertOwnedCompletePc(ownerUserId, characterId),
    getDisplayName: (characterId) => store.getDisplayName(characterId),
    seedPcForTests: (input) => store.seedPcForTests(input),
  };
}
