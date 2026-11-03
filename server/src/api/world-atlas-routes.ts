/**
 * World map / atlas / places product HTTP — FE-HOST-03 dual-path over WorldPorts.
 * Location: server/src/api/world-atlas-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { WorldPorts } from '../modules/world/index.ts';
import { authDenyStatus } from './errors.ts';

export type WorldAtlasHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly world?: WorldPorts | null;
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

async function resolveWorldActor(
  deps: WorldAtlasHttpDeps,
  headers: Headers,
  allowSameOriginRead: boolean,
  body?: unknown,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead,
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

function worldStatus(error: string): number {
  if (
    error === 'UNAUTHENTICATED' ||
    error === 'FORBIDDEN' ||
    error === '42501' ||
    error === 'not-authorized' ||
    /forbidden/i.test(error)
  ) {
    return 403;
  }
  if (
    error === 'missing-world' ||
    error === 'world-not-found' ||
    error === 'P0002' ||
    error === 'map-not-found' ||
    error === 'place-not-found' ||
    /not[_-]?found/i.test(error)
  ) {
    return 404;
  }
  if (error === 'STALE_REVISION' || error === 'revision-conflict' || /revision conflict/i.test(error)) {
    return 409;
  }
  if (error === '22023' || error === 'INVALID_PAYLOAD' || error === 'INVALID_OPERATION') {
    return 422;
  }
  if (error === 'store-unavailable' || error === 'DATABASE_BUSY') return 503;
  return 400;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function queryBool(raw: string | undefined): boolean {
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function querySaga(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalObject(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Mount world map / atlas / places endpoints for browser cutover.
 */
export function mountWorldAtlasHttpRoutes(app: Hono, deps: WorldAtlasHttpDeps): void {
  if (!deps.world) return;
  const world = deps.world;

  app.get('/api/v1/worlds/:worldId/map', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const playerView = queryBool(c.req.query('playerView'));
    const result = world.getWorldMap(actorResult.actor, c.req.param('worldId'), playerView);
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.put('/api/v1/worlds/:worldId/map', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const expectedRevision =
      typeof body.expectedRevision === 'number' && Number.isFinite(body.expectedRevision)
        ? body.expectedRevision
        : null;
    const mapData = optionalObject(body.mapData) ?? optionalObject(body.data);
    if (!mapData) return c.json({ error: '22023' }, 422);
    const result = world.saveWorldMap(
      actorResult.actor,
      c.req.param('worldId'),
      expectedRevision,
      mapData,
    );
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/worlds/:worldId/atlas/maps', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.listWorldAtlasMaps(
      actorResult.actor,
      c.req.param('worldId'),
      queryBool(c.req.query('playerView')),
      querySaga(c.req.query('sagaPublicId')),
    );
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json({ maps: result.value }, 200);
  });

  app.post('/api/v1/worlds/:worldId/atlas/ensure-root', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.ensureWorldAtlasRoot(actorResult.actor, c.req.param('worldId'));
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json({ maps: result.value }, 200);
  });

  app.get('/api/v1/worlds/atlas/maps/:mapId', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.getWorldAtlasMap(
      actorResult.actor,
      c.req.param('mapId'),
      queryBool(c.req.query('playerView')),
      querySaga(c.req.query('sagaPublicId')),
    );
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.put('/api/v1/worlds/:worldId/atlas/maps', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.upsertWorldAtlasMap(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      mapId: optionalString(body.mapId),
      parentMapId: optionalString(body.parentMapId),
      kind: typeof body.kind === 'string' ? body.kind : null,
      title: typeof body.title === 'string' ? body.title : null,
      sortOrder: optionalNumber(body.sortOrder),
      bounds: optionalObject(body.bounds),
      layers: optionalObject(body.layers),
      basemapStoragePath: optionalString(body.basemapStoragePath),
      azgaarMapStoragePath: optionalString(body.azgaarMapStoragePath),
      generatorMeta: optionalObject(body.generatorMeta),
      expectedRevision: optionalNumber(body.expectedRevision),
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/worlds/:worldId/places', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.listWorldPlaces(
      actorResult.actor,
      c.req.param('worldId'),
      queryBool(c.req.query('playerView')),
      querySaga(c.req.query('sagaPublicId')),
    );
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json({ places: result.value }, 200);
  });

  app.put('/api/v1/worlds/:worldId/places', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (typeof body.kind !== 'string' || typeof body.name !== 'string') {
      return c.json({ error: '22023' }, 422);
    }
    const result = world.upsertWorldPlace(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: optionalString(body.placeId),
      parentPlaceId: optionalString(body.parentPlaceId),
      kind: body.kind,
      name: body.name,
      description: optionalString(body.description),
      status: optionalString(body.status),
      seedKey: optionalString(body.seedKey),
      sortOrder: optionalNumber(body.sortOrder),
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/worlds/:worldId/place-map-links', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.listWorldPlaceMapLinks(
      actorResult.actor,
      c.req.param('worldId'),
      queryBool(c.req.query('playerView')),
      querySaga(c.req.query('sagaPublicId')),
    );
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json({ links: result.value }, 200);
  });

  app.put('/api/v1/worlds/:worldId/place-map-links', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (
      typeof body.placeId !== 'string' ||
      typeof body.mapId !== 'string' ||
      typeof body.usage !== 'string'
    ) {
      return c.json({ error: '22023' }, 422);
    }
    const result = world.upsertWorldPlaceMapLink(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: body.placeId,
      mapId: body.mapId,
      usage: body.usage,
      featureId: optionalString(body.featureId),
      anchor: optionalObject(body.anchor),
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (
      typeof body.kind !== 'string' ||
      typeof body.name !== 'string' ||
      typeof body.idempotencyKey !== 'string'
    ) {
      return c.json({ error: '22023' }, 422);
    }
    const result = world.createWorldNodeWithMaps(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      kind: body.kind,
      name: body.name,
      idempotencyKey: body.idempotencyKey,
      subtype: optionalString(body.subtype),
      parentPlaceId: optionalString(body.parentPlaceId),
      description: optionalString(body.description),
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 201);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/preview-consequences', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.previewWorldNodeConsequences(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/rename', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (typeof body.name !== 'string') return c.json({ error: '22023' }, 422);
    const result = world.renameWorldNode(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
      name: body.name,
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/reparent', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.reparentWorldNode(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
      newParentPlaceId: optionalString(body.newParentPlaceId),
      confirmRelocate: body.confirmRelocate === true,
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/duplicate', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.duplicateWorldNode(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
      deep: body.deep === true,
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/archive', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.archiveWorldNodeSubtree(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
      confirm: body.confirm === true,
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/worlds/:worldId/nodes/:placeId/delete', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = world.deleteWorldNode(actorResult.actor, {
      worldProfileId: c.req.param('worldId'),
      placeId: c.req.param('placeId'),
      confirm: body.confirm === true,
    });
    if (!result.ok) return c.json({ error: result.error }, worldStatus(result.error));
    return c.json(result.value, 200);
  });
}
