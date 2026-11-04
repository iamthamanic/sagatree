/**
 * host-project-http — Browser project/saga cutover client (FE-HOST-04).
 * Location: src/infrastructure/host/host-project-http.ts
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

function qs(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    sp.set(key, value);
  }
  const out = sp.toString();
  return out ? `?${out}` : '';
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
    if (detail && /not authenticated|forbidden|42501/i.test(detail)) {
      throw new Error('Kein Zugriff auf diese Saga');
    }
    if (detail && /not found|P0002/i.test(detail)) {
      throw new Error('Saga nicht gefunden');
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

export async function ensureHostNativeStarterProject(slug?: string | null): Promise<unknown> {
  return hostMutateJson(
    '/api/v1/projects/ensure-starter',
    'POST',
    { slug: slug ?? 'dornhain.whisper' },
    'Starter-Projekt konnte nicht angelegt werden',
  );
}

export async function joinHostProjectByCode(
  code: string,
  characterId?: string | null,
): Promise<{ readonly projectId: string; readonly userId: string }> {
  return hostMutateJson(
    '/api/v1/projects/join',
    'POST',
    { code, characterId: characterId ?? null },
    'Beitritt fehlgeschlagen',
  );
}

export async function setHostMyProjectCharacter(
  projectId: string,
  characterId?: string | null,
): Promise<{ readonly memberId: string; readonly userId: string }> {
  return hostMutateJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}/my-character`,
    'POST',
    { characterId: characterId ?? null },
    'Charakter konnte nicht aktualisiert werden',
  );
}

export async function fetchHostSagaOverview(publicId: string): Promise<unknown> {
  return hostGetJson(
    `/api/v1/sagas/${encodeURIComponent(publicId)}/overview`,
    'Saga-Übersicht fehlgeschlagen',
  );
}

export async function fetchHostMySagaPermissions(publicId: string): Promise<unknown> {
  return hostGetJson(
    `/api/v1/sagas/${encodeURIComponent(publicId)}/permissions`,
    'Berechtigungen konnten nicht geladen werden',
  );
}

export async function fetchHostSagaLoreTimeline(publicId: string): Promise<unknown> {
  return hostGetJson(
    `/api/v1/sagas/${encodeURIComponent(publicId)}/lore-timeline`,
    'Lore-Zeitleiste fehlgeschlagen',
  );
}

export async function listHostSagaBindings(
  publicId: string,
  assetKind?: string | null,
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/sagas/${encodeURIComponent(publicId)}/bindings${qs({ assetKind })}`,
    'Bindings fehlgeschlagen',
  );
}

export async function listHostSagaMemberPermissionState(publicId: string): Promise<unknown> {
  return hostGetJson(
    `/api/v1/sagas/${encodeURIComponent(publicId)}/members`,
    'Mitglieder-Berechtigungen fehlgeschlagen',
  );
}

export async function setHostSagaBindingReveal(
  projectId: string,
  bindingId: string,
  reveal: string,
): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}/bindings/${encodeURIComponent(bindingId)}/reveal`,
    'POST',
    { reveal },
    'Reveal konnte nicht gesetzt werden',
  );
}

export async function setHostSagaMemberBundle(
  projectId: string,
  memberId: string,
  bundleId: string,
): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}/bundle`,
    'POST',
    { bundleId },
    'Bundle konnte nicht gesetzt werden',
  );
}
