/**
 * Server-side session → Actor resolution for cookie profile (HTTP + WS).
 * Location: server/src/auth/session.ts
 */
import type { IncomingHttpHeaders } from 'node:http';
import type { HostBetterAuth } from './cookie-profile.ts';
import { detectForgedSoloIdentityClaims } from './solo/forged-identity.ts';

export type RemoteActor = {
  readonly kind: 'remote-account';
  readonly actorId: string;
  readonly sessionId: string;
  readonly email: string | null;
  /** Solo actor ids explicitly linked to this remote account (MIG-015). */
  readonly linkedSoloActorIds: readonly string[];
};

export type SessionResolveResult =
  | { ok: true; actor: RemoteActor }
  | {
      ok: false;
      code:
        | 'UNAUTHENTICATED'
        | 'HOST_DENIED'
        | 'ORIGIN_DENIED'
        | 'BEARER_FORBIDDEN'
        | 'SOLO_IDENTITY_FORBIDDEN';
    };

function headersFromNode(raw: IncomingHttpHeaders | Headers): Headers {
  if (raw instanceof Headers) return raw;
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export type SessionResolveOptions = {
  readonly auth: HostBetterAuth;
  readonly origin: string;
  readonly headers: IncomingHttpHeaders | Headers;
  /** Safe same-origin GETs may omit Origin; require Host + Sec-Fetch-Site. */
  readonly allowSameOriginRead?: boolean;
  /** Optional request body — scanned for forged localIdentity / solo claims. */
  readonly body?: unknown;
  /** Solo actor ids linked to the resolved remote user (from durable link store). */
  readonly linkedSoloActorIds?: readonly string[];
};

/**
 * Resolve the current Better Auth cookie session into a remote Actor.
 * Cookie profile rejects Authorization Bearer (fail closed — no JWT path).
 * Forged solo/local-identity headers never authorize (MIG-015 / GATE-02 common-7).
 */
export async function resolveCookieSession(
  options: SessionResolveOptions,
): Promise<SessionResolveResult> {
  const forged = detectForgedSoloIdentityClaims(options.headers, options.body);
  if (forged.forged) {
    return { ok: false, code: forged.code };
  }

  const headers = headersFromNode(options.headers);
  const expectedHost = new URL(options.origin).host;
  const host = headers.get('host');
  if (host && host !== expectedHost) {
    return { ok: false, code: 'HOST_DENIED' };
  }

  const originHeader = headers.get('origin');
  if (originHeader) {
    if (originHeader !== options.origin) {
      return { ok: false, code: 'ORIGIN_DENIED' };
    }
  } else if (options.allowSameOriginRead) {
    if (host !== expectedHost || headers.get('sec-fetch-site') !== 'same-origin') {
      return { ok: false, code: 'ORIGIN_DENIED' };
    }
  } else {
    return { ok: false, code: 'ORIGIN_DENIED' };
  }

  if (headers.get('authorization')) {
    return { ok: false, code: 'BEARER_FORBIDDEN' };
  }

  let found: Awaited<ReturnType<HostBetterAuth['api']['getSession']>>;
  try {
    found = await options.auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
  } catch {
    return { ok: false, code: 'UNAUTHENTICATED' };
  }

  if (!found?.session || !found?.user) {
    return { ok: false, code: 'UNAUTHENTICATED' };
  }
  if (new Date(found.session.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: 'UNAUTHENTICATED' };
  }

  return {
    ok: true,
    actor: {
      kind: 'remote-account',
      actorId: found.user.id,
      sessionId: found.session.id,
      email: typeof found.user.email === 'string' ? found.user.email : null,
      linkedSoloActorIds: options.linkedSoloActorIds ?? [],
    },
  };
}

/** Public whoami DTO — never includes session secrets. */
export function actorToWhoamiDto(actor: RemoteActor): {
  ok: true;
  actorId: string;
  kind: 'remote-account';
  email: string | null;
} {
  return {
    ok: true,
    actorId: actor.actorId,
    kind: 'remote-account',
    email: actor.email,
  };
}
