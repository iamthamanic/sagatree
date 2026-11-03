/**
 * Host Better Auth cookie bridge (MIG-014) — credentials-only, no bearer store.
 * Location: src/lib/hostAuthBridge.ts
 *
 * Supabase/GoTrue remains the default product auth until an explicit cutover ticket.
 * This bridge is opt-in via VITE_SAGATREE_HOST_AUTH_URL and never mints JWTs.
 */

/**
 * Bound host whoami probes (matches AUTH_SESSION_TIMEOUT_MS). Kept local so
 * Node self-tests can import this module without browser `networkTimeout`.
 */
const HOST_AUTH_PROBE_TIMEOUT_MS = 1_500;

/** Session bearer field names that must never be persisted from host auth JSON. */
export const HOST_AUTH_SESSION_BEARER_KEYS = [
  'token',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'idToken',
] as const;

export type HostWhoamiDto = {
  readonly ok: true;
  readonly actorId: string;
  readonly kind: 'remote-account';
  readonly email: string | null;
};

type EnvLike = { readonly VITE_SAGATREE_HOST_AUTH_URL?: string };

function defaultEnv(): EnvLike {
  try {
    return (import.meta as ImportMeta & { env?: EnvLike }).env ?? {};
  } catch {
    return {};
  }
}

export function isHostAuthBridgeEnabled(env: EnvLike = defaultEnv()): boolean {
  const url = env.VITE_SAGATREE_HOST_AUTH_URL;
  return typeof url === 'string' && url.trim().length > 0;
}

export function getHostAuthBaseUrl(env: EnvLike = defaultEnv()): string | null {
  const url = env.VITE_SAGATREE_HOST_AUTH_URL;
  if (typeof url !== 'string' || !url.trim()) return null;
  return url.replace(/\/$/, '');
}

/**
 * Strip any accidental bearer fields from host auth JSON before UI use.
 * Cookie session remains HttpOnly — page JS must not restore auth from these keys.
 */
export function scrubHostAuthJson<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const item of value) scrubHostAuthJson(item);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (
      (HOST_AUTH_SESSION_BEARER_KEYS as readonly string[]).includes(key) &&
      typeof record[key] === 'string'
    ) {
      delete record[key];
    } else {
      scrubHostAuthJson(record[key]);
    }
  }
  return value;
}

/**
 * Probe current host cookie session (credentials: include). Returns null when
 * unauthenticated or bridge disabled. Never stores Authorization Bearer.
 */
export async function probeHostActor(
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
  timeoutMs: number = HOST_AUTH_PROBE_TIMEOUT_MS,
): Promise<HostWhoamiDto | null> {
  const base = getHostAuthBaseUrl(env);
  if (!base) return null;

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${base}/api/whoami`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) return null;

  let raw: unknown;
  try {
    raw = scrubHostAuthJson(await response.json());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.ok !== true) return null;
  if (typeof record.actorId !== 'string' || record.actorId.length === 0) return null;
  if (record.kind !== 'remote-account') return null;
  let email: string | null = null;
  if (record.email === null) email = null;
  else if (typeof record.email === 'string') email = record.email;
  else email = null;
  return {
    ok: true,
    actorId: record.actorId,
    kind: 'remote-account',
    email,
  };
}

async function hostAuthJson(
  path: string,
  body: Readonly<Record<string, unknown>>,
  unreachableMessage: string,
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
): Promise<unknown> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error(unreachableMessage);
  let response: Response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(unreachableMessage);
  }
  let raw: unknown = null;
  try {
    raw = scrubHostAuthJson(await response.json());
  } catch {
    raw = null;
  }
  if (!response.ok) {
    let detail = '';
    if (raw && typeof raw === 'object' && 'message' in raw) {
      detail = String((raw as { message: unknown }).message);
    } else if (raw && typeof raw === 'object' && 'error' in raw) {
      detail = String((raw as { error: unknown }).error);
    }
    const err = new Error(detail || unreachableMessage) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return raw;
}

/** Better Auth email/password sign-in — sets HttpOnly session cookie. */
export async function signInHostEmail(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
): Promise<HostWhoamiDto> {
  await hostAuthJson(
    '/api/auth/sign-in/email',
    { email: email.trim(), password, name: email.trim() },
    'Host-Anmeldung nicht erreichbar',
    fetchImpl,
    env,
  );
  const actor = await probeHostActor(fetchImpl, env);
  if (!actor) throw new Error('Host-Anmeldung: Sitzung nicht aktiv');
  return actor;
}

/** Better Auth email/password sign-up — sets HttpOnly session cookie when auto-login. */
export async function signUpHostEmail(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
): Promise<void> {
  await hostAuthJson(
    '/api/auth/sign-up/email',
    { email: email.trim(), password, name: email.trim() },
    'Host-Registrierung nicht erreichbar',
    fetchImpl,
    env,
  );
}

/** Clear host Better Auth cookie session. Throws when the cookie was not cleared. */
export async function signOutHost(
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
): Promise<void> {
  const base = getHostAuthBaseUrl(env);
  if (!base) return;
  let response: Response;
  try {
    response = await fetchImpl(`${base}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Host-Abmeldung nicht erreichbar');
  }
  if (!response.ok) {
    throw new Error('Host-Abmeldung fehlgeschlagen');
  }
}
