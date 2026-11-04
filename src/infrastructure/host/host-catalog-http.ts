/**
 * host-catalog-http — FE-HOST-08 marketplace / rulesets / user-profile host client.
 * Location: src/infrastructure/host/host-catalog-http.ts
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { isHostLibraryEnabled } from './host-library-http';
import type {
  CreateMarketplaceItemDTO,
  MarketplaceFilters,
  MarketplaceItem,
  UpdateMarketplaceItemDTO,
} from '../../domains/marketplace/contracts/marketplace.types';
import type { CreateRulesetDTO, Ruleset, UpdateRulesetDTO } from '../../domains/rules/ruleset-catalog';
import type { UserProfileVm } from '../../domains/user-profile';

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

async function hostJson<T>(
  path: string,
  unreachableMessage: string,
  init: RequestInit = {},
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error(unreachableMessage);
  let response: Response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error(unreachableMessage);
  }
  let detail = '';
  let json: unknown = null;
  try {
    json = await response.json();
    if (json && typeof json === 'object' && 'error' in json) {
      detail = String((json as { error: unknown }).error);
    }
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(detail ? `${unreachableMessage}: ${detail}` : unreachableMessage);
  }
  return json as T;
}

export async function fetchHostMarketplaceItems(
  filters?: MarketplaceFilters,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceItem[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.searchQuery) params.set('q', filters.searchQuery);
  if (filters?.minRating !== undefined) params.set('minRating', String(filters.minRating));
  if (filters?.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
  const qs = params.toString();
  const body = await hostJson<{ items?: MarketplaceItem[] }>(
    `/api/v1/marketplace/items${qs ? `?${qs}` : ''}`,
    'Marketplace nicht erreichbar',
    { method: 'GET' },
    env,
    fetchImpl,
  );
  return Array.isArray(body.items) ? body.items : [];
}

export async function fetchHostMarketplaceItem(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceItem | null> {
  try {
    const body = await hostJson<{ item?: MarketplaceItem }>(
      `/api/v1/marketplace/items/${encodeURIComponent(id)}`,
      'Marketplace-Item nicht erreichbar',
      { method: 'GET' },
      env,
      fetchImpl,
    );
    return body.item ?? null;
  } catch (err) {
    if (err instanceof Error && /not-found/i.test(err.message)) return null;
    throw err;
  }
}

export async function fetchHostFeaturedMarketplaceItems(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceItem[]> {
  const body = await hostJson<{ items?: MarketplaceItem[] }>(
    '/api/v1/marketplace/items/featured',
    'Marketplace nicht erreichbar',
    { method: 'GET' },
    env,
    fetchImpl,
  );
  return Array.isArray(body.items) ? body.items : [];
}

export async function createHostMarketplaceItem(
  dto: CreateMarketplaceItemDTO,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceItem> {
  const body = await hostJson<{ item: MarketplaceItem }>(
    '/api/v1/marketplace/items',
    'Marketplace-Anlage fehlgeschlagen',
    { method: 'POST', body: JSON.stringify(dto) },
    env,
    fetchImpl,
  );
  return body.item;
}

export async function updateHostMarketplaceItem(
  id: string,
  dto: UpdateMarketplaceItemDTO,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceItem> {
  const body = await hostJson<{ item: MarketplaceItem }>(
    `/api/v1/marketplace/items/${encodeURIComponent(id)}`,
    'Marketplace-Update fehlgeschlagen',
    { method: 'PATCH', body: JSON.stringify(dto) },
    env,
    fetchImpl,
  );
  return body.item;
}

export async function deleteHostMarketplaceItem(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostJson(
    `/api/v1/marketplace/items/${encodeURIComponent(id)}`,
    'Marketplace-Löschen fehlgeschlagen',
    { method: 'DELETE' },
    env,
    fetchImpl,
  );
}

export async function incrementHostMarketplaceDownloads(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostJson(
    `/api/v1/marketplace/items/${encodeURIComponent(id)}/download`,
    'Download-Zähler fehlgeschlagen',
    { method: 'POST' },
    env,
    fetchImpl,
  );
}

export async function fetchHostRulesets(
  officialOnly = false,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Ruleset[]> {
  const qs = officialOnly ? '?official=1' : '';
  const body = await hostJson<{ rulesets?: Ruleset[] }>(
    `/api/v1/rulesets${qs}`,
    'Rulesets nicht erreichbar',
    { method: 'GET' },
    env,
    fetchImpl,
  );
  return Array.isArray(body.rulesets) ? body.rulesets : [];
}

export async function fetchHostRuleset(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Ruleset | null> {
  try {
    const body = await hostJson<{ ruleset?: Ruleset }>(
      `/api/v1/rulesets/${encodeURIComponent(id)}`,
      'Ruleset nicht erreichbar',
      { method: 'GET' },
      env,
      fetchImpl,
    );
    return body.ruleset ?? null;
  } catch (err) {
    if (err instanceof Error && /not-found/i.test(err.message)) return null;
    throw err;
  }
}

export async function createHostRuleset(
  dto: CreateRulesetDTO,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Ruleset> {
  const body = await hostJson<{ ruleset: Ruleset }>(
    '/api/v1/rulesets',
    'Ruleset-Anlage fehlgeschlagen',
    { method: 'POST', body: JSON.stringify(dto) },
    env,
    fetchImpl,
  );
  return body.ruleset;
}

export async function updateHostRuleset(
  dto: UpdateRulesetDTO,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<Ruleset> {
  const { id, ...patch } = dto;
  const body = await hostJson<{ ruleset: Ruleset }>(
    `/api/v1/rulesets/${encodeURIComponent(id)}`,
    'Ruleset-Update fehlgeschlagen',
    { method: 'PATCH', body: JSON.stringify(patch) },
    env,
    fetchImpl,
  );
  return body.ruleset;
}

export async function deleteHostRuleset(
  id: string,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await hostJson(
    `/api/v1/rulesets/${encodeURIComponent(id)}`,
    'Ruleset-Löschen fehlgeschlagen',
    { method: 'DELETE' },
    env,
    fetchImpl,
  );
}

export async function fetchHostOwnUserProfile(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfileVm | null> {
  const body = await hostJson<{ profile?: UserProfileVm | null }>(
    '/api/v1/user-profile/me',
    'Profil nicht erreichbar',
    { method: 'GET' },
    env,
    fetchImpl,
  );
  return body.profile ?? null;
}

/** FE-HOST-14: peer lobby profiles via host batch (no PostgREST). */
export async function fetchHostProfilesByUserIds(
  userIds: readonly string[],
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfileVm[]> {
  if (userIds.length === 0) return [];
  const body = await hostJson<{ profiles?: UserProfileVm[] }>(
    '/api/v1/user-profile/batch',
    'Fremde Profile nicht erreichbar',
    {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    },
    env,
    fetchImpl,
  );
  return Array.isArray(body.profiles) ? body.profiles : [];
}

export async function uploadHostUserAvatar(
  file: File,
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfileVm> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.length; i += 1) {
    binary += String.fromCharCode(buffer[i]!);
  }
  const body = await hostJson<{ profile: UserProfileVm }>(
    '/api/v1/user-profile/me/avatars',
    'Avatar-Upload fehlgeschlagen',
    {
      method: 'POST',
      body: JSON.stringify({
        contentType: file.type || 'image/png',
        base64: btoa(binary),
      }),
    },
    env,
    fetchImpl,
  );
  return body.profile;
}
