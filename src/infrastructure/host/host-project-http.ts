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

export type HostProjectSessionDto = {
  readonly id: string;
  readonly projectId: string;
  readonly publicId?: string;
  readonly status?: string;
  readonly sessionNumber?: number | null;
  readonly name?: string | null;
};

/** Create a project-scoped play session (FE-HOST-09 / create_project_session successor). */
export async function createHostProjectSession(
  projectId: string,
  name?: string | null,
  notes?: string | null,
): Promise<HostProjectSessionDto> {
  const body = await hostMutateJson<{ session?: HostProjectSessionDto }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/sessions`,
    'POST',
    { name: name ?? null, notes: notes ?? null },
    'Session konnte nicht erstellt werden',
  );
  if (!body.session || typeof body.session.id !== 'string') {
    throw new Error('Session konnte nicht erstellt werden: ungültige Antwort');
  }
  return body.session;
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

/** Active project members for host-first NPC controller / spawn dialogs (CUT-02). */
export type HostProjectMemberDto = {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly characterId: string | null;
  readonly role: 'gm' | 'player';
  readonly status: 'active' | 'inactive';
  readonly joinedAt: string | null;
};

export async function listHostProjectMembers(
  projectId: string,
): Promise<readonly HostProjectMemberDto[]> {
  const body = await hostGetJson<{ members?: HostProjectMemberDto[] }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/members`,
    'Mitglieder konnten nicht geladen werden',
  );
  if (!Array.isArray(body.members)) {
    throw new Error('Mitglieder konnten nicht geladen werden: ungültige Antwort');
  }
  return body.members;
}

/** FE-HOST-12 project write DTO (host camelCase). */
export type HostProjectWriteDto = {
  readonly id: string;
  readonly publicId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly worldId: string;
  readonly worldProfileId: string;
  readonly defaultLookProfileId: string | null;
  readonly allowPlayerCharacterLookOverride: boolean;
  readonly gmUserId: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function createHostProject(input: {
  readonly name: string;
  readonly description?: string | null;
  readonly worldProfileId?: string | null;
}): Promise<HostProjectWriteDto> {
  const body = await hostMutateJson<{ project?: HostProjectWriteDto }>(
    '/api/v1/projects',
    'POST',
    {
      name: input.name,
      description: input.description ?? null,
      worldProfileId: input.worldProfileId ?? null,
    },
    'Saga konnte nicht angelegt werden',
  );
  if (!body.project || typeof body.project.id !== 'string') {
    throw new Error('Saga konnte nicht angelegt werden: ungültige Antwort');
  }
  return body.project;
}

export async function updateHostProject(
  projectId: string,
  patch: {
    readonly name?: string;
    readonly description?: string | null;
    readonly status?: string;
    readonly worldProfileId?: string | null;
    readonly defaultLookProfileId?: string | null;
    readonly allowPlayerCharacterLookOverride?: boolean;
  },
): Promise<HostProjectWriteDto> {
  const body = await hostMutateJson<{ project?: HostProjectWriteDto }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    'PATCH',
    patch,
    'Saga konnte nicht aktualisiert werden',
  );
  if (!body.project || typeof body.project.id !== 'string') {
    throw new Error('Saga konnte nicht aktualisiert werden: ungültige Antwort');
  }
  return body.project;
}

export async function deleteHostProject(projectId: string): Promise<void> {
  await hostMutateJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    'DELETE',
    undefined,
    'Saga konnte nicht gelöscht werden',
  );
}

export type HostSessionLookDto = {
  readonly id: string;
  readonly projectId: string;
  readonly lookProfileId: string | null;
  readonly publicId?: string;
  readonly status?: string;
  readonly sessionNumber?: number | null;
  readonly name?: string | null;
};

export async function updateHostSessionLook(
  sessionId: string,
  lookProfileId: string | null,
): Promise<HostSessionLookDto> {
  const body = await hostMutateJson<{ session?: HostSessionLookDto }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/look`,
    'PATCH',
    { lookProfileId },
    'Session-Look konnte nicht aktualisiert werden',
  );
  if (!body.session || typeof body.session.id !== 'string') {
    throw new Error('Session-Look konnte nicht aktualisiert werden: ungültige Antwort');
  }
  return body.session;
}
