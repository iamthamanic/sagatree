/**
 * host-world-http — Browser world map/atlas/places cutover client.
 * Location: src/infrastructure/host/host-world-http.ts
 *
 * Same gate as Library: `isHostLibraryEnabled()` (VITE_SAGATREE_HOST_LIBRARY + auth URL).
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

function qs(params: Record<string, string | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === false || value === '') continue;
    sp.set(key, value === true ? 'true' : String(value));
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
    if (detail && /revision conflict/i.test(detail)) {
      throw new Error(
        'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.',
      );
    }
    throw new Error(detail ? `${unreachableMessage}: ${detail}` : unreachableMessage);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchHostWorldMap(
  worldProfileId: string,
  playerView = false,
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/map${qs({ playerView })}`,
    'Weltkarte konnte nicht geladen werden',
  );
}

export async function saveHostWorldMap(
  worldProfileId: string,
  expectedRevision: number,
  mapData: unknown,
): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/map`,
    'PUT',
    { expectedRevision, mapData },
    'Weltkarte konnte nicht gespeichert werden',
  );
}

export async function listHostWorldAtlasMaps(
  worldProfileId: string,
  options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/atlas/maps${qs({
      playerView: options.playerView === true,
      sagaPublicId: options.sagaPublicId,
    })}`,
    'Atlas-Liste fehlgeschlagen',
  );
}

export async function ensureHostWorldAtlasRoot(worldProfileId: string): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/atlas/ensure-root`,
    'POST',
    {},
    'Atlas-Root fehlgeschlagen',
  );
}

export async function fetchHostWorldAtlasMap(
  mapId: string,
  playerView = false,
  sagaPublicId?: string | null,
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/worlds/atlas/maps/${encodeURIComponent(mapId)}${qs({
      playerView,
      sagaPublicId,
    })}`,
    'Atlas-Karte konnte nicht geladen werden',
  );
}

export async function upsertHostWorldAtlasMap(input: {
  readonly worldProfileId: string;
  readonly mapId?: string | null;
  readonly parentMapId?: string | null;
  readonly kind: string;
  readonly title: string;
  readonly sortOrder?: number;
  readonly bounds: unknown;
  readonly layers: unknown;
  readonly basemapStoragePath?: string | null;
  readonly azgaarMapStoragePath?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>>;
  readonly expectedRevision?: number | null;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/atlas/maps`,
    'PUT',
    {
      mapId: input.mapId ?? null,
      parentMapId: input.parentMapId ?? null,
      kind: input.kind,
      title: input.title,
      sortOrder: input.sortOrder ?? 0,
      bounds: input.bounds,
      layers: input.layers,
      basemapStoragePath: input.basemapStoragePath ?? null,
      azgaarMapStoragePath: input.azgaarMapStoragePath ?? null,
      generatorMeta: input.generatorMeta ?? {},
      expectedRevision: input.expectedRevision ?? null,
    },
    'Atlas speichern fehlgeschlagen',
  );
}

export async function listHostWorldPlaces(
  worldProfileId: string,
  options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/places${qs({
      playerView: options.playerView === true,
      sagaPublicId: options.sagaPublicId,
    })}`,
    'Orte konnten nicht geladen werden',
  );
}

export async function listHostWorldPlaceMapLinks(
  worldProfileId: string,
  options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
): Promise<unknown> {
  return hostGetJson(
    `/api/v1/worlds/${encodeURIComponent(worldProfileId)}/place-map-links${qs({
      playerView: options.playerView === true,
      sagaPublicId: options.sagaPublicId,
    })}`,
    'Kartenverknüpfungen fehlgeschlagen',
  );
}

export async function upsertHostWorldPlace(input: {
  readonly worldProfileId: string;
  readonly placeId?: string | null;
  readonly parentPlaceId?: string | null;
  readonly kind: string;
  readonly name: string;
  readonly description?: string | null;
  readonly status?: string | null;
  readonly seedKey?: string | null;
  readonly sortOrder?: number;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/places`,
    'PUT',
    {
      placeId: input.placeId ?? null,
      parentPlaceId: input.parentPlaceId ?? null,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      seedKey: input.seedKey ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
    'Ort speichern fehlgeschlagen',
  );
}

export async function upsertHostWorldPlaceMapLink(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: string;
  readonly featureId?: string | null;
  readonly anchor?: Readonly<Record<string, unknown>>;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/place-map-links`,
    'PUT',
    {
      placeId: input.placeId,
      mapId: input.mapId,
      usage: input.usage,
      featureId: input.featureId ?? null,
      anchor: input.anchor ?? {},
    },
    'Kartenverknüpfung fehlgeschlagen',
  );
}

export async function createHostWorldNodeWithMaps(input: {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
  readonly idempotencyKey: string;
  readonly subtype?: string | null;
  readonly parentPlaceId?: string | null;
  readonly description?: string | null;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes`,
    'POST',
    {
      kind: input.kind,
      name: input.name,
      idempotencyKey: input.idempotencyKey,
      subtype: input.subtype ?? null,
      parentPlaceId: input.parentPlaceId ?? null,
      description: input.description ?? null,
    },
    'Weltknoten anlegen fehlgeschlagen',
  );
}

export async function previewHostWorldNodeConsequences(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/preview-consequences`,
    'POST',
    {},
    'Folgenabschätzung fehlgeschlagen',
  );
}

export async function renameHostWorldNode(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly name: string;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/rename`,
    'POST',
    { name: input.name },
    'Umbenennen fehlgeschlagen',
  );
}

export async function reparentHostWorldNode(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly newParentPlaceId: string | null;
  readonly confirmRelocate: boolean;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/reparent`,
    'POST',
    {
      newParentPlaceId: input.newParentPlaceId,
      confirmRelocate: input.confirmRelocate,
    },
    'Verschieben fehlgeschlagen',
  );
}

export async function duplicateHostWorldNode(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly deep?: boolean;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/duplicate`,
    'POST',
    { deep: input.deep === true },
    'Duplizieren fehlgeschlagen',
  );
}

export async function archiveHostWorldNodeSubtree(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly confirm: boolean;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/archive`,
    'POST',
    { confirm: input.confirm },
    'Archivieren fehlgeschlagen',
  );
}

export async function deleteHostWorldNode(input: {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly confirm: boolean;
}): Promise<unknown> {
  return hostMutateJson(
    `/api/v1/worlds/${encodeURIComponent(input.worldProfileId)}/nodes/${encodeURIComponent(input.placeId)}/delete`,
    'POST',
    { confirm: input.confirm },
    'Löschen fehlgeschlagen',
  );
}
