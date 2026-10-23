/**
 * identity module public API — solo + remote Better Auth actors (MIG-014/015).
 * Location: server/src/modules/identity/index.ts
 */
import type { IncomingHttpHeaders } from 'node:http';
import type { HostBetterAuth } from '../../auth/cookie-profile.ts';
import {
  resolveCookieSession,
  type RemoteActor,
  type SessionResolveResult,
} from '../../auth/session.ts';
import {
  detectForgedSoloIdentityClaims,
  loadLinkedSoloActorIds,
  linkSoloAccount,
  type LinkSoloAccountResult,
} from '../../auth/solo/index.ts';

export type SoloActor = { readonly kind: 'solo-local'; readonly actorId: string };

export type Actor = SoloActor | RemoteActor;

/** Mutable holder filled by bootstrap after async Better Auth init. */
export type AuthRuntimeHolder = {
  auth: HostBetterAuth | null;
  origin: string | null;
  /** Normalized trusted origins for Origin allowlisting + CORS. */
  trustedOrigins: readonly string[];
};

export type IdentityPorts = {
  readonly resolveSoloActor: () => SoloActor;
  /**
   * Resolve remote cookie session into an Actor. Returns AUTH_NOT_CONFIGURED
   * when the cookie profile is not mounted. Failures are typed codes only.
   * Forged solo/local-identity claims fail closed (MIG-015).
   */
  readonly resolveRemoteSession: (
    headers: IncomingHttpHeaders | Headers,
    options?: { allowSameOriginRead?: boolean; body?: unknown },
  ) => Promise<SessionResolveResult | { ok: false; code: 'AUTH_NOT_CONFIGURED' }>;
  /**
   * Explicit solo→remote account link. Never auto-elevates; requires confirm
   * and matching host solo actorId.
   */
  readonly linkSoloToRemoteAccount: (input: {
    claimedSoloActorId: string;
    remoteAccountId: string;
    confirm: boolean;
  }) => LinkSoloAccountResult;
};

export function createIdentityPorts(
  soloActorId: string,
  authRuntime: AuthRuntimeHolder = { auth: null, origin: null, trustedOrigins: [] },
  dataDir: string = '',
): IdentityPorts {
  return {
    resolveSoloActor: () => ({ kind: 'solo-local', actorId: soloActorId }),
    async resolveRemoteSession(headers, options = {}) {
      const forged = detectForgedSoloIdentityClaims(headers, options.body);
      if (forged.forged) {
        return { ok: false, code: forged.code };
      }
      if (!authRuntime.auth || !authRuntime.origin) {
        return { ok: false, code: 'AUTH_NOT_CONFIGURED' };
      }
      // Probe session first without links so we know the remote user id.
      const resolved = await resolveCookieSession({
        auth: authRuntime.auth,
        origin: authRuntime.origin,
        trustedOrigins: authRuntime.trustedOrigins,
        headers,
        allowSameOriginRead: options.allowSameOriginRead === true,
        body: options.body,
      });
      if (!resolved.ok) return resolved;
      const linkedSoloActorIds = dataDir
        ? loadLinkedSoloActorIds(dataDir, resolved.actor.actorId)
        : [];
      return {
        ok: true,
        actor: {
          ...resolved.actor,
          linkedSoloActorIds,
        },
      };
    },
    linkSoloToRemoteAccount(input) {
      return linkSoloAccount({
        dataDir,
        expectedHostSoloActorId: soloActorId,
        claimedSoloActorId: input.claimedSoloActorId,
        remoteAccountId: input.remoteAccountId,
        confirm: input.confirm,
      });
    },
  };
}

export type { RemoteActor, SessionResolveResult, LinkSoloAccountResult };
