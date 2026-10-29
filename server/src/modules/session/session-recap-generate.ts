/**
 * Slim public entry for session-recap Edge generate ports (MIG-421 / #837).
 * Location: server/src/modules/session/session-recap-generate.ts
 *
 * Application imports this file — not the session module barrel — to avoid
 * pulling unrelated runtime/lifecycle re-exports.
 */
export {
  SESSION_RECAP_DEFAULT_RATE_LIMIT,
  SESSION_RECAP_MAX_RATE_LIMIT,
  SESSION_RECAP_MAX_REQUEST_BYTES,
  SESSION_RECAP_MAX_SUMMARY_LENGTH,
  SESSION_RECAP_PROMPT_VERSION,
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  SESSION_RECAP_RATE_WINDOW_SECONDS,
  buildSessionRecapPrompt,
  checkSessionRecapBodySize,
  consumeSessionRecapRateLimit,
  createSessionRecapGenerateStore,
  deriveAdventureSnapshotFromWorldState,
  describeSessionRecapLegacyDefects,
  filterSpoilerSafeHighlightLines,
  generateSessionRecap,
  isSessionRecapUuid,
  parseHighlightLines,
  resolveSessionRecapProviderConfig,
  resolveSessionRecapRateLimit,
  seedSessionRecapMember,
  seedSessionRecapProject,
  seedSessionRecapRow,
  seedSessionRecapSession,
  sessionRecapErrorContainsSecrets,
  stripSessionRecapSecrets,
  type SessionRecapGenerateDeps,
  type SessionRecapGenerateInput,
  type SessionRecapGenerateResult,
  type SessionRecapGenerateStore,
  type SessionRecapProjectRow,
  type SessionRecapPrompt,
  type SessionRecapPromptLine,
  type SessionRecapProviderConfig,
  type SessionRecapProviderName,
  type SessionRecapRow,
  type SessionRecapSessionRow,
} from './internal/session-recap-generate.ts';
