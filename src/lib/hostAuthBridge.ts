/**
 * Host Better Auth cookie bridge (MIG-014) — credentials-only, no bearer store.
 * Location: src/lib/hostAuthBridge.ts
 *
 * Supabase/GoTrue remains the default product auth until an explicit cutover ticket.
 * This bridge is opt-in via VITE_SAGATREE_HOST_AUTH_URL and never mints JWTs.
 */

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
): Promise<HostWhoamiDto | null> {
  const base = getHostAuthBaseUrl(env);
  if (!base) return null;

  const response = await fetchImpl(`${base}/api/whoami`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
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
