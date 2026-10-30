/**
 * character module public API — quarantine (MIG-406) + membership (#874) + sheet infra (#801).
 * Location: server/src/modules/character/index.ts
 *
 * Characters Edge worker remains unmounted. MIG-302 adds owner-scoped sheet CRUD /
 * presets / artifact path checks as isolated-contract ports (no HTTP activation).
 * Creator/VRM rendering utilities stay client-side under src/infrastructure/character.
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  CharacterMembershipStore,
  type CharacterMembershipCheck,
  type SeededPc,
} from './internal/character-membership-store.ts';
import {
  CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  CharacterSheetStore,
  assertCharacterOwnerStoragePath,
  type CharacterPresetRecord,
  type CharacterSheetDraft,
  type CharacterSheetRecord,
  type CharacterSheetResult,
} from './internal/character-sheet-store.ts';
import {
  CharacterInventoryColumnsStore,
  type CharacterInventoryColumnsRecord,
  type CharacterInventoryColumnsResult,
} from './internal/character-inventory-columns.ts';

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
export type {
  CharacterPresetRecord,
  CharacterSheetDraft,
  CharacterSheetRecord,
  CharacterSheetResult,
  CharacterInventoryColumnsRecord,
  CharacterInventoryColumnsResult,
};
export {
  CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  assertCharacterOwnerStoragePath,
};

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
  /** MIG-302 owner-scoped sheet CRUD (isolated-contract; no HTTP). */
  readonly listOwnedCharacters: (
    actorId: string,
  ) => CharacterSheetResult<readonly CharacterSheetRecord[]>;
  readonly getOwnedCharacter: (
    actorId: string,
    characterId: string,
  ) => CharacterSheetResult<CharacterSheetRecord | null>;
  readonly createOwnedCharacter: (
    actorId: string,
    draft: CharacterSheetDraft,
  ) => CharacterSheetResult<CharacterSheetRecord>;
  readonly updateOwnedCharacter: (
    actorId: string,
    characterId: string,
    draft: CharacterSheetDraft,
  ) => CharacterSheetResult<CharacterSheetRecord>;
  readonly deleteOwnedCharacter: (
    actorId: string,
    characterId: string,
  ) => CharacterSheetResult<{ readonly id: string }>;
  readonly listReadablePresets: (
    actorId: string,
  ) => CharacterSheetResult<readonly CharacterPresetRecord[]>;
  readonly resolveOwnedArtifact: (
    actorId: string,
    storagePath: string,
  ) => CharacterSheetResult<{ readonly storagePath: string; readonly characterId: string }>;
  readonly seedPublicPresetForTests: (input: {
    readonly slug: string;
    readonly displayName: string;
    readonly sheet?: Readonly<Record<string, unknown>>;
  }) => CharacterPresetRecord;
  readonly seedArtifactForTests: (input: {
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly storagePath: string;
  }) => CharacterSheetResult<{ readonly id: string }>;
  /** MIG-303: inventory module writes characters.inventory_* via this port only. */
  readonly getOwnedInventoryColumns: (
    actorId: string,
    characterId: string,
  ) => CharacterInventoryColumnsResult<CharacterInventoryColumnsRecord | null>;
  readonly putOwnedInventoryColumns: (
    actorId: string,
    characterId: string,
    inventoryJson: string,
    schemaVersion: number,
    updatedAt: string,
    revalidateUnderLock: () => CharacterInventoryColumnsResult<true>,
  ) => CharacterInventoryColumnsResult<CharacterInventoryColumnsRecord>;
};

function unavailableSheet<T>(): CharacterSheetResult<T> {
  return { ok: false, error: 'store-unavailable' };
}

function unavailableInventoryColumns<T>(): CharacterInventoryColumnsResult<T> {
  return { ok: false, error: 'store-unavailable' };
}

export function createCharacterPorts(db?: HostDatabase): CharacterPorts {
  if (!db) {
    return {
      moduleId: 'character',
      assertOwnedCompletePc: () => ({ ok: false, error: '42501' }),
      getDisplayName: () => null,
      seedPcForTests: () => {
        throw new Error('store-unavailable');
      },
      listOwnedCharacters: () => unavailableSheet(),
      getOwnedCharacter: () => unavailableSheet(),
      createOwnedCharacter: () => unavailableSheet(),
      updateOwnedCharacter: () => unavailableSheet(),
      deleteOwnedCharacter: () => unavailableSheet(),
      listReadablePresets: () => unavailableSheet(),
      resolveOwnedArtifact: () => unavailableSheet(),
      seedPublicPresetForTests: () => {
        throw new Error('store-unavailable');
      },
      seedArtifactForTests: () => unavailableSheet(),
      getOwnedInventoryColumns: () => unavailableInventoryColumns(),
      putOwnedInventoryColumns: () => unavailableInventoryColumns(),
    };
  }
  const membership = new CharacterMembershipStore(db);
  const sheets = new CharacterSheetStore(db);
  const inventoryColumns = new CharacterInventoryColumnsStore(db);
  return {
    moduleId: 'character',
    assertOwnedCompletePc: (ownerUserId, characterId) =>
      membership.assertOwnedCompletePc(ownerUserId, characterId),
    getDisplayName: (characterId) => membership.getDisplayName(characterId),
    seedPcForTests: (input) => membership.seedPcForTests(input),
    listOwnedCharacters: (actorId) => sheets.listOwned(actorId),
    getOwnedCharacter: (actorId, characterId) => sheets.getOwned(actorId, characterId),
    createOwnedCharacter: (actorId, draft) => sheets.createOwned(actorId, draft),
    updateOwnedCharacter: (actorId, characterId, draft) =>
      sheets.updateOwned(actorId, characterId, draft),
    deleteOwnedCharacter: (actorId, characterId) => sheets.deleteOwned(actorId, characterId),
    listReadablePresets: (actorId) => sheets.listReadablePresets(actorId),
    resolveOwnedArtifact: (actorId, storagePath) => sheets.resolveArtifact(actorId, storagePath),
    seedPublicPresetForTests: (input) => sheets.seedPublicPreset(input),
    seedArtifactForTests: (input) => sheets.seedArtifact(input),
    getOwnedInventoryColumns: (actorId, characterId) =>
      inventoryColumns.getOwned(actorId, characterId),
    putOwnedInventoryColumns: (
      actorId,
      characterId,
      inventoryJson,
      schemaVersion,
      updatedAt,
      revalidateUnderLock,
    ) =>
      inventoryColumns.putOwned(
        actorId,
        characterId,
        inventoryJson,
        schemaVersion,
        updatedAt,
        revalidateUnderLock,
      ),
  };
}

/** MIG-423 Edge spellbook Map quarantine — not a public host route. */
export {
  SPELLBOOK_EDGE_MAP_IS_DURABLE,
  SPELLBOOK_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  castQuarantineSpell,
  characterIdPathIsNotAuthority,
  createQuarantineSpell,
  createSpellbookEdgeQuarantineStore,
  describeSpellbookEdgeLegacyDefects,
  getQuarantineSpell,
  getQuarantineSpellbook,
  learnQuarantineSpell,
  listQuarantineSpells,
  prepareQuarantineSpell,
  restoreQuarantineSpellSlots,
  unprepareQuarantineSpell,
  type QuarantineCharacterSpellbook,
  type QuarantineSpell,
  type SpellbookEdgeQuarantineStore,
} from './internal/spellbook-edge-quarantine.ts';
