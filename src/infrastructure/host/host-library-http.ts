/**
 * host-library-http — Browser Library cutover client (credentials cookie / solo host).
 * Location: src/infrastructure/host/host-library-http.ts
 *
 * FE-HOST-09 host-first: enabled when `VITE_SAGATREE_HOST_AUTH_URL` is set,
 * unless `VITE_SAGATREE_HOST_LIBRARY` is explicitly off (`0`/`false`/`off`/`no`).
 * Explicit `1`/`true`/`yes` still enables when the auth URL is present.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';

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

/** Explicit opt-out of host-first product runtime. */
export function isHostLibraryExplicitlyDisabled(env: EnvLike = defaultEnv()): boolean {
  const flag = env.VITE_SAGATREE_HOST_LIBRARY?.trim().toLowerCase();
  return flag === '0' || flag === 'false' || flag === 'off' || flag === 'no';
}

export function isHostLibraryEnabled(env: EnvLike = defaultEnv()): boolean {
  if (isHostLibraryExplicitlyDisabled(env)) return false;
  return getHostAuthBaseUrl(env) !== null;
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

export type HostLibraryCharacterDto = {
  readonly id: string;
  readonly publicId?: string;
  readonly name: string;
  readonly description?: string;
  readonly class?: string;
  readonly race?: string;
  readonly level?: number;
  readonly sheetStatus?: string;
  readonly portraitUrl?: string | null;
  readonly sheet?: Readonly<Record<string, unknown>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export async function fetchHostLibraryCharacters(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly HostLibraryCharacterDto[]> {
  const body = await hostGetJson<{ characters?: HostLibraryCharacterDto[] }>(
    '/api/v1/library/characters',
    'Host-Charakterliste nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.characters) ? body.characters : [];
}

export type HostLibraryProjectDto = {
  readonly id: string;
  readonly publicId?: string;
  readonly code?: string;
  readonly name: string;
  readonly description?: string | null;
  readonly worldId?: string | null;
  readonly worldProfileId?: string | null;
  readonly defaultLookProfileId?: string | null;
  readonly allowPlayerCharacterLookOverride?: boolean;
  readonly sagaId?: string | null;
  readonly sagaVersionId?: string | null;
  readonly sagaTitle?: string | null;
  readonly sagaSlug?: string | null;
  readonly sagaOrigin?: string | null;
  readonly gmUserId: string;
  readonly status?: string;
  readonly memberCount?: number;
  readonly sessionCount?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export async function fetchHostLibraryProjects(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly HostLibraryProjectDto[]> {
  const body = await hostGetJson<{ projects?: HostLibraryProjectDto[] }>(
    '/api/v1/library/projects',
    'Host-Projekte nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.projects) ? body.projects : [];
}

export type HostLibraryWorldDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};

export async function fetchHostLibraryWorlds(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly HostLibraryWorldDto[]> {
  const body = await hostGetJson<{ worlds?: HostLibraryWorldDto[] }>(
    '/api/v1/library/worlds',
    'Host-Welten nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.worlds) ? body.worlds : [];
}

async function hostMutateJson<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  unreachableMessage: string,
  payload?: unknown,
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
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
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
    throw new Error(detail || unreachableMessage);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function createHostLibraryCharacter(
  payload: Readonly<Record<string, unknown>>,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostLibraryCharacterDto> {
  const body = await hostMutateJson<{ character?: HostLibraryCharacterDto }>(
    '/api/v1/library/characters',
    'POST',
    'Host-Charakteranlage nicht erreichbar',
    payload,
    env,
    fetchImpl,
  );
  if (!body.character) throw new Error('Host-Charakteranlage: leere Antwort');
  return body.character;
}

export async function fetchHostLibraryCharacter(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostLibraryCharacterDto> {
  const body = await hostGetJson<{ character?: HostLibraryCharacterDto }>(
    `/api/v1/library/characters/${encodeURIComponent(id)}`,
    'Host-Charakter nicht erreichbar',
    env,
    fetchImpl,
  );
  if (!body.character) throw new Error('Charakter nicht gefunden');
  return body.character;
}

export async function updateHostLibraryCharacter(
  id: string,
  payload: Readonly<Record<string, unknown>>,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostLibraryCharacterDto> {
  const body = await hostMutateJson<{ character?: HostLibraryCharacterDto }>(
    `/api/v1/library/characters/${encodeURIComponent(id)}`,
    'PATCH',
    'Host-Charakter speichern fehlgeschlagen',
    payload,
    env,
    fetchImpl,
  );
  if (!body.character) throw new Error('Host-Charakter speichern: leere Antwort');
  return body.character;
}

export async function deleteHostLibraryCharacter(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    `/api/v1/library/characters/${encodeURIComponent(id)}`,
    'DELETE',
    'Host-Charakter löschen fehlgeschlagen',
    undefined,
    env,
    fetchImpl,
  );
}

export async function createHostLibraryWorld(
  payload: { readonly name: string },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostLibraryWorldDto> {
  const body = await hostMutateJson<{ world?: HostLibraryWorldDto }>(
    '/api/v1/library/worlds',
    'POST',
    'Host-Welt anlegen fehlgeschlagen',
    payload,
    env,
    fetchImpl,
  );
  if (!body.world) throw new Error('Host-Welt anlegen: leere Antwort');
  return body.world;
}

export async function updateHostLibraryWorld(
  id: string,
  payload: { readonly name: string },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostLibraryWorldDto> {
  const body = await hostMutateJson<{ world?: HostLibraryWorldDto }>(
    `/api/v1/library/worlds/${encodeURIComponent(id)}`,
    'PATCH',
    'Host-Welt speichern fehlgeschlagen',
    payload,
    env,
    fetchImpl,
  );
  if (!body.world) throw new Error('Host-Welt speichern: leere Antwort');
  return body.world;
}

export async function deleteHostLibraryWorld(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    `/api/v1/library/worlds/${encodeURIComponent(id)}`,
    'DELETE',
    'Host-Welt löschen fehlgeschlagen',
    undefined,
    env,
    fetchImpl,
  );
}

export async function createHostLibraryLook(
  draft: unknown,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ look?: unknown }>(
    '/api/v1/library/looks',
    'POST',
    'Host-Look anlegen fehlgeschlagen',
    { draft },
    env,
    fetchImpl,
  );
  if (!body.look) throw new Error('Host-Look anlegen: leere Antwort');
  return body.look;
}

export async function archiveHostLibraryLook(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ look?: unknown }>(
    `/api/v1/library/looks/${encodeURIComponent(id)}/archive`,
    'POST',
    'Host-Look archivieren fehlgeschlagen',
    {},
    env,
    fetchImpl,
  );
  if (!body.look) throw new Error('Host-Look archivieren: leere Antwort');
  return body.look;
}

export async function duplicateHostLibraryLook(
  id: string,
  displayName?: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ look?: unknown }>(
    `/api/v1/library/looks/${encodeURIComponent(id)}/duplicate`,
    'POST',
    'Host-Look duplizieren fehlgeschlagen',
    displayName ? { displayName } : {},
    env,
    fetchImpl,
  );
  if (!body.look) throw new Error('Host-Look duplizieren: leere Antwort');
  return body.look;
}

export async function fetchHostLibraryNpcCreatures(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[]> {
  const body = await hostGetJson<{ definitions?: unknown[] }>(
    '/api/v1/library/npc-creatures',
    'Host-NPC-Katalog nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.definitions) ? body.definitions : [];
}

export async function fetchHostLibraryItems(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[]> {
  const body = await hostGetJson<{ items?: unknown[] }>(
    '/api/v1/library/items',
    'Host-Itemkatalog nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.items) ? body.items : [];
}

export async function createHostLibraryItem(
  draft: {
    readonly name: string;
    readonly origin?: 'personal' | 'world';
    readonly worldProfileId?: string | null;
    readonly payload?: Readonly<Record<string, unknown>>;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ item?: unknown }>(
    '/api/v1/library/items',
    'POST',
    'Host-Item anlegen fehlgeschlagen',
    draft,
    env,
    fetchImpl,
  );
  if (!body.item) throw new Error('Host-Item anlegen: leere Antwort');
  return body.item;
}

export async function createHostLibraryNpcCreature(
  input: {
    readonly scope: 'personal' | 'world';
    readonly worldProfileId?: string | null;
    readonly draft: unknown;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ definition?: unknown }>(
    '/api/v1/library/npc-creatures',
    'POST',
    'Host-NPC anlegen fehlgeschlagen',
    input,
    env,
    fetchImpl,
  );
  if (!body.definition) throw new Error('Host-NPC anlegen: leere Antwort');
  return body.definition;
}

export async function updateHostLibraryNpcCreature(
  definitionId: string,
  draft: unknown,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ definition?: unknown }>(
    `/api/v1/library/npc-creatures/${encodeURIComponent(definitionId)}`,
    'PATCH',
    'Host-NPC speichern fehlgeschlagen',
    { draft },
    env,
    fetchImpl,
  );
  if (!body.definition) throw new Error('Host-NPC speichern: leere Antwort');
  return body.definition;
}

export async function archiveHostLibraryNpcCreature(
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ definition?: unknown }>(
    `/api/v1/library/npc-creatures/${encodeURIComponent(definitionId)}/archive`,
    'POST',
    'Host-NPC archivieren fehlgeschlagen',
    undefined,
    env,
    fetchImpl,
  );
  if (!body.definition) throw new Error('Host-NPC archivieren: leere Antwort');
  return body.definition;
}

export async function fetchHostLibraryLooks(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[]> {
  const body = await hostGetJson<{ looks?: unknown[] }>(
    '/api/v1/library/looks',
    'Host-Looks nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.looks) ? body.looks : [];
}

export type HostPublishedAssetDto = {
  readonly assetId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly url: string;
  readonly storagePath: string;
};

/**
 * Publish owner-scoped bytes via host AssetPorts (FE-HOST-06).
 * Returns display `url` suitable for `<img src>` + character portrait_url save.
 */
export async function publishHostAsset(
  file: File,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostPublishedAssetDto> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error('Host-Asset-Upload nicht erreichbar');

  const form = new FormData();
  form.append('file', file, file.name || 'portrait.bin');
  if (file.type) form.append('contentType', file.type);

  let response: Response;
  try {
    response = await fetchImpl(`${base}/api/v1/assets`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw new Error('Host-Asset-Upload nicht erreichbar');
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
    throw new Error(detail || 'Host-Asset-Upload fehlgeschlagen');
  }

  const body = (await response.json()) as Partial<HostPublishedAssetDto>;
  if (typeof body.assetId !== 'string' || typeof body.url !== 'string') {
    throw new Error('Host-Asset-Upload: leere Antwort');
  }
  return {
    assetId: body.assetId,
    contentType: typeof body.contentType === 'string' ? body.contentType : file.type || 'application/octet-stream',
    byteSize: typeof body.byteSize === 'number' ? body.byteSize : file.size,
    checksumSha256: typeof body.checksumSha256 === 'string' ? body.checksumSha256 : '',
    url: body.url,
    storagePath: typeof body.storagePath === 'string' ? body.storagePath : '',
  };
}
