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

/** CUT-07 — POST `/api/v1/library/looks/:id/versions`. */
export async function appendHostLibraryLookVersion(
  profileId: string,
  draft: unknown,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ look?: unknown }>(
    `/api/v1/library/looks/${encodeURIComponent(profileId)}/versions`,
    'POST',
    'Host-Look-Version anhängen fehlgeschlagen',
    { draft },
    env,
    fetchImpl,
  );
  if (!body.look) throw new Error('Host-Look-Version anhängen: leere Antwort');
  return body.look;
}

/** CUT-07 — GET `/api/v1/library/looks/:id/versions`. */
export async function fetchHostLibraryLookVersions(
  profileId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[]> {
  const body = await hostGetJson<{ versions?: unknown[] }>(
    `/api/v1/library/looks/${encodeURIComponent(profileId)}/versions`,
    'Host-Look-Versionen nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.versions) ? body.versions : [];
}

/** CUT-08 — GET `/api/v1/library/character-presets`. */
export async function fetchHostLibraryCharacterPresets(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[]> {
  const body = await hostGetJson<{ presets?: unknown[] }>(
    '/api/v1/library/character-presets',
    'Host-Charakter-Presets nicht erreichbar',
    env,
    fetchImpl,
  );
  return Array.isArray(body.presets) ? body.presets : [];
}

/** CUT-08 — GET `/api/v1/library/character-presets/by-character/:characterId`. */
export async function fetchHostLibraryCharacterPresetForCharacter(
  characterId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const body = await hostGetJson<{ preset?: unknown | null }>(
    `/api/v1/library/character-presets/by-character/${encodeURIComponent(characterId)}`,
    'Host-Charakter-Preset nicht erreichbar',
    env,
    fetchImpl,
  );
  return body.preset ?? null;
}

/** CUT-08 — POST `/api/v1/library/character-presets`. */
export async function createHostLibraryCharacterPreset(
  input: {
    readonly displayName: string;
    readonly rulesetKey: string;
    readonly sourceCharacterId: string;
    readonly snapshot: unknown;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ preset?: unknown }>(
    '/api/v1/library/character-presets',
    'POST',
    'Host-Charakter-Preset anlegen fehlgeschlagen',
    input,
    env,
    fetchImpl,
  );
  if (!body.preset) throw new Error('Host-Charakter-Preset anlegen: leere Antwort');
  return body.preset;
}

/** CUT-08 — POST `/api/v1/library/character-presets/:id/versions`. */
export async function releaseHostLibraryCharacterPresetVersion(
  presetId: string,
  snapshot: unknown,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ preset?: unknown }>(
    `/api/v1/library/character-presets/${encodeURIComponent(presetId)}/versions`,
    'POST',
    'Host-Charakter-Preset-Version freigeben fehlgeschlagen',
    { snapshot },
    env,
    fetchImpl,
  );
  if (!body.preset) throw new Error('Host-Charakter-Preset-Version: leere Antwort');
  return body.preset;
}

/** CUT-08 — PATCH `/api/v1/library/character-presets/:id`. */
export async function renameHostLibraryCharacterPreset(
  presetId: string,
  displayName: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ preset?: unknown }>(
    `/api/v1/library/character-presets/${encodeURIComponent(presetId)}`,
    'PATCH',
    'Host-Charakter-Preset umbenennen fehlgeschlagen',
    { displayName },
    env,
    fetchImpl,
  );
  if (!body.preset) throw new Error('Host-Charakter-Preset umbenennen: leere Antwort');
  return body.preset;
}

/** CUT-08 — POST `/api/v1/library/character-presets/:id/duplicate`. */
export async function duplicateHostLibraryCharacterPreset(
  presetId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ preset?: unknown }>(
    `/api/v1/library/character-presets/${encodeURIComponent(presetId)}/duplicate`,
    'POST',
    'Host-Charakter-Preset duplizieren fehlgeschlagen',
    {},
    env,
    fetchImpl,
  );
  if (!body.preset) throw new Error('Host-Charakter-Preset duplizieren: leere Antwort');
  return body.preset;
}

