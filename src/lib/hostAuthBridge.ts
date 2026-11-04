/**
 * Host Better Auth cookie bridge (MIG-014) — credentials-only, no bearer store.
 * Location: src/lib/hostAuthBridge.ts
 *
 * FE-HOST-09: product auth uses host cookies when the auth URL is set.
 * This bridge never mints JWTs.
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

/**
 * Resolve the host auth HTTP base.
 * - Absolute URL (e.g. `http://127.0.0.1:8787`) for direct host calls.
 * - `same-origin` / `.` → page origin (use with Vite `/api` proxy) so session
 *   cookies stay first-party. Mixing `localhost` FE with `127.0.0.1` host
 *   makes SameSite=Lax cookies invisible to `/api/whoami` → "Sitzung nicht aktiv".
 */
export function getHostAuthBaseUrl(env: EnvLike = defaultEnv()): string | null {
  const url = env.VITE_SAGATREE_HOST_AUTH_URL;
  if (typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed === 'same-origin' || trimmed === '.') {
    if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
      return window.location.origin;
    }
    // Node / Vitest: enabled, relative `/api/...` paths.
    return '';
  }
  return trimmed;
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

/**
 * DEV host-operator emails allowed to auto-claim the single MIG-015 solo link.
 * Arbitrary remote sign-ups must not silently inherit solo-owned worlds/characters.
 */
const HOST_SOLO_AUTO_LINK_EMAILS = new Set([
  'admin@sagatree.local',
]);

/**
 * MIG-015: Dornhain/default catalog is seeded under the host solo actor.
 * After Better Auth login, the host operator may link that solo id so
 * Library/World/Saga lists see it. Requires confirm + matching host solo id;
 * only auto-confirm for known DEV operator emails (not every sign-in).
 * Idempotent; soft-fails (ACCOUNT_LINK_TAKEN when another remote already claimed).
 */
export async function ensureHostSoloAccountLinked(
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
  options: { readonly email?: string | null; readonly allowAutoConfirm?: boolean } = {},
): Promise<void> {
  const base = getHostAuthBaseUrl(env);
  if (base === null) return;
  const email = typeof options.email === 'string' ? options.email.trim().toLowerCase() : '';
  const allowAutoConfirm =
    options.allowAutoConfirm === true ||
    (email.length > 0 && HOST_SOLO_AUTO_LINK_EMAILS.has(email));
  if (!allowAutoConfirm) return;
  let identityRaw: unknown;
  try {
    const response = await fetchImpl(`${base}/api/solo/identity`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    identityRaw = await response.json();
  } catch {
    return;
  }
  if (!identityRaw || typeof identityRaw !== 'object') return;
  const identity = identityRaw as {
    soloActorId?: unknown;
    linked?: unknown;
  };
  if (identity.linked === true) return;
  const soloActorId =
    typeof identity.soloActorId === 'string' ? identity.soloActorId.trim() : '';
  if (!soloActorId) return;
  try {
    await hostAuthJson(
      '/api/solo/link-account',
      { soloActorId, confirm: true },
      'Solo-Account-Link fehlgeschlagen',
      fetchImpl,
      env,
    );
  } catch {
    /* ACCOUNT_LINK_TAKEN / mismatch — Library stays empty until resolved */
  }
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
  if (!actor) {
    throw new Error(
      'Host-Anmeldung: Sitzung nicht aktiv. FE und Host müssen denselben Hostnamen nutzen (beide 127.0.0.1 oder beide localhost) — oder VITE_SAGATREE_HOST_AUTH_URL=same-origin mit Vite-/api-Proxy.',
    );
  }
  await ensureHostSoloAccountLinked(fetchImpl, env, { email: actor.email });
  return actor;
}

/** Better Auth email/password sign-up — sets HttpOnly session cookie when auto-login. */
export async function signUpHostEmail(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
  env: EnvLike = defaultEnv(),
): Promise<HostWhoamiDto | null> {
  await hostAuthJson(
    '/api/auth/sign-up/email',
    { email: email.trim(), password, name: email.trim() },
    'Host-Registrierung nicht erreichbar',
    fetchImpl,
    env,
  );
  const actor = await probeHostActor(fetchImpl, env);
  if (!actor) return null;
  await ensureHostSoloAccountLinked(fetchImpl, env, { email: actor.email });
  return actor;
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
