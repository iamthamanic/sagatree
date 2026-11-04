/**
 * host-saga-definition-http — Browser saga-definition cutover client (FE-HOST-13).
 * Location: src/infrastructure/host/host-saga-definition-http.ts
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
  return (await response.json()) as T;
}

export async function getHostSagaDefinitionVersion(
  versionId: string,
): Promise<Record<string, unknown>> {
  const body = await hostGetJson<{ version?: Record<string, unknown> }>(
    `/api/v1/saga-definitions/versions/${encodeURIComponent(versionId)}`,
    'Saga-Definition konnte nicht geladen werden',
  );
  if (!body.version || typeof body.version !== 'object') {
    throw new Error('Saga-Definition konnte nicht geladen werden: ungültige Antwort');
  }
  return body.version;
}

export async function getHostNativeSagaDefinitionBySlug(
  slug: string,
): Promise<Record<string, unknown>> {
  const body = await hostGetJson<{ version?: Record<string, unknown> }>(
    `/api/v1/saga-definitions/by-slug/${encodeURIComponent(slug)}`,
    'Native Saga konnte nicht geladen werden',
  );
  if (!body.version || typeof body.version !== 'object') {
    throw new Error('Native Saga konnte nicht geladen werden: ungültige Antwort');
  }
  return body.version;
}

export async function getHostSagaDefinitionEditor(
  sagaId: string,
): Promise<Record<string, unknown>> {
  const body = await hostGetJson<{ editor?: Record<string, unknown> }>(
    `/api/v1/saga-definitions/${encodeURIComponent(sagaId)}/editor`,
    'Saga-Editor konnte nicht geladen werden',
  );
  if (!body.editor || typeof body.editor !== 'object') {
    throw new Error('Saga-Editor konnte nicht geladen werden: ungültige Antwort');
  }
  return body.editor;
}

export async function saveHostSagaDefinitionDraft(input: {
  readonly sagaId: string;
  readonly payload: Record<string, unknown>;
  readonly expectedRevision: number;
}): Promise<{ readonly revision: number; readonly versionId: string }> {
  const body = await hostMutateJson<{
    draft?: { revision?: number; versionId?: string };
  }>(
    `/api/v1/saga-definitions/${encodeURIComponent(input.sagaId)}/draft`,
    'PUT',
    { payload: input.payload, expectedRevision: input.expectedRevision },
    'Entwurf konnte nicht gespeichert werden',
  );
  const draft = body.draft;
  if (
    !draft ||
    typeof draft.revision !== 'number' ||
    typeof draft.versionId !== 'string'
  ) {
    throw new Error('Entwurf konnte nicht gespeichert werden: ungültige Antwort');
  }
  return { revision: draft.revision, versionId: draft.versionId };
}

export async function publishHostSagaDefinitionVersion(input: {
  readonly sagaId: string;
  readonly expectedRevision: number;
}): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
  const body = await hostMutateJson<{
    publish?: { versionId?: string; versionLabel?: string };
  }>(
    `/api/v1/saga-definitions/${encodeURIComponent(input.sagaId)}/publish`,
    'POST',
    { expectedRevision: input.expectedRevision },
    'Fassung konnte nicht veröffentlicht werden',
  );
  const pub = body.publish;
  if (!pub || typeof pub.versionId !== 'string') {
    throw new Error('Fassung konnte nicht veröffentlicht werden: ungültige Antwort');
  }
  return {
    versionId: pub.versionId,
    versionLabel: typeof pub.versionLabel === 'string' ? pub.versionLabel : 'v?',
  };
}

export async function createHostUserSagaDefinition(input: {
  readonly title: string;
  readonly blurb?: string;
}): Promise<{ readonly sagaId: string }> {
  const body = await hostMutateJson<{ saga?: { sagaId?: string } }>(
    '/api/v1/saga-definitions',
    'POST',
    { title: input.title, blurb: input.blurb ?? '' },
    'Saga konnte nicht angelegt werden',
  );
  if (!body.saga || typeof body.saga.sagaId !== 'string') {
    throw new Error('Saga konnte nicht angelegt werden: ungültige Antwort');
  }
  return { sagaId: body.saga.sagaId };
}

export async function copyHostNativeSagaDefinition(
  sourceSagaId: string,
): Promise<{ readonly sagaId: string }> {
  const body = await hostMutateJson<{ saga?: { sagaId?: string } }>(
    '/api/v1/saga-definitions/copy-native',
    'POST',
    { sourceSagaId },
    'Kopie konnte nicht erstellt werden',
  );
  if (!body.saga || typeof body.saga.sagaId !== 'string') {
    throw new Error('Kopie konnte nicht erstellt werden: ungültige Antwort');
  }
  return { sagaId: body.saga.sagaId };
}

export async function createHostProjectFromSagaVersion(input: {
  readonly sagaId: string;
  readonly versionId: string;
  readonly name?: string;
}): Promise<{ readonly id: string; readonly publicId: string }> {
  const body = await hostMutateJson<{ project?: { id?: string; publicId?: string } }>(
    '/api/v1/saga-definitions/create-project',
    'POST',
    {
      sagaId: input.sagaId,
      versionId: input.versionId,
      name: input.name ?? null,
    },
    'Gruppe konnte nicht erstellt werden',
  );
  if (!body.project || typeof body.project.id !== 'string') {
    throw new Error('Gruppe konnte nicht erstellt werden: ungültige Antwort');
  }
  return {
    id: body.project.id,
    publicId: typeof body.project.publicId === 'string' ? body.project.publicId : '',
  };
}

export async function duplicateHostSagaPlaythrough(input: {
  readonly projectId: string;
  readonly mode: 'fresh' | 'with_progress';
}): Promise<{ readonly id: string; readonly publicId: string }> {
  const body = await hostMutateJson<{ project?: { id?: string; publicId?: string } }>(
    '/api/v1/saga-definitions/duplicate-playthrough',
    'POST',
    { projectId: input.projectId, mode: input.mode },
    'Saga konnte nicht dupliziert werden',
  );
  if (!body.project || typeof body.project.id !== 'string') {
    throw new Error('Saga konnte nicht dupliziert werden: ungültige Antwort');
  }
  return {
    id: body.project.id,
    publicId: typeof body.project.publicId === 'string' ? body.project.publicId : '',
  };
}
