/**
 * World map / atlas / places product HTTP — FE-HOST-03 dual-path over WorldPorts.
 * Location: server/src/api/world-atlas-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 * CUT-10b: world-scoped asset publish authorizes world.edit before AssetPorts.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { PermissionsPorts } from '../modules/permissions/index.ts';
import type { WorldPorts } from '../modules/world/index.ts';
import {
  DEFAULT_ASSET_MAX_BYTES,
  type AssetPorts,
} from '../assets/index.ts';
import { authDenyStatus } from './errors.ts';

export type WorldAtlasHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly world?: WorldPorts | null;
  /** CUT-10b — world.edit gate for map-pin / azgaar uploads. */
  readonly permissions?: PermissionsPorts | null;
  readonly assets?: AssetPorts | null;
};

const MAP_PIN_PURPOSE = 'map-pin';
const AZGAAR_PURPOSE = 'azgaar';
const MAP_PIN_MAX_BYTES = 5 * 1024 * 1024;
const AZGAAR_MAX_BYTES = DEFAULT_ASSET_MAX_BYTES;
const MAP_PIN_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const AZGAAR_MIME = new Set([
  'application/json',
  'application/zip',
  'application/octet-stream',
  'text/plain',
]);

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
  if (
    error === 'STALE_REVISION' ||
    error === 'revision-conflict' ||
    error === '40001' ||
    /revision conflict/i.test(error)
  ) {
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

function sniffRasterMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function sniffAzgaarMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return 'application/zip';
  }
  let i = 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) {
    i += 1;
  }
  if (i >= bytes.length) return null;
  // JSON export
  if (bytes[i] === 0x7b || bytes[i] === 0x5b) {
    return 'application/json';
  }
  // Native Azgaar Fantasy Map Generator `.map` is plain text (often a version
  // line first, not `{`/`[`). Accept printable UTF-8/ASCII text payloads.
  const sampleEnd = Math.min(bytes.length, i + 512);
  let printable = 0;
  let checked = 0;
  for (let j = i; j < sampleEnd; j += 1) {
    const b = bytes[j]!;
    checked += 1;
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e) || b >= 0x80) {
      printable += 1;
    }
  }
  if (checked > 0 && printable / checked >= 0.95) {
    return 'text/plain';
  }
  return null;
}

async function readWorldAssetBytes(c: {
  req: {
    header: (name: string) => string | undefined;
    parseBody: () => Promise<Record<string, unknown>>;
  };
}): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string; purpose: string }
  | { ok: false; status: number; error: string }
> {
  const contentTypeHeader = (c.req.header('content-type') ?? '').toLowerCase();
  if (!contentTypeHeader.includes('multipart/form-data')) {
    return { ok: false, status: 400, error: 'invalid-multipart' };
  }
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    return { ok: false, status: 400, error: 'invalid-multipart' };
  }
  const file = body.file ?? body.bytes ?? body.asset;
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return { ok: false, status: 400, error: 'missing-file' };
  }
  const blob = file as File;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength === 0) return { ok: false, status: 400, error: 'empty-bytes' };
  const purpose =
    typeof body.purpose === 'string' && body.purpose.trim().length > 0
      ? body.purpose.trim()
      : '';
  if (purpose !== MAP_PIN_PURPOSE && purpose !== AZGAAR_PURPOSE) {
    return { ok: false, status: 400, error: 'invalid-purpose' };
  }
  const declared =
    typeof blob.type === 'string' && blob.type.trim().length > 0
      ? blob.type.trim().toLowerCase()
      : typeof body.contentType === 'string'
        ? body.contentType.trim().toLowerCase()
        : 'application/octet-stream';
  return { ok: true, bytes, contentType: declared, purpose };
}

/**
 * Mount world map / atlas / places endpoints for browser cutover.
 */
export function mountWorldAtlasHttpRoutes(app: Hono, deps: WorldAtlasHttpDeps): void {
  if (!deps.world) return;
  const world = deps.world;

  /** CUT-10b — owner/GM world.edit → AssetPorts (never actor-only /api/v1/assets). */
  app.post('/api/v1/worlds/:worldId/assets', async (c) => {
    const actorResult = await resolveWorldActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.permissions) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    if (!deps.assets) {
      return c.json({ error: 'store-unavailable' }, 503);
    }

    const worldId = c.req.param('worldId').trim();
    if (!worldId) return c.json({ error: 'missing-world' }, 400);

    const decision = deps.permissions.authorize('world.edit', actorResult.actor, { worldId });
    if (!decision.allow) {
      return c.json(
        {
          error:
            decision.reason === 'missing-world' || decision.reason === 'world-not-found'
              ? 'missing-world'
              : 'not-authorized',
        },
        decision.reason === 'missing-world' || decision.reason === 'world-not-found' ? 404 : 403,
      );
    }

    const parsed = await readWorldAssetBytes(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, parsed.status);
    }

    let contentType: string;
    if (parsed.purpose === MAP_PIN_PURPOSE) {
      if (parsed.bytes.byteLength > MAP_PIN_MAX_BYTES) {
        return c.json({ error: 'bytes-too-large' }, 413);
      }
      const sniffed = sniffRasterMime(parsed.bytes);
      if (!sniffed || !MAP_PIN_MIME.has(sniffed)) {
        return c.json({ error: 'invalid-content-type' }, 400);
      }
      if (
        parsed.contentType !== 'application/octet-stream' &&
        MAP_PIN_MIME.has(parsed.contentType) &&
        parsed.contentType !== sniffed
      ) {
        return c.json({ error: 'content-type-mismatch' }, 400);
      }
      contentType = sniffed;
    } else {
      if (parsed.bytes.byteLength > AZGAAR_MAX_BYTES) {
        return c.json({ error: 'bytes-too-large' }, 413);
      }
      const sniffed = sniffAzgaarMime(parsed.bytes);
      if (!sniffed) {
        return c.json({ error: 'invalid-content-type' }, 400);
      }
      if (
        parsed.contentType !== 'application/octet-stream' &&
        !AZGAAR_MIME.has(parsed.contentType)
      ) {
        return c.json({ error: 'content-type-mismatch' }, 400);
      }
      contentType = sniffed;
    }

    const published = deps.assets.publish(actorResult.actor, {
      bytes: parsed.bytes,
      contentType,
    });
    if (!published.ok) {
      const status =
        published.error === 'not-authorized' || published.error === 'missing-actor'
          ? 403
          : published.error === 'bytes-too-large'
            ? 413
            : published.error === 'store-unavailable'
              ? 503
              : 400;
      return c.json({ error: published.error }, status);
    }

    const origin = new URL(c.req.url).origin;
    const storagePath = `${actorResult.actor.actorId}/${published.value.assetId}`;
    return c.json(
      {
        assetId: published.value.assetId,
        contentType: published.value.contentType,
        byteSize: published.value.byteSize,
        checksumSha256: published.value.checksumSha256,
        url: `${origin}/api/v1/assets/${encodeURIComponent(published.value.assetId)}`,
        storagePath,
        purpose: parsed.purpose,
        worldProfileId: worldId,
      },
      201,
    );
  });

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