/** CUT-08 — DELETE `/api/v1/library/character-presets/:id`. */
export async function deleteHostLibraryCharacterPreset(
  presetId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson<{ ok?: boolean }>(
    `/api/v1/library/character-presets/${encodeURIComponent(presetId)}`,
    'DELETE',
    'Host-Charakter-Preset löschen fehlgeschlagen',
    undefined,
    env,
    fetchImpl,
  );
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

/** Single NPC definition by id (archived rows included when readable). */
export async function fetchHostLibraryNpcCreatureById(
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error('Host-NPC nicht erreichbar');
  let response: Response;
  try {
    response = await fetchImpl(
      `${base}/api/v1/library/npc-creatures/${encodeURIComponent(definitionId)}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    );
  } catch {
    throw new Error('Host-NPC nicht erreichbar');
  }
  if (response.status === 404) return null;
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
    throw new Error(detail ? `Host-NPC laden fehlgeschlagen: ${detail}` : 'Host-NPC laden fehlgeschlagen');
  }
  const body = (await response.json()) as { definition?: unknown };
  return body.definition ?? null;
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

/** CUT-06 — GET `/api/v1/library/items/:id` including archived. */
export async function fetchHostLibraryItem(
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error('Host-Itemkatalog nicht erreichbar');
  let response: Response;
  try {
    response = await fetchImpl(
      `${base}/api/v1/library/items/${encodeURIComponent(definitionId)}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    );
  } catch {
    throw new Error('Host-Itemkatalog nicht erreichbar');
  }
  if (response.status === 404) return null;
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
    throw new Error(
      detail ? `Host-Item laden fehlgeschlagen: ${detail}` : 'Host-Item laden fehlgeschlagen',
    );
  }
  const body = (await response.json()) as { item?: unknown };
  return body.item ?? null;
}

/** CUT-06 — PATCH `/api/v1/library/items/:id`. */
export async function updateHostLibraryItem(
  definitionId: string,
  draft: {
    readonly name?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ item?: unknown }>(
    `/api/v1/library/items/${encodeURIComponent(definitionId)}`,
    'PATCH',
    'Host-Item speichern fehlgeschlagen',
    draft,
    env,
    fetchImpl,
  );
  if (!body.item) throw new Error('Host-Item speichern: leere Antwort');
  return body.item;
}

export async function archiveHostLibraryItem(
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ item?: unknown }>(
    `/api/v1/library/items/${encodeURIComponent(definitionId)}/archive`,
    'POST',
    'Host-Item archivieren fehlgeschlagen',
    {},
    env,
    fetchImpl,
  );
  if (!body.item) throw new Error('Host-Item archivieren: leere Antwort');
  return body.item;
}

export async function restoreHostLibraryItem(
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ item?: unknown }>(
    `/api/v1/library/items/${encodeURIComponent(definitionId)}/restore`,
    'POST',
    'Host-Item wiederherstellen fehlgeschlagen',
    {},
    env,
    fetchImpl,
  );
  if (!body.item) throw new Error('Host-Item wiederherstellen: leere Antwort');
  return body.item;
}

