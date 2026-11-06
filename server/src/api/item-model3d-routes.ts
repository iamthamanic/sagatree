/**
 * Item model3d HTTP (CUT-17 / #1152) — Edge `item-model3d` parity.
 * Location: server/src/api/item-model3d-routes.ts
 *
 * Action-shaped POST `/api/v1/items/model3d` matches FE invoke body.
 * REST aliases under `/api/v1/items/:id/model3d/*` per design contract.
 */
import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { Actor } from '../modules/identity/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { ItemModel3dUseCases } from '../application/item-model3d/index.ts';
import {
  ITEM_MODEL3D_HEADER_MAX_BYTES,
  checkItemModel3dContentLengthHeader,
} from '../modules/inventory/item-model3d.ts';
import { isLoopbackHost } from '../auth/solo/bind-guard.ts';
import { authDenyStatus } from './errors.ts';

export type ItemModel3dHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly itemModel3d: ItemModel3dUseCases;
  /** Optional: hydrate definition into the in-memory store before authz. */
  readonly ensureDefinition?: (
    actor: Actor,
    definitionId: string,
  ) => Promise<void> | void;
};

type JsonBody = Record<string, unknown>;

function isRecord(value: unknown): value is JsonBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentTypeIsJson(c: Context): boolean {
  const raw = c.req.header('content-type') ?? '';
  return raw.toLowerCase().includes('application/json');
}

function requestHostName(headers: Headers): string {
  const raw = (headers.get('host') ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end >= 0 ? raw.slice(1, end) : raw;
  }
  return raw.split(':')[0] ?? '';
}

function normalizeHostname(hostname: string): string {
  const raw = hostname.trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

function soloAuthNotConfiguredAllowed(headers: Headers): boolean {
  if (!isLoopbackHost(requestHostName(headers))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return isLoopbackHost(normalizeHostname(new URL(origin).hostname));
  } catch {
    return false;
  }
}

async function resolveActor(
  deps: ItemModel3dHttpDeps,
  headers: Headers,
  body: unknown,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead: false,
    body,
  });
  if (remote.ok) return { ok: true, actor: remote.actor };
  if (deps.hostMode === 'solo' && remote.code === 'AUTH_NOT_CONFIGURED') {
    if (!soloAuthNotConfiguredAllowed(headers)) {
      return { ok: false, status: 403, error: 'HOST_DENIED' };
    }
    return { ok: true, actor: deps.identity.resolveSoloActor() };
  }
  return { ok: false, status: authDenyStatus(remote.code), error: remote.code };
}

async function readJsonBody(
  c: Context,
): Promise<{ ok: true; body: JsonBody } | { ok: false; status: number; message: string }> {
  if (!contentTypeIsJson(c)) {
    return { ok: false, status: 415, message: 'Content-Type application/json erforderlich.' };
  }
  const headerSize = checkItemModel3dContentLengthHeader(c.req.header('content-length') ?? null);
  if (!headerSize.ok) {
    return { ok: false, status: headerSize.status, message: headerSize.message };
  }
  try {
    const text = await c.req.text();
    if (Buffer.byteLength(text, 'utf8') > ITEM_MODEL3D_HEADER_MAX_BYTES) {
      return { ok: false, status: 413, message: 'Request body too large' };
    }
    if (!text || text.trim().length === 0) return { ok: true, body: {} };
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
    }
    return { ok: true, body: parsed };
  } catch {
    return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
  }
}

function resultToResponse(
  c: Context,
  result: { status: string; message?: string; httpStatus?: number; [key: string]: unknown },
) {
  if (result.status === 'ok') {
    const { httpStatus: _h, ...rest } = result;
    return c.json(rest, 200);
  }
  if (result.status === 'not-configured') {
    return c.json(
      { status: 'not-configured' as const, message: result.message ?? 'Nicht konfiguriert.' },
      typeof result.httpStatus === 'number' ? result.httpStatus : 503,
    );
  }
  return c.json(
    {
      status: 'error' as const,
      message: typeof result.message === 'string' ? result.message : 'Fehler.',
      ...(typeof result.code === 'string' ? { code: result.code } : {}),
    },
    typeof result.httpStatus === 'number' ? result.httpStatus : 500,
  );
}

