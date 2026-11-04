/**
 * Saga-definition product HTTP — FE-HOST-13 dual-path over sagaInfra ports.
 * Location: server/src/api/saga-definition-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 * Owner-scoped authoring; never trust client-claimed owner ids.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { SagaInfraPorts } from '../application/saga-infra/index.ts';
import { authDenyStatus } from './errors.ts';

export type SagaDefinitionHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly sagaInfra?: SagaInfraPorts | null;
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

async function resolveSagaActor(
  deps: SagaDefinitionHttpDeps,
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

function asRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function infraStatus(error: string): number {
  if (
    error === 'UNAUTHENTICATED' ||
    error === 'FORBIDDEN' ||
    error === 'not-authorized' ||
    error === 'missing-actor' ||
    error.startsWith('42501') ||
    /forbidden|not[_-]?authorized/i.test(error)
  ) {
    return 403;
  }
  if (error === 'P0002' || error === 'not-found' || /not[_-]?found/i.test(error)) {
    return 404;
  }
  if (error === '40001' || error === 'STALE_REVISION' || /revision|conflict/i.test(error)) {
    return 409;
  }
  if (error === '22023' || error === 'INVALID_PAYLOAD' || /invalid/i.test(error)) {
    return 422;
  }
  if (error === 'store-unavailable') return 503;
  return 400;
}

/**
 * Mount saga-definition authoring routes for browser cutover.
 */
export function mountSagaDefinitionHttpRoutes(app: Hono, deps: SagaDefinitionHttpDeps): void {
  if (!deps.sagaInfra) return;
  const infra = deps.sagaInfra;

  app.post('/api/v1/saga-definitions', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: '22023' }, 422);
    const blurb = typeof body.blurb === 'string' ? body.blurb : '';
    const created = infra.createUserSagaDefinition(actorResult.actor, title, blurb);
    if (!created.ok) return c.json({ error: created.error }, infraStatus(created.error));
    return c.json({ saga: created.value }, 201);
  });

  app.get('/api/v1/saga-definitions/by-slug/:slug', async (c) => {
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const slug = c.req.param('slug');
    const got = infra.getNativeSagaDefinitionBySlug(actorResult.actor, slug);
    if (!got.ok) return c.json({ error: got.error }, infraStatus(got.error));
    return c.json({ version: got.value }, 200);
  });

  app.get('/api/v1/saga-definitions/versions/:versionId', async (c) => {
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const got = infra.getSagaDefinitionVersion(actorResult.actor, c.req.param('versionId'));
    if (!got.ok) return c.json({ error: got.error }, infraStatus(got.error));
    return c.json({ version: got.value }, 200);
  });

  app.get('/api/v1/saga-definitions/:sagaId/editor', async (c) => {
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const got = infra.getSagaDefinitionEditor(actorResult.actor, c.req.param('sagaId'));
    if (!got.ok) return c.json({ error: got.error }, infraStatus(got.error));
    return c.json({ editor: got.value }, 200);
  });

  app.put('/api/v1/saga-definitions/:sagaId/draft', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (body.payload === null || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return c.json({ error: '22023' }, 422);
    }
    const payload = body.payload as Record<string, unknown>;
    const expectedRevision =
      typeof body.expectedRevision === 'number'
        ? body.expectedRevision
        : typeof body.expected_revision === 'number'
          ? body.expected_revision
          : NaN;
    if (!Number.isFinite(expectedRevision)) return c.json({ error: '22023' }, 422);
    const saved = infra.saveSagaDefinitionDraft(
      actorResult.actor,
      c.req.param('sagaId'),
      payload,
      expectedRevision,
    );
    if (!saved.ok) return c.json({ error: saved.error }, infraStatus(saved.error));
    return c.json({ draft: saved.value }, 200);
  });

  app.post('/api/v1/saga-definitions/:sagaId/publish', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const expectedRevision =
      typeof body.expectedRevision === 'number'
        ? body.expectedRevision
        : typeof body.expected_revision === 'number'
          ? body.expected_revision
          : NaN;
    if (!Number.isFinite(expectedRevision)) return c.json({ error: '22023' }, 422);
    const published = infra.publishSagaDefinitionVersion(
      actorResult.actor,
      c.req.param('sagaId'),
      expectedRevision,
    );
    if (!published.ok) return c.json({ error: published.error }, infraStatus(published.error));
    return c.json({ publish: published.value }, 200);
  });

  app.post('/api/v1/saga-definitions/copy-native', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const sourceSagaId =
      typeof body.sourceSagaId === 'string'
        ? body.sourceSagaId
        : typeof body.source_saga_id === 'string'
          ? body.source_saga_id
          : '';
    if (!sourceSagaId.trim()) return c.json({ error: '22023' }, 422);
    const copied = infra.copyNativeSagaDefinition(actorResult.actor, sourceSagaId.trim());
    if (!copied.ok) return c.json({ error: copied.error }, infraStatus(copied.error));
    return c.json({ saga: copied.value }, 201);
  });

  app.post('/api/v1/saga-definitions/create-project', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const sagaId = typeof body.sagaId === 'string' ? body.sagaId : '';
    const versionId = typeof body.versionId === 'string' ? body.versionId : '';
    if (!sagaId.trim() || !versionId.trim()) return c.json({ error: '22023' }, 422);
    const name = typeof body.name === 'string' ? body.name : null;
    const created = infra.createProjectFromSagaVersion(
      actorResult.actor,
      sagaId.trim(),
      versionId.trim(),
      name,
    );
    if (!created.ok) return c.json({ error: created.error }, infraStatus(created.error));
    return c.json({ project: created.value }, 201);
  });

  app.post('/api/v1/saga-definitions/duplicate-playthrough', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSagaActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    if (!projectId.trim()) return c.json({ error: '22023' }, 422);
    const mode = typeof body.mode === 'string' ? body.mode : null;
    const dup = infra.duplicateSagaPlaythrough(actorResult.actor, projectId.trim(), mode);
    if (!dup.ok) return c.json({ error: dup.error }, infraStatus(dup.error));
    return c.json({ project: dup.value }, 201);
  });
}
