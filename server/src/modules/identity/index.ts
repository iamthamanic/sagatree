/**
 * identity module public API — solo + remote Better Auth actors (MIG-014).
 * Location: server/src/modules/identity/index.ts
 */
import type { IncomingHttpHeaders } from 'node:http';
import type { HostBetterAuth } from '../../auth/cookie-profile.ts';
import {
  resolveCookieSession,
  type RemoteActor,
  type SessionResolveResult,
} from '../../auth/session.ts';

export type SoloActor = { readonly kind: 'solo-local'; readonly actorId: string };

export type Actor = SoloActor | RemoteActor;

/** Mutable holder filled by bootstrap after async Better Auth init. */
export type AuthRuntimeHolder = {
  auth: HostBetterAuth | null;
  origin: string | null;
};

export type IdentityPorts = {
  readonly resolveSoloActor: () => SoloActor;
  /**
   * Resolve remote cookie session into an Actor. Returns AUTH_NOT_CONFIGURED
   * when the cookie profile is not mounted. Failures are typed codes only.
   */
  readonly resolveRemoteSession: (
    headers: IncomingHttpHeaders | Headers,
    options?: { allowSameOriginRead?: boolean },
  ) => Promise<SessionResolveResult | { ok: false; code: 'AUTH_NOT_CONFIGURED' }>;
};

export function createIdentityPorts(
  soloActorId: string,
  authRuntime: AuthRuntimeHolder = { auth: null, origin: null },
): IdentityPorts {
  return {
    resolveSoloActor: () => ({ kind: 'solo-local', actorId: soloActorId }),
    async resolveRemoteSession(headers, options = {}) {
      if (!authRuntime.auth || !authRuntime.origin) {
        return { ok: false, code: 'AUTH_NOT_CONFIGURED' };
      }
      return resolveCookieSession({
        auth: authRuntime.auth,
        origin: authRuntime.origin,
        headers,
        allowSameOriginRead: options.allowSameOriginRead === true,
      });
    },
  };
}

export type { RemoteActor, SessionResolveResult };
