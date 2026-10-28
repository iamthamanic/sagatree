/**
 * Slim public entry for character-lore ports (MIG-405 / #821).
 * Location: server/src/modules/character/character-lore.ts
 *
 * Application imports this file — not the character module barrel — to avoid
 * pulling unrelated quarantine/membership re-exports.
 */
export {
  CHARACTER_LORE_DEFAULT_RATE_LIMIT,
  CHARACTER_LORE_MAX_RATE_LIMIT,
  CHARACTER_LORE_MAX_REQUEST_BYTES,
  CHARACTER_LORE_MAX_STORY_LENGTH,
  CHARACTER_LORE_PROMPT_VERSION,
  CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
  CHARACTER_LORE_RATE_WINDOW_SECONDS,
  buildCharacterLorePrompt,
  canUseWorldLoreReference,
  characterLoreMinimalContext,
  checkCharacterLoreBodySize,
  consumeCharacterLoreRateLimit,
  createCharacterLoreStore,
  describeCharacterLoreAuthDenialLegacyDefect,
  errorPayloadContainsSecrets,
  generateCharacterLoreBackground,
  getAuthorizedReferenceContext,
  isCharacterLoreUuid,
  parseCharacterLoreRequestBody,
  resolveCharacterLoreProviderConfig,
  resolveCharacterLoreRateLimit,
  stripCharacterLoreSecrets,
  type CharacterLoreGenerateDeps,
  type CharacterLoreGenerateResult,
  type CharacterLoreParsedRequest,
  type CharacterLoreProjectRow,
  type CharacterLorePrompt,
  type CharacterLorePromptContext,
  type CharacterLoreProviderConfig,
  type CharacterLoreReferenceContext,
  type CharacterLoreReferencePorts,
  type CharacterLoreStore,
  type CharacterLoreWorldRow,
} from './internal/character-lore.ts';