export async function forkHostLibraryItem(
  sourceDefinitionId: string,
  target: {
    readonly origin: 'personal' | 'world';
    readonly worldProfileId?: string | null;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = await hostMutateJson<{ item?: unknown }>(
    `/api/v1/library/items/${encodeURIComponent(sourceDefinitionId)}/fork`,
    'POST',
    'Host-Item forken fehlgeschlagen',
    target,
    env,
    fetchImpl,
  );
  if (!body.item) throw new Error('Host-Item forken: leere Antwort');
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

export type HostNpcControllerAssignmentDto = {
  readonly projectId: string;
  readonly definitionId: string;
  readonly controllerUserId: string | null;
  readonly assignedBy?: string;
  readonly updatedAt?: string;
};

/** CUT-02 — load NPC controller assignment via host product HTTP. */
export async function fetchHostNpcCreatureControllerAssignment(
  projectId: string,
  definitionId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostNpcControllerAssignmentDto | null> {
  const qs = new URLSearchParams({ projectId });
  const body = await hostGetJson<{ assignment?: HostNpcControllerAssignmentDto | null }>(
    `/api/v1/library/npc-creatures/${encodeURIComponent(definitionId)}/controller?${qs.toString()}`,
    'Host-Controller-Zuweisung nicht erreichbar',
    env,
    fetchImpl,
  );
  if (body.assignment === null || body.assignment === undefined) return null;
  if (typeof body.assignment.projectId !== 'string' || typeof body.assignment.definitionId !== 'string') {
    throw new Error('Host-Controller-Zuweisung: ungültige Antwort');
  }
  return body.assignment;
}

/**
 * CUT-02 — assign or clear NPC controller (null clears).
 * Actor is cookie/session only; never send client role claims.
 */
export async function assignHostNpcCreatureController(
  input: {
    readonly projectId: string;
    readonly definitionId: string;
    readonly controllerUserId: string | null;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostNpcControllerAssignmentDto> {
  const body = await hostMutateJson<{ assignment?: HostNpcControllerAssignmentDto }>(
    `/api/v1/library/npc-creatures/${encodeURIComponent(input.definitionId)}/controller`,
    'POST',
    'Host-Controller-Zuweisung fehlgeschlagen',
    {
      projectId: input.projectId,
      controllerUserId: input.controllerUserId,
    },
    env,
    fetchImpl,
  );
  if (!body.assignment || typeof body.assignment.projectId !== 'string') {
    throw new Error('Host-Controller-Zuweisung: leere Antwort');
  }
  return body.assignment;
}

export type HostNpcInstanceDto = {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly definitionId: string;
  readonly displayName: string;
  readonly instanceKind: string;
  readonly sequenceNumber: number;
  readonly snapshot: Record<string, unknown>;
  readonly runtime: Record<string, unknown>;
  readonly createdBy?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

/** CUT-03 — list NPC instances for a project. */
export async function fetchHostNpcInstances(
  projectId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<readonly HostNpcInstanceDto[]> {
  const qs = new URLSearchParams({ projectId });
  const body = await hostGetJson<{ instances?: HostNpcInstanceDto[] }>(
    `/api/v1/library/npc-instances?${qs.toString()}`,
    'Host-NPC-Instanzen nicht erreichbar',
    env,
    fetchImpl,
  );
  if (!Array.isArray(body.instances)) {
    throw new Error('Host-NPC-Instanzen: ungültige Antwort');
  }
  return body.instances;
}

/** CUT-03 — spawn NPC instance via host product HTTP. */
export async function spawnHostNpcInstance(
  input: {
    readonly projectId: string;
    readonly definitionId: string;
    readonly instanceKind: string;
    readonly snapshot: unknown;
    readonly runtime: unknown;
    readonly displayName: string;
    readonly sequenceNumber: number;
    readonly sessionId?: string | null;
  },
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostNpcInstanceDto> {
  const body = await hostMutateJson<{ instance?: HostNpcInstanceDto }>(
    '/api/v1/library/npc-instances',
    'POST',
    'Host-NPC-Instanz erzeugen fehlgeschlagen',
    {
      projectId: input.projectId,
      definitionId: input.definitionId,
      instanceKind: input.instanceKind,
      snapshot: input.snapshot,
      runtime: input.runtime,
      displayName: input.displayName,
      sequenceNumber: input.sequenceNumber,
      sessionId: input.sessionId ?? null,
    },
    env,
    fetchImpl,
  );
  if (!body.instance || typeof body.instance.id !== 'string') {
    throw new Error('Host-NPC-Instanz erzeugen: leere Antwort');
  }
  return body.instance;
}

/** CUT-03 — update instance runtime. */
export async function updateHostNpcInstanceRuntime(
  instanceId: string,
  runtime: unknown,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<HostNpcInstanceDto> {
  const body = await hostMutateJson<{ instance?: HostNpcInstanceDto }>(
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}/runtime`,
    'PATCH',
    'Host-NPC-Instanz-Status fehlgeschlagen',
    { runtime },
    env,
    fetchImpl,
  );
  if (!body.instance || typeof body.instance.id !== 'string') {
    throw new Error('Host-NPC-Instanz-Status: leere Antwort');
  }
  return body.instance;
}

/** CUT-03 — remove instance. */
export async function removeHostNpcInstance(
  instanceId: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostMutateJson(
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}`,
    'DELETE',
    'Host-NPC-Instanz entfernen fehlgeschlagen',
    undefined,
    env,
    fetchImpl,
  );
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
