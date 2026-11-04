/**
 * Catalog HTTP adapters — marketplace, rulesets, user-profile (FE-HOST-08).
 * Location: server/src/api/catalog-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 * Client-claimed owner ids are never authorization.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { MarketplacePorts } from '../modules/marketplace/index.ts';
import type { RulesetPorts } from '../modules/rulesets/index.ts';
import type { UserProfilePorts } from '../modules/user-profile/index.ts';
import { authDenyStatus } from './errors.ts';

export type CatalogHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly marketplace?: MarketplacePorts | null;
  readonly rulesets?: RulesetPorts | null;
  readonly userProfile?: UserProfilePorts | null;
};

function normalizeHostname(hostname: string): string {
  const raw = hostname.trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

function isLoopbackHost(hostname: string | null): boolean {
  if (!hostname) return false;
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function requestHostName(headers: Headers): string | null {
  const host = headers.get('host');
  if (!host) return null;
  try {
    return normalizeHostname(new URL(`http://${host}`).hostname);
  } catch {
    return null;
  }
}

function soloLoopbackAllowed(headers: Headers): boolean {
  if (!isLoopbackHost(requestHostName(headers))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return isLoopbackHost(normalizeHostname(new URL(origin).hostname));
  } catch {
    return false;
  }
}

async function resolveCatalogActor(
  deps: CatalogHttpDeps,
  headers: Headers,
  body?: unknown,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead: true,
    body,
  });
  if (remote.ok) return { ok: true, actor: remote.actor };
  if (
    deps.hostMode === 'solo' &&
    remote.code === 'AUTH_NOT_CONFIGURED' &&
    soloLoopbackAllowed(headers)
  ) {
    return { ok: true, actor: deps.identity.resolveSoloActor() };
  }
  return { ok: false, status: authDenyStatus(remote.code), error: remote.code };
}

async function readJsonSafe(c: {
  req: { json: () => Promise<unknown>; text: () => Promise<string> };
}): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const text = await c.req.text();
    if (!text || text.trim().length === 0) return { ok: true, body: {} };
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function portStatus(error: string): number {
  if (
    error === '42501' ||
    error.startsWith('42501') ||
    error === 'not-authorized' ||
    error === 'missing-actor' ||
    error === 'ORIGIN_DENIED' ||
    error === 'HOST_DENIED'
  ) {
    return 403;
  }
  if (error === 'not-found' || error === 'missing-ruleset') return 404;
  if (error === 'invalid-item-id' || error === 'invalid-author-id') return 400;
  return 400;
}

function mapMarketplaceItem(row: {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description: string | null;
  readonly authorId: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly rating: number;
  readonly downloads: number;
  readonly price: number;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    author_id: row.authorId,
    data: row.data,
    rating: row.rating,
    downloads: row.downloads,
    price: row.price,
    image_url: row.imageUrl,
    tags: [...row.tags],
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function mapRuleset(row: {
  readonly id: string;
  readonly creatorUserId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly version: string | null;
  readonly attributesConfig: { readonly primary: string[]; readonly derived: string[] };
  readonly skillsConfig: readonly { readonly name: string; readonly ability: string }[];
  readonly classesConfig: readonly { readonly name: string; readonly hit_die: string }[];
  readonly racesConfig: readonly {
    readonly name: string;
    readonly speed: number;
    readonly size: string;
  }[];
  readonly combatRules: Record<string, unknown>;
  readonly diceRules: Record<string, unknown>;
  readonly levelProgression: Record<string, unknown>;
  readonly isOfficial: boolean;
  readonly isPublic: boolean;
  readonly isMarketplaceItem: boolean;
  readonly downloadsCount: number;
  readonly rating: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return {
    id: row.id,
    creator_user_id: row.creatorUserId,
    name: row.name,
    description: row.description,
    version: row.version,
    attributes_config: row.attributesConfig,
    skills_config: [...row.skillsConfig],
    classes_config: [...row.classesConfig],
    races_config: [...row.racesConfig],
    combat_rules: row.combatRules,
    dice_rules: row.diceRules,
    level_progression: row.levelProgression,
    is_official: row.isOfficial,
    is_public: row.isPublic,
    is_marketplace_item: row.isMarketplaceItem,
    downloads_count: row.downloadsCount,
    rating: row.rating,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function mountCatalogHttpRoutes(app: Hono, deps: CatalogHttpDeps): void {
  // --- Marketplace ---
  app.get('/api/v1/marketplace/items', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const q = c.req.query();
    const listed = deps.marketplace.listItems({
      type: (q.type as 'all' | undefined) ?? 'all',
      searchQuery: q.q || q.searchQuery || undefined,
      minRating: q.minRating ? Number(q.minRating) : undefined,
      maxPrice: q.maxPrice ? Number(q.maxPrice) : undefined,
      sortBy: (q.sortBy as 'downloads' | undefined) ?? 'downloads',
      sortOrder: (q.sortOrder as 'desc' | undefined) ?? 'desc',
    });
    if (!listed.ok) return c.json({ error: listed.error }, portStatus(listed.error));
    return c.json({ items: listed.value.map(mapMarketplaceItem) }, 200);
  });

  app.get('/api/v1/marketplace/items/featured', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const listed = deps.marketplace.listFeatured();
    if (!listed.ok) return c.json({ error: listed.error }, portStatus(listed.error));
    return c.json({ items: listed.value.map(mapMarketplaceItem) }, 200);
  });

  app.get('/api/v1/marketplace/items/:id', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const got = deps.marketplace.getItemById(c.req.param('id'));
    if (!got.ok) return c.json({ error: got.error }, portStatus(got.error));
    if (!got.value) return c.json({ error: 'not-found' }, 404);
    return c.json({ item: mapMarketplaceItem(got.value) }, 200);
  });

  app.post('/api/v1/marketplace/items', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'invalid-json' }, 400);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const body = parsed.body && typeof parsed.body === 'object' ? (parsed.body as Record<string, unknown>) : {};
    const type = typeof body.type === 'string' ? body.type : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const data =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    if (!type || !title.trim()) return c.json({ error: 'invalid-payload' }, 400);
    const created = deps.marketplace.createItem(actorResult.actor, {
      type: type as 'world' | 'adventure' | 'character' | 'item' | 'ruleset',
      title: title.trim(),
      description: typeof body.description === 'string' ? body.description : null,
      data,
      price: typeof body.price === 'number' ? body.price : undefined,
      imageUrl: typeof body.image_url === 'string' ? body.image_url : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [],
    });
    if (!created.ok) return c.json({ error: created.error }, portStatus(created.error));
    return c.json({ item: mapMarketplaceItem(created.value) }, 201);
  });

  app.patch('/api/v1/marketplace/items/:id', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'invalid-json' }, 400);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const body = parsed.body && typeof parsed.body === 'object' ? (parsed.body as Record<string, unknown>) : {};
    const patch: {
      title?: string;
      description?: string | null;
      data?: Record<string, unknown>;
      price?: number;
      imageUrl?: string | null;
      tags?: string[];
    } = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (body.description === null || typeof body.description === 'string') {
      patch.description = body.description as string | null;
    }
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      patch.data = body.data as Record<string, unknown>;
    }
    if (typeof body.price === 'number') patch.price = body.price;
    if (body.image_url === null || typeof body.image_url === 'string') {
      patch.imageUrl = body.image_url as string | null;
    }
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.filter((t): t is string => typeof t === 'string');
    }
    const updated = deps.marketplace.updateItem(actorResult.actor, c.req.param('id'), patch);
    if (!updated.ok) return c.json({ error: updated.error }, portStatus(updated.error));
    return c.json({ item: mapMarketplaceItem(updated.value) }, 200);
  });

  app.delete('/api/v1/marketplace/items/:id', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const deleted = deps.marketplace.deleteItem(actorResult.actor, c.req.param('id'));
    if (!deleted.ok) return c.json({ error: deleted.error }, portStatus(deleted.error));
    return c.json({ ok: true, deleted: deleted.value }, 200);
  });

  app.post('/api/v1/marketplace/items/:id/download', async (c) => {
    if (!deps.marketplace) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const bumped = deps.marketplace.incrementDownloads(actorResult.actor, c.req.param('id'));
    if (!bumped.ok) return c.json({ error: bumped.error }, portStatus(String(bumped.error)));
    return c.json({ ok: true, downloads: bumped.downloads }, 200);
  });

  // --- Rulesets ---
  app.get('/api/v1/rulesets', async (c) => {
    if (!deps.rulesets) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const officialOnly = c.req.query('official') === '1' || c.req.query('official') === 'true';
    const listed = officialOnly
      ? deps.rulesets.listOfficial(actorResult.actor)
      : deps.rulesets.listAll(actorResult.actor);
    if (!listed.ok) return c.json({ error: listed.error }, portStatus(listed.error));
    return c.json({ rulesets: listed.value.map(mapRuleset) }, 200);
  });

  app.get('/api/v1/rulesets/:id', async (c) => {
    if (!deps.rulesets) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const got = deps.rulesets.getById(actorResult.actor, c.req.param('id'));
    if (!got.ok) return c.json({ error: got.error }, portStatus(got.error));
    return c.json({ ruleset: mapRuleset(got.value) }, 200);
  });

  app.post('/api/v1/rulesets', async (c) => {
    if (!deps.rulesets) return c.json({ error: 'not-configured' }, 503);
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'invalid-json' }, 400);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const body = parsed.body && typeof parsed.body === 'object' ? (parsed.body as Record<string, unknown>) : {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const attributesConfig = parseAttributesConfig(body.attributes_config);
    if (!name || !attributesConfig) {
      return c.json({ error: 'invalid-payload' }, 400);
    }
    const created = deps.rulesets.create(actorResult.actor, {
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      version: typeof body.version === 'string' ? body.version : undefined,
      attributesConfig,
      skillsConfig: parseSkillsConfig(body.skills_config),
      classesConfig: parseClassesConfig(body.classes_config),
      racesConfig: parseRacesConfig(body.races_config),
      combatRules: parseRecordObject(body.combat_rules),
      diceRules: parseRecordObject(body.dice_rules),
      isPublic: body.is_public === true,
    });
    if (!created.ok) return c.json({ error: created.error }, portStatus(created.error));
    return c.json({ ruleset: mapRuleset(created.value) }, 201);
  });

  app.patch('/api/v1/rulesets/:id', async (c) => {
    if (!deps.rulesets) return c.json({ error: 'not-configured' }, 503);
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'invalid-json' }, 400);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const body = parsed.body && typeof parsed.body === 'object' ? (parsed.body as Record<string, unknown>) : {};
    const updated = deps.rulesets.update(actorResult.actor, {
      id: c.req.param('id'),
      name: typeof body.name === 'string' ? body.name : undefined,
      description:
        body.description === null || typeof body.description === 'string'
          ? (body.description as string | null)
          : undefined,
      version:
        body.version === null || typeof body.version === 'string'
          ? (body.version as string | null)
          : undefined,
      attributesConfig: parseAttributesConfig(body.attributes_config) ?? undefined,
      skillsConfig: parseSkillsConfig(body.skills_config),
      classesConfig: parseClassesConfig(body.classes_config),
      racesConfig: parseRacesConfig(body.races_config),
      combatRules: parseRecordObject(body.combat_rules),
      diceRules: parseRecordObject(body.dice_rules),
      isPublic: typeof body.is_public === 'boolean' ? body.is_public : undefined,
    });
    if (!updated.ok) return c.json({ error: updated.error }, portStatus(updated.error));
    return c.json({ ruleset: mapRuleset(updated.value) }, 200);
  });

  app.delete('/api/v1/rulesets/:id', async (c) => {
    if (!deps.rulesets) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const removed = deps.rulesets.remove(actorResult.actor, c.req.param('id'));
    if (!removed.ok) return c.json({ error: removed.error }, portStatus(removed.error));
    return c.json({ ok: true, id: removed.value.id }, 200);
  });

  // --- User profile ---
  app.get('/api/v1/user-profile/me', async (c) => {
    if (!deps.userProfile) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const ensured = deps.userProfile.ensureOwnProfileRow(actorResult.actor);
    if (!ensured.ok) return c.json({ error: ensured.error }, portStatus(ensured.error));
    const got = deps.userProfile.getOwnProfile(actorResult.actor);
    if (!got.ok) return c.json({ error: got.error }, portStatus(got.error));
    return c.json({ profile: got.value }, 200);
  });

  app.post('/api/v1/user-profile/me/avatars', async (c) => {
    if (!deps.userProfile) return c.json({ error: 'not-configured' }, 503);
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'invalid-json' }, 400);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const body = parsed.body && typeof parsed.body === 'object' ? (parsed.body as Record<string, unknown>) : {};
    const contentType = typeof body.contentType === 'string' ? body.contentType : '';
    const base64 = typeof body.base64 === 'string' ? body.base64 : '';
    if (!contentType || !base64) return c.json({ error: 'invalid-payload' }, 400);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    } catch {
      return c.json({ error: 'invalid-payload' }, 400);
    }
    const uploaded = deps.userProfile.uploadAvatar(actorResult.actor, {
      contentType,
      bytes,
      claimedOwnerUserId:
        typeof body.claimedOwnerUserId === 'string' ? body.claimedOwnerUserId : undefined,
    });
    if (!uploaded.ok) return c.json({ error: uploaded.error }, portStatus(uploaded.error));
    return c.json({ profile: uploaded.value }, 200);
  });

  app.get('/api/v1/user-profile/me/avatar', async (c) => {
    if (!deps.userProfile) return c.json({ error: 'not-configured' }, 503);
    const actorResult = await resolveCatalogActor(deps, c.req.raw.headers);
    if (!actorResult.ok) return c.json({ error: actorResult.error }, actorResult.status);
    const got = deps.userProfile.readOwnAvatarBytes(actorResult.actor);
    if (!got.ok) return c.json({ error: got.error }, portStatus(got.error));
    return new Response(got.value.bytes, {
      status: 200,
      headers: {
        'content-type': got.value.contentType,
        'cache-control': 'private, max-age=60',
      },
    });
  });
}

function parseAttributesConfig(
  raw: unknown,
): { primary: string[]; derived: string[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const attrs = raw as { primary?: unknown; derived?: unknown };
  return {
    primary: Array.isArray(attrs.primary)
      ? attrs.primary.filter((x): x is string => typeof x === 'string')
      : [],
    derived: Array.isArray(attrs.derived)
      ? attrs.derived.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

function parseSkillsConfig(
  raw: unknown,
): { name: string; ability: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { name: string; ability: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as { name?: unknown; ability?: unknown };
    if (typeof row.name === 'string' && typeof row.ability === 'string') {
      out.push({ name: row.name, ability: row.ability });
    }
  }
  return out;
}

function parseClassesConfig(
  raw: unknown,
): { name: string; hit_die: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { name: string; hit_die: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as { name?: unknown; hit_die?: unknown };
    if (typeof row.name === 'string' && typeof row.hit_die === 'string') {
      out.push({ name: row.name, hit_die: row.hit_die });
    }
  }
  return out;
}

function parseRacesConfig(
  raw: unknown,
): { name: string; speed: number; size: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { name: string; speed: number; size: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as { name?: unknown; speed?: unknown; size?: unknown };
    if (
      typeof row.name === 'string' &&
      typeof row.speed === 'number' &&
      typeof row.size === 'string'
    ) {
      out.push({ name: row.name, speed: row.speed, size: row.size });
    }
  }
  return out;
}

function parseRecordObject(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}
