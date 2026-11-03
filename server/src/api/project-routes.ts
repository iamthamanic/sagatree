/**
 * Project / saga product HTTP — FE-HOST-04 dual-path over projectInfra ports.
 * Location: server/src/api/project-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { ProjectInfraPorts } from '../application/project-infra/index.ts';
import { authDenyStatus } from './errors.ts';

export type ProjectHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly projectInfra?: ProjectInfraPorts | null;
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

async function resolveProjectActor(
  deps: ProjectHttpDeps,
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

function infraStatus(error: string): number {
  if (
    error === 'UNAUTHENTICATED' ||
    error === 'FORBIDDEN' ||
    error === '42501' ||
    error.startsWith('42501') ||
    error === 'not-authorized' ||
    /forbidden/i.test(error)
  ) {
    return 403;
  }
  if (
    error === 'P0002' ||
    error.startsWith('P0002') ||
    error === 'not-found' ||
    /not[_-]?found/i.test(error)
  ) {
    return 404;
  }
  if (error === '22023' || error === 'INVALID_PAYLOAD' || error === 'INVALID_CODE') {
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

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

/**
 * Mount projectInfra product routes for browser cutover.
 */
export function mountProjectHttpRoutes(app: Hono, deps: ProjectHttpDeps): void {
  if (!deps.projectInfra) return;
  const infra = deps.projectInfra;

  app.post('/api/v1/projects/ensure-starter', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.ensureNativeStarterProject(
      actorResult.actor,
      optionalString(body.slug),
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/projects/join', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (typeof body.code !== 'string' || !body.code.trim()) {
      return c.json({ error: '22023' }, 422);
    }
    const characterRaw = body.characterId;
    if (
      characterRaw !== undefined &&
      characterRaw !== null &&
      typeof characterRaw !== 'string'
    ) {
      return c.json({ error: '22023' }, 422);
    }
    const result = infra.joinProjectByCode(
      actorResult.actor,
      body.code,
      typeof characterRaw === 'string' ? characterRaw : null,
    );
    if (!result.ok) {
      return c.json(
        { error: result.error, detail: result.detail ?? null },
        infraStatus(result.error),
      );
    }
    return c.json(
      {
        ...result.value,
        userId: actorResult.actor.actorId,
      },
      200,
    );
  });

  app.post('/api/v1/projects/:projectId/sessions', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.createProjectSession(
      actorResult.actor,
      c.req.param('projectId'),
      optionalString(body.name),
      optionalString(body.notes),
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json({ session: result.value }, 201);
  });

  app.post('/api/v1/projects/:projectId/my-character', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const characterRaw = body.characterId;
    if (
      characterRaw !== undefined &&
      characterRaw !== null &&
      typeof characterRaw !== 'string'
    ) {
      return c.json({ error: '22023' }, 422);
    }
    const result = infra.setMyProjectCharacter(
      actorResult.actor,
      c.req.param('projectId'),
      typeof characterRaw === 'string' ? characterRaw : null,
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(
      {
        ...result.value,
        userId: actorResult.actor.actorId,
      },
      200,
    );
  });

  app.get('/api/v1/sagas/:publicId/overview', async (c) => {
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.getSagaOverview(actorResult.actor, c.req.param('publicId'));
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/sagas/:publicId/permissions', async (c) => {
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.getMySagaPermissions(actorResult.actor, c.req.param('publicId'));
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/sagas/:publicId/lore-timeline', async (c) => {
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.getSagaLoreTimeline(actorResult.actor, c.req.param('publicId'));
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });

  app.get('/api/v1/sagas/:publicId/bindings', async (c) => {
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const assetKind = c.req.query('assetKind');
    const result = infra.listSagaBindings(
      actorResult.actor,
      c.req.param('publicId'),
      assetKind?.trim() || null,
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json({ bindings: result.value }, 200);
  });

  app.get('/api/v1/sagas/:publicId/members', async (c) => {
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const result = infra.listSagaMemberPermissionState(
      actorResult.actor,
      c.req.param('publicId'),
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json({ members: result.value }, 200);
  });

  app.post('/api/v1/projects/:projectId/bindings/:bindingId/reveal', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (typeof body.reveal !== 'string') return c.json({ error: '22023' }, 422);
    const result = infra.setSagaBindingReveal(
      actorResult.actor,
      c.req.param('projectId'),
      c.req.param('bindingId'),
      body.reveal,
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });

  app.post('/api/v1/projects/:projectId/members/:memberId/bundle', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (typeof body.bundleId !== 'string') return c.json({ error: '22023' }, 422);
    const result = infra.setSagaMemberBundle(
      actorResult.actor,
      c.req.param('projectId'),
      c.req.param('memberId'),
      body.bundleId,
    );
    if (!result.ok) return c.json({ error: result.error }, infraStatus(result.error));
    return c.json(result.value, 200);
  });
}
