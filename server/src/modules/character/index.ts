/**
 * character module public API — quarantine surface for MIG-406 (#822).
 * Location: server/src/modules/character/index.ts
 *
 * Characters Edge worker remains unmounted. Exports characterization helpers
 * for isolated tests only — never an HTTP port factory.
 */
export {
  CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED,
  addExperienceLegacyUnsafe,
  applyCharacterUpdate,
  calculateProficiencyBonus,
  createCharacterRecord,
  describeNonAdvancingXpLoopDefect,
  getXpThreshold,
  resolveLevelUpTargetId,
  type QuarantineCharacter,
} from './internal/characters-quarantine.ts';
