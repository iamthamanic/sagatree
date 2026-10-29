/**
 * Slim public entry for session-media-token ports (MIG-420 / #836).
 * Location: server/src/modules/session/session-media-token.ts
 *
 * Application imports this file — not the session module barrel — to avoid
 * pulling unrelated runtime/lifecycle re-exports.
 */
export {
  SESSION_MEDIA_TOKEN_DEFAULT_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_MAX_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_MIN_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  clampSessionMediaTtlSeconds,
  createSessionMediaTokenStore,
  deriveMediaRoomId,
  describeSessionMediaTokenLegacyDefects,
  issueSessionMediaToken,
  memberKey,
  mintLiveKitAccessToken,
  resolveSessionMediaGrant,
  seedSessionMediaTokenMember,
  seedSessionMediaTokenSession,
  sessionMediaTokenErrorContainsSecrets,
  verifyLiveKitAccessToken,
  type SessionMediaGrant,
  type SessionMediaRole,
  type SessionMediaTokenError,
  type SessionMediaTokenIssueInput,
  type SessionMediaTokenLiveKitConfig,
  type SessionMediaTokenMemberRow,
  type SessionMediaTokenResult,
  type SessionMediaTokenSessionPlayerRow,
  type SessionMediaTokenSessionRow,
  type SessionMediaTokenStore,
  type SessionMediaTokenSuccess,
  type VerifiedLiveKitClaims,
} from './internal/session-media-token.ts';
