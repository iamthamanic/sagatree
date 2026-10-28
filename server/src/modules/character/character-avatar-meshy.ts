/**
 * Slim public entry for character-avatar-meshy ports (MIG-404 / #820).
 * Location: server/src/modules/character/character-avatar-meshy.ts
 *
 * Application imports this file — not the character module barrel — to avoid
 * pulling unrelated quarantine/membership re-exports.
 */
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
  describeAvatarMeshyConfigLegacyDefect,
  describeAvatarMeshyIdempotencyLegacyDefect,
  describeAvatarMeshyStartOrderingLegacyDefect,
  getAvatarMeshyConfig,
  getAvatarMeshyJob,
  isAllowedAvatarMeshyGlbUrl,
  markAvatarMeshyGenerationComplete,
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
