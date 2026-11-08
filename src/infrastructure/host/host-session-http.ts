/**
 * host-session-http — Browser session cutover client (credentials cookie / solo host).
 * Location: src/infrastructure/host/host-session-http.ts
 *
 * Same gate as Library: `isHostLibraryEnabled()` (host-first when auth URL set).
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { isHostLibraryEnabled } from './host-library-http';

export { isHostLibraryEnabled };

type EnvLike = {
  readonly VITE_SAGATREE_HOST_AUTH_URL?: string;
  readonly VITE_SAGATREE_HOST_LIBRARY?: string;
};

function defaultEnv(): EnvLike {
  try {
    return (import.meta as ImportMeta & { env?: EnvLike }).env ?? {};
  } catch {
    return {};
  }
}

async function hostGetJson<T>(
  path: string,
  unreachableMessage: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error(unreachableMessage);
  let response: Response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(unreachableMessage);
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body) {
        detail = String((body as { error: unknown }).error);
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail ? `${unreachableMessage}: ${detail}` : unreachableMessage);
  }
  return (await response.json()) as T;
}

async function hostMutateJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  unreachableMessage: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error(unreachableMessage);
  let response: Response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(unreachableMessage);
  }
  if (!response.ok) {
    let detail = '';
    try {
      const errBody: unknown = await response.json();
      if (errBody && typeof errBody === 'object' && 'error' in errBody) {
        detail = String((errBody as { error: unknown }).error);
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail ? `${unreachableMessage}: ${detail}` : unreachableMessage);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type HostPlaySessionDto = {
  readonly sessionId: string;
  readonly projectId: string;
  readonly publicId?: string;
  readonly joinCode?: string | null;
  readonly code?: string | null;
  readonly status: string;
  readonly sessionNumber?: number;
  readonly name?: string | null;
  readonly createdAt?: string;
  readonly startedAt?: string | null;
  readonly endedAt?: string | null;
  readonly gmUserId?: string;
  /** Session Look override; null/omit = inherit project default. */
  readonly lookProfileId?: string | null;
  readonly players?: readonly {
    readonly id?: string;
    readonly userId?: string;
    readonly characterId?: string | null;
    readonly isOnline?: boolean;
    readonly joinedAt?: string;
  }[];
};

