/**
 * Host auth public surface — Better Auth cookie profile (GATE-02 Variant A).
 * Location: server/src/auth/index.ts
 *
 * Composition root and identity module consume this barrel. Do not import
 * cookie-profile / wrap-auth-handler internals from product modules.
 */
export {
  createCookieAuthProfile,
  validateCookieAuthConfig,
  assertCookieAuthSecret,
  generateAuthSecret,
  type CookieAuthProfileConfig,
  type HostBetterAuth,
} from './cookie-profile.ts';
export {
  wrapCookieAuthHandler,
  stripSessionBearerFields,
  type NodeAuthHandler,
} from './wrap-auth-handler.ts';
export {
  resolveCookieSession,
  actorToWhoamiDto,
  type RemoteActor,
  type SessionResolveResult,
} from './session.ts';
export { attachSessionWebSocket, randomSecWebSocketKey } from './ws-session.ts';
export {
  ensureSoloIdentityFile,
  hostIdentityPath,
  isSoloActorId,
  detectForgedSoloIdentityClaims,
  linkSoloAccount,
  loadLinkedSoloActorIds,
  assertSoloLoopbackBind,
  isLoopbackHost,
  SOLO_REQUIRES_LOOPBACK,
  HOST_IDENTITY_FILENAME,
  SOLO_ACCOUNT_LINKS_FILENAME,
  type SoloIdentityLoadResult,
  type LinkSoloAccountResult,
  type SoloAccountLink,
  type ForgedSoloIdentityResult,
} from './solo/index.ts';
