/**
 * Asset HTTP adapters — browser cutover for owner-scoped publish/get (FE-HOST-06).
 * Location: server/src/api/asset-routes.ts
 *
 * Actor from session / solo AUTH_NOT_CONFIGURED loopback only.
 * Path/URL is never authorization — AssetPorts + policy own the gate.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { AssetPorts } from '../assets/index.ts';
import { authDenyStatus } from './errors.ts';

export type AssetHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly assets?: AssetPorts | null;
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

async function resolveAssetActor(
  deps: AssetHttpDeps,
  headers: Headers,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead: true,
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

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/octet-stream',
]);

function decodeBase64Bytes(value: string): Uint8Array | null {
  try {
    const buf = Buffer.from(value, 'base64');
    if (buf.byteLength === 0) return null;
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

async function readPublishBytes(
  c: { req: { header: (name: string) => string | undefined; parseBody: () => Promise<Record<string, unknown>>; json: () => Promise<unknown>; arrayBuffer: () => Promise<ArrayBuffer> } },
): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; status: number; error: string }
> {
  const contentTypeHeader = (c.req.header('content-type') ?? '').toLowerCase();

  if (contentTypeHeader.includes('multipart/form-data')) {
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
    const declared =
      typeof blob.type === 'string' && blob.type.trim().length > 0
        ? blob.type.trim()
        : typeof body.contentType === 'string'
          ? body.contentType.trim()
          : 'application/octet-stream';
    return { ok: true, bytes, contentType: declared };
  }

  if (contentTypeHeader.includes('application/json')) {
    let parsed: unknown;
    try {
      parsed = await c.req.json();
    } catch {
      return { ok: false, status: 400, error: 'invalid-json' };
    }
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const b64 =
      typeof record.bytesBase64 === 'string'
        ? record.bytesBase64
        : typeof record.bytes === 'string'
          ? record.bytes
          : null;
    if (!b64) return { ok: false, status: 400, error: 'missing-bytes' };
    const bytes = decodeBase64Bytes(b64);
    if (!bytes) return { ok: false, status: 400, error: 'invalid-bytes' };
    const declared =
      typeof record.contentType === 'string' && record.contentType.trim().length > 0
        ? record.contentType.trim()
        : 'application/octet-stream';
    return { ok: true, bytes, contentType: declared };
  }

  // Raw body with Content-Type (optional fallback for tests).
  try {
    const buf = await c.req.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.byteLength === 0) return { ok: false, status: 400, error: 'empty-bytes' };
    const declared =
      contentTypeHeader.split(';')[0]?.trim() || 'application/octet-stream';
    return { ok: true, bytes, contentType: declared };
  } catch {
    return { ok: false, status: 400, error: 'invalid-body' };
  }
}

/**
 * Mount owner-scoped asset publish/get endpoints for the Vite Library / CharacterEditor.
 */
export function mountAssetHttpRoutes(app: Hono, deps: AssetHttpDeps): void {
  app.post('/api/v1/assets', async (c) => {
    const actorResult = await resolveAssetActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.assets) {
      return c.json({ error: 'store-unavailable' }, 503);
    }

    const parsed = await readPublishBytes(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, parsed.status);
    }

    if (!ALLOWED_IMAGE_TYPES.has(parsed.contentType) && !parsed.contentType.startsWith('image/')) {
      return c.json({ error: 'invalid-content-type' }, 400);
    }

    const published = deps.assets.publish(actorResult.actor, {
      bytes: parsed.bytes,
      contentType: parsed.contentType,
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
    return c.json(
      {
        assetId: published.value.assetId,
        contentType: published.value.contentType,
        byteSize: published.value.byteSize,
        checksumSha256: published.value.checksumSha256,
        url: `${origin}/api/v1/assets/${encodeURIComponent(published.value.assetId)}`,
        storagePath: `${actorResult.actor.actorId}/${published.value.assetId}`,
      },
      201,
    );
  });

  app.get('/api/v1/assets/:assetId', async (c) => {
    const actorResult = await resolveAssetActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.assets) {
      return c.json({ error: 'store-unavailable' }, 503);
    }

    const assetId = c.req.param('assetId');
    const got = deps.assets.get(actorResult.actor, assetId);
    if (!got.ok) {
      if (got.error === 'path-traversal-denied') {
        return c.json({ error: 'path-traversal-denied' }, 400);
      }
      // Foreign owner → 403; missing → 404 (stable empty/not-found UX).
      if (got.error === 'not-authorized') {
        return c.json({ error: 'not-found' }, 403);
      }
      return c.json({ error: 'not-found' }, 404);
    }

    return new Response(got.value.bytes, {
      status: 200,
      headers: {
        'content-type': got.value.contentType,
        'content-length': String(got.value.byteSize),
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
}

/**
 * Normalize FE portrait_url (display URL or owner path) into owner-scoped storage path.
 * Returns undefined when the field is omitted; null when cleared.
 */
export function normalizePortraitStoragePath(
  actor: Actor,
  raw: unknown,
  assets: AssetPorts | null | undefined,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'invalid-storage-path' };

  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };

  const actorId = actor.actorId;
  const ownerPrefix = `${actorId}/`;
  if (trimmed.startsWith(ownerPrefix) && !trimmed.includes('..')) {
    const rest = trimmed.slice(ownerPrefix.length);
    if (rest.length > 0 && !rest.includes('/')) {
      return { ok: true, value: trimmed.replace(/^\/+/, '') };
    }
  }

  const pathMatch = trimmed.match(/\/api\/v1\/assets\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})\/?$/);
  const assetId = pathMatch?.[1] ?? null;
  if (!assetId) return { ok: false, error: 'invalid-storage-path' };
  if (!assets) return { ok: false, error: 'store-unavailable' };

  const got = assets.get(actor, assetId);
  if (!got.ok) {
    return {
      ok: false,
      error: got.error === 'not-authorized' ? 'foreign-storage-path' : 'invalid-storage-path',
    };
  }

  return { ok: true, value: `${actorId}/${assetId}` };
}

/** Expand stored owner/assetId path to a credentialed host display URL. */
export function expandPortraitDisplayUrl(
  storagePath: string | null,
  origin: string,
): string | null {
  if (!storagePath || storagePath.length === 0) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const slash = storagePath.indexOf('/');
  if (slash <= 0) return storagePath;
  const assetId = storagePath.slice(slash + 1);
  if (!assetId || assetId.includes('/') || assetId.includes('..')) return storagePath;
  return `${origin.replace(/\/$/, '')}/api/v1/assets/${encodeURIComponent(assetId)}`;
}