async function dispatchAction(
  deps: ItemModel3dHttpDeps,
  actor: Actor,
  action: string,
  body: JsonBody,
  definitionIdOverride?: string,
) {
  const definitionId =
    typeof definitionIdOverride === 'string' && definitionIdOverride.trim()
      ? definitionIdOverride.trim()
      : typeof body.definitionId === 'string'
        ? body.definitionId.trim()
        : '';

  if (
    definitionId &&
    (action === 'upload' ||
      action === 'generate' ||
      action === 'remove' ||
      action === 'latest-job') &&
    deps.ensureDefinition
  ) {
    await deps.ensureDefinition(actor, definitionId);
  }

  switch (action) {
    case 'config':
      return await deps.itemModel3d.config(actor);
    case 'upload':
      return deps.itemModel3d.upload(actor, {
        definitionId,
        contentBase64: typeof body.contentBase64 === 'string' ? body.contentBase64 : '',
        mime: typeof body.mime === 'string' ? body.mime : undefined,
      });
    case 'generate':
      return await deps.itemModel3d.generate(actor, definitionId);
    case 'status': {
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      return deps.itemModel3d.status(actor, jobId);
    }
    case 'resolve':
      return deps.itemModel3d.resolve(actor, {
        model3d: typeof body.model3d === 'string' ? body.model3d : undefined,
        assetId: typeof body.assetId === 'string' ? body.assetId : undefined,
      });
    case 'remove':
      return deps.itemModel3d.remove(actor, definitionId);
    case 'latest-job':
      return deps.itemModel3d.latestJob(actor, definitionId);
    default:
      return {
        status: 'error' as const,
        message: 'Ungültige Aktion.',
        httpStatus: 400,
      };
  }
}

export function mountItemModel3dHttpRoutes(app: Hono, deps: ItemModel3dHttpDeps): void {
  if (!deps.itemModel3d.publicActivationAuthorized) return;

  // Edge-parity action invoke
  app.post('/api/v1/items/model3d', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const action = typeof parsed.body.action === 'string' ? parsed.body.action.trim() : '';
    const result = await dispatchAction(deps, actorResult.actor, action, parsed.body);
    return resultToResponse(c, result);
  });

  // REST family (design contract)
  app.get('/api/v1/items/model3d/config', async (c) => {
    const actorResult = await resolveActor(deps, c.req.raw.headers, {});
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    return resultToResponse(c, await deps.itemModel3d.config(actorResult.actor));
  });

  app.post('/api/v1/items/:id/model3d/upload', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(
      deps,
      actorResult.actor,
      'upload',
      parsed.body,
      c.req.param('id'),
    );
    return resultToResponse(c, result);
  });

  app.post('/api/v1/items/:id/model3d/generate', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(
      deps,
      actorResult.actor,
      'generate',
      parsed.body,
      c.req.param('id'),
    );
    return resultToResponse(c, result);
  });

  app.post('/api/v1/items/model3d/jobs/:jobId/status', async (c) => {
    const actorResult = await resolveActor(deps, c.req.raw.headers, {});
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(deps, actorResult.actor, 'status', {
      jobId: c.req.param('jobId'),
    });
    return resultToResponse(c, result);
  });

  app.get('/api/v1/items/:id/model3d/latest-job', async (c) => {
    const actorResult = await resolveActor(deps, c.req.raw.headers, {});
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(
      deps,
      actorResult.actor,
      'latest-job',
      {},
      c.req.param('id'),
    );
    return resultToResponse(c, result);
  });

  app.post('/api/v1/items/model3d/resolve', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(deps, actorResult.actor, 'resolve', parsed.body);
    return resultToResponse(c, result);
  });

  app.delete('/api/v1/items/:id/model3d', async (c) => {
    const actorResult = await resolveActor(deps, c.req.raw.headers, {});
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const result = await dispatchAction(
      deps,
      actorResult.actor,
      'remove',
      {},
      c.req.param('id'),
    );
    return resultToResponse(c, result);
  });
}
