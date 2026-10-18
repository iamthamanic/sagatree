/**
 * Local Admin GoTrue JWT adopt/discard policy (pure).
 * Location: src/lib/localAdminAuthPolicy.ts
 *
 * The storage flag (`sagatree-local-admin-session`) is the durable intent signal.
 * Generation refs alone are not enough — HMR / React Strict remount clears them
 * while an in-flight `signInWithPassword` still completes and emits SIGNED_IN.
 *
 * Rules:
 * - Local Admin wanted + seeded admin JWT → adopt (never scrub).
 * - Another non-admin user is current → discard admin JWT (do not overwrite).
 * - Logged out (flag cleared) + seeded admin JWT → discard (anti-resurrection).
 */

export type LocalAdminJwtDecision = 'adopt' | 'discard' | 'ignore';

export type LocalAdminJwtContext = {
  /** `isLocalAdminSession()` — shortcut / offline Local Admin still wanted. */
  localAdminSessionActive: boolean;
  /** GoTrue (or listener) user is the seeded Local Admin identity. */
  sessionUserIsSeededAdmin: boolean;
  /** UI already shows a different authenticated user. */
  currentUserIsOther: boolean;
};

/**
 * Decide whether a Local Admin GoTrue session should be kept or scrubbed.
 */
export function decideLocalAdminJwt(ctx: LocalAdminJwtContext): LocalAdminJwtDecision {
  if (!ctx.sessionUserIsSeededAdmin) return 'ignore';
  if (ctx.currentUserIsOther) return 'discard';
  if (ctx.localAdminSessionActive) return 'adopt';
  return 'discard';
}

/**
 * Whether `discardStaleLocalAdminSession` may run.
 * While the Local Admin storage flag is set, scrubbing the JWT causes the
 * login-screen hang (token written then deleted within ~10ms).
 */
export function mayDiscardLocalAdminJwt(localAdminSessionActive: boolean): boolean {
  return !localAdminSessionActive;
}