export async function fetchHostSessions(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly HostPlaySessionDto[]> {
  const body = await hostGetJson<{ sessions?: HostPlaySessionDto[] }>(
    '/api/v1/sessions',
    'Host-Sessionliste nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.sessions) ? body.sessions : [];
}

export async function fetchHostSession(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPlaySessionDto> {
  const body = await hostGetJson<{ session?: HostPlaySessionDto }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    'Host-Session nicht gefunden',
    env,
    fetchImpl,
  );
  if (!body.session?.sessionId) {
    throw new Error('Host-Session nicht gefunden');
  }
  return body.session;
}

export async function createHostPlaySession(
  projectId: string,
  name: string | null | undefined,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPlaySessionDto> {
  const body = await hostMutateJson<{ session?: HostPlaySessionDto }>(
    '/api/v1/sessions',
    'POST',
    { projectId, name: name ?? null },
    'Host-Session konnte nicht erstellt werden',
    env,
    fetchImpl,
  );
  if (!body.session?.sessionId) {
    throw new Error('Host-Session konnte nicht erstellt werden');
  }
  return body.session;
}

export async function joinHostSessionByCode(
  code: string,
  characterId: string | null | undefined,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPlaySessionDto> {
  const body = await hostMutateJson<{ session?: HostPlaySessionDto }>(
    '/api/v1/sessions/join',
    'POST',
    { code, characterId: characterId ?? null },
    'Host-Session Beitritt fehlgeschlagen',
    env,
    fetchImpl,
  );
  if (!body.session?.sessionId) {
    throw new Error('Session nicht gefunden');
  }
  return body.session;
}

export async function setHostSessionStatus(
  sessionId: string,
  status: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPlaySessionDto> {
  const body = await hostMutateJson<{ session?: HostPlaySessionDto }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/status`,
    'POST',
    { status },
    'Host-Session-Status konnte nicht gesetzt werden',
    env,
    fetchImpl,
  );
  if (!body.session?.sessionId) {
    throw new Error('Host-Session-Status konnte nicht gesetzt werden');
  }
  return body.session;
}

export async function leaveHostPlaySession(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/leave`,
    'POST',
    {},
    'Host-Session verlassen fehlgeschlagen',
    env,
    fetchImpl,
  );
}

/** CUT-04 — GM deletes play session via host product HTTP. */
export async function deleteHostPlaySession(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    'DELETE',
    {},
    'Host-Session löschen fehlgeschlagen',
    env,
    fetchImpl,
  );
}

export async function fetchHostSessionRuntime(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  return hostGetJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/runtime`,
    'Host-Runtime-Snapshot fehlgeschlagen',
    env,
    fetchImpl,
  );
}

export async function applyHostSessionRuntimeCommand(
  input: {
    readonly sessionId: string;
    readonly expectedRevision: number;
    readonly kind: string;
    readonly payload?: Record<string, unknown>;
    readonly idempotencyKey?: string | null;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  return hostMutateJson(
    `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/runtime/commands`,
    'POST',
    {
      expectedRevision: input.expectedRevision,
      kind: input.kind,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey ?? null,
    },
    'Host-Runtime-Befehl fehlgeschlagen',
    env,
    fetchImpl,
  );
}

export async function setHostSessionPresence(
  sessionId: string,
  isOnline: boolean,
  expectedRevision: number | null | undefined,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  return hostMutateJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/runtime/presence`,
    'POST',
    {
      isOnline,
      expectedRevision: expectedRevision ?? 0,
    },
    'Host-Presence-Update fehlgeschlagen',
    env,
    fetchImpl,
  );
}

export async function createHostSessionInvite(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  const body = await hostMutateJson<{ invite?: Record<string, unknown> }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/invites`,
    'POST',
    {},
    'Host-Einladung konnte nicht erstellt werden',
    env,
    fetchImpl,
  );
  if (!body.invite) {
    throw new Error('Host-Einladung konnte nicht erstellt werden');
  }
  return body.invite;
}

export async function resolveHostSessionInvite(
  token: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  const body = await hostMutateJson<{ invite?: Record<string, unknown> }>(
    '/api/v1/sessions/invites/resolve',
    'POST',
    { token },
    'Host-Einladung konnte nicht gelesen werden',
    env,
    fetchImpl,
  );
  if (!body.invite) {
    throw new Error('Host-Einladung konnte nicht gelesen werden');
  }
  return body.invite;
}

export async function revokeHostSessionInvite(
  token: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    '/api/v1/sessions/invites/revoke',
    'POST',
    { token },
    'Host-Einladung konnte nicht widerrufen werden',
    env,
    fetchImpl,
  );
}

export async function fetchHostSessionRecap(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>> | null> {
  const body = await hostGetJson<{ recap?: Record<string, unknown> | null }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/recap`,
    'Host-Recap nicht erreichbar',
    env,
    fetchImpl,
  );
  return body.recap ?? null;
}

/** FE-HOST-14: persist manual session recap summary (no Edge AI). */
export async function saveHostSessionRecapSummary(
  sessionId: string,
  summaryText: string,
  status: 'draft' | 'approved',
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
  const body = await hostMutateJson<{ recap?: Record<string, unknown> }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/recap`,
    'PUT',
    { summaryText, status },
    'Zusammenfassung konnte nicht gespeichert werden',
    env,
    fetchImpl,
  );
  if (!body.recap || typeof body.recap !== 'object') {
    throw new Error('Zusammenfassung konnte nicht gespeichert werden: ungültige Antwort');
  }
  return body.recap;
}

export type HostSessionRecapGenerateResult =
  | {
      readonly status: 'ok';
      readonly summaryText: string;
      readonly summaryStatus: string;
      readonly provider: string;
      readonly model: string;
    }
  | { readonly status: 'not-configured'; readonly message: string }
  | { readonly status: 'error'; readonly message: string };

function parseSessionRecapGenerateBody(value: unknown): HostSessionRecapGenerateResult {
  if (typeof value !== 'object' || value === null) {
    return {
      status: 'error',
      message: 'Die KI-Antwort hatte ein ungültiges Format.',
    };
  }
  const rec = value as Record<string, unknown>;
  if (
    rec.status === 'ok' &&
    typeof rec.summaryText === 'string' &&
    typeof rec.provider === 'string' &&
    typeof rec.model === 'string'
  ) {
    return {
      status: 'ok',
      summaryText: rec.summaryText,
      summaryStatus: typeof rec.summaryStatus === 'string' ? rec.summaryStatus : 'draft',
      provider: rec.provider,
      model: rec.model,
    };
  }
  if (
    (rec.status === 'not-configured' || rec.status === 'error') &&
    typeof rec.message === 'string'
  ) {
    return { status: rec.status, message: rec.message };
  }
  return {
    status: 'error',
    message: 'Die KI-Antwort hatte ein ungültiges Format.',
  };
}

export type HostSessionMediaTokenResult =
  | {
      readonly ok: true;
      readonly token: string;
      readonly url: string;
      readonly roomId: string;
      readonly expiresAt: string;
      readonly ttlSeconds: number;
    }
  | {
      readonly ok: false;
      readonly degraded: true;
      readonly reason:
        | 'media_service_unavailable'
        | 'forbidden'
        | 'unauthorized'
        | 'bad_request';
      readonly message: string;
    };

/** CUT-19: LiveKit media token via host POST …/media-token. */
export async function fetchHostSessionMediaToken(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostSessionMediaTokenResult> {
  const base = getHostAuthBaseUrl(env);
  if (base === null) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Media-Token-Dienst nicht erreichbar.',
    };
  }
  const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/media-token`;
  const requestUrl = base === '' ? path : `${base}${path}`;
  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Media-Token-Dienst nicht erreichbar.',
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Leere Media-Token-Antwort.',
    };
  }
  const record =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  if (!record) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Leere Media-Token-Antwort.',
    };
  }
  if (record.degraded === true || record.ok === false) {
    const reason =
      record.reason === 'forbidden' ||
      record.reason === 'unauthorized' ||
      record.reason === 'bad_request'
        ? record.reason
        : 'media_service_unavailable';
    return {
      ok: false,
      degraded: true,
      reason,
      message:
        typeof record.message === 'string'
          ? record.message
          : 'Media plane degraded.',
    };
  }
  const token = typeof record.token === 'string' ? record.token : '';
  const url = typeof record.url === 'string' ? record.url : '';
  const roomId = typeof record.roomId === 'string' ? record.roomId : '';
  const expiresAt = typeof record.expiresAt === 'string' ? record.expiresAt : '';
  const ttlSeconds = typeof record.ttlSeconds === 'number' ? record.ttlSeconds : 0;
  if (!token || !url || !roomId) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Media-Token unvollständig.',
    };
  }
  return { ok: true, token, url, roomId, expiresAt, ttlSeconds };
}

