/**
 * Solo / loopback auth boundary (MIG-015) — public barrel.
 * Location: server/src/auth/solo/index.ts
 *
 * Persistent local identity without privilege transfer to remote/GM sessions.
 */
export {
  ensureSoloIdentityFile,
  hostIdentityPath,
  isSoloActorId,
  HOST_IDENTITY_FILENAME,
  type SoloIdentityLoadResult,
} from './identity-file.ts';
export {
  detectForgedSoloIdentityClaims,
  type ForgedSoloIdentityResult,
} from './forged-identity.ts';
export {
  linkSoloAccount,
  loadLinkedSoloActorIds,
  soloAccountLinksPath,
  SOLO_ACCOUNT_LINKS_FILENAME,
  type LinkSoloAccountResult,
  type SoloAccountLink,
} from './account-link.ts';
export {
  assertSoloLoopbackBind,
  isLoopbackHost,
  SOLO_REQUIRES_LOOPBACK,
} from './bind-guard.ts';