/** CUT-14: AI generate draft via host POST …/recap/generate. */
export async function generateHostSessionRecapDraft(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostSessionRecapGenerateResult> {
  const base = getHostAuthBaseUrl(env);
  if (base === null) {
    return {
      status: 'error',
      message: 'Zusammenfassung konnte nicht generiert werden. Bitte manuell schreiben.',
    };
  }
  const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/recap/generate`;
  const requestUrl = base === '' ? path : `${base}${path}`;
  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    return {
      status: 'error',
      message: 'Zusammenfassung konnte nicht generiert werden. Bitte manuell schreiben.',
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      status: 'error',
      message: 'Zusammenfassung konnte nicht generiert werden. Bitte manuell schreiben.',
    };
  }
  return parseSessionRecapGenerateBody(data);
}

/** CUT-03 — clear temporary NPC controllers for session-scoped instances. */
export async function clearHostNpcTempControllersForSession(
  sessionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const body = await hostMutateJson<{ cleared?: number }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/npc-temp-controllers/clear`,
    'POST',
    {},
    'Temporäre Controller konnten nicht zurückgesetzt werden',
    env,
    fetchImpl,
  );
  return typeof body.cleared === 'number' ? body.cleared : 0;
}

export type HostPromoteOutcomeDto = {
  readonly ok?: boolean;
  readonly idempotent?: boolean;
  readonly targetKind?: string;
  readonly targetRef?: string;
  readonly messageDe?: string;
};

/** CUT-05 — promote consequence into saga definition via host product HTTP. */
export async function promoteHostSessionOutcomeToSaga(
  sessionId: string,
  consequenceId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPromoteOutcomeDto> {
  return hostMutateJson<HostPromoteOutcomeDto>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/outcomes/${encodeURIComponent(consequenceId)}/promote/saga`,
    'POST',
    {},
    'Host-Saga-Übernahme fehlgeschlagen',
    env,
    fetchImpl,
  );
}

/** CUT-05 — promote consequence into world lore via host product HTTP. */
export async function promoteHostSessionOutcomeToWorld(
  sessionId: string,
  consequenceId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPromoteOutcomeDto> {
  return hostMutateJson<HostPromoteOutcomeDto>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/outcomes/${encodeURIComponent(consequenceId)}/promote/world`,
    'POST',
    {},
    'Host-Welt-Übernahme fehlgeschlagen',
    env,
    fetchImpl,
  );
}
