/**
 * Project / saga product HTTP — FE-HOST-04 dual-path over projectInfra ports
 * + FE-HOST-12 project create/update/delete (#1117).
 * Location: server/src/api/project-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { ProjectInfraPorts } from '../application/project-infra/index.ts';
import type { ProjectPorts, ProvisionedProject } from '../modules/project/index.ts';
import type { WorldPorts } from '../modules/world/index.ts';
import type { LookProfilePorts } from '../modules/look/index.ts';
import { authDenyStatus } from './errors.ts';

export type ProjectHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly projectInfra?: ProjectInfraPorts | null;
  /** FE-HOST-12 write ports. */
  readonly project?: ProjectPorts | null;
  readonly world?: WorldPorts | null;
  readonly look?: LookProfilePorts | null;
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
    /forbidden|not[_-]?authorized/i.test(error)
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

function projectHttpDto(row: ProvisionedProject) {
  return {
    id: row.id,
    publicId: row.publicId,
    code: row.code,
    name: row.title,
    description: row.description,
    worldId: row.worldId,
    worldProfileId: row.worldId,
    defaultLookProfileId: row.defaultLookProfileId,
    allowPlayerCharacterLookOverride: row.allowPlayerCharacterLookOverride,
    gmUserId: row.gmUserId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sagaId: row.sagaId || null,
    sagaVersionId: row.sagaVersionId || null,
  };
}

async function assertOwnedLook(
  look: LookProfilePorts | null | undefined,
  actor: Actor,
  lookProfileId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (lookProfileId === null || lookProfileId === undefined) return { ok: true };
  const id = typeof lookProfileId === 'string' ? lookProfileId.trim() : '';
  if (!id) return { ok: true };
  if (!look) return { ok: false, status: 503, error: 'store-unavailable' };
  const loaded = look.getProfileById(actor, id);
  if (!loaded.ok) return { ok: false, status: infraStatus(loaded.error), error: loaded.error };
  if (!loaded.value) return { ok: false, status: 403, error: '42501' };
  // Binding invariant: only active Look profiles may be set as project default.
  if (loaded.value.status !== 'active') {
    return { ok: false, status: 403, error: '42501' };
  }
  return { ok: true };
}

/**
 * Mount projectInfra product routes for browser cutover.
 */
export function mountProjectHttpRoutes(app: Hono, deps: ProjectHttpDeps): void {
  const infra = deps.projectInfra;
  const project = deps.project;

  if (project) {
    app.post('/api/v1/projects', async (c) => {
      const parsed = await readJsonSafe(c);
      if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
      const body = asRecord(parsed.body);
      const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
      if (!actorResult.ok) {
        return c.json({ error: actorResult.error }, actorResult.status);
      }
      const nameRaw =
        typeof body.name === 'string'
          ? body.name
          : typeof body.title === 'string'
            ? body.title
            : '';
      const name = nameRaw.trim();
      if (!name) return c.json({ error: '22023' }, 422);
      const description =
        typeof body.description === 'string'
          ? body.description.trim() || null
          : null;
      let worldId =
        typeof body.worldProfileId === 'string'
          ? body.worldProfileId.trim()
          : typeof body.world_profile_id === 'string'
            ? body.world_profile_id.trim()
            : typeof body.worldId === 'string'
              ? body.worldId.trim()
              : typeof body.world_id === 'string'
                ? body.world_id.trim()
                : '';

      if (worldId) {
        if (!deps.world?.read.getWorld) {
          return c.json({ error: 'store-unavailable' }, 503);
        }
        const worldRead = deps.world.read.getWorld(actorResult.actor, worldId);
        if (!worldRead.ok) {
          return c.json(
            { error: worldRead.error },
            worldRead.error === 'world-not-found' || worldRead.error === 'P0002' ? 404 : 403,
          );
        }
      } else {
        if (!deps.world?.createOwnedWorld) {
          return c.json({ error: 'store-unavailable' }, 503);
        }
        const createdWorld = deps.world.createOwnedWorld(actorResult.actor, name);
        if (!createdWorld.ok) {
          return c.json({ error: createdWorld.error }, infraStatus(createdWorld.error));
        }
        worldId = createdWorld.value.id;
      }

      const created = project.createBlank(actorResult.actor, {
        worldId,
        title: name,
        description,
      });
      if (!created.ok) return c.json({ error: created.error }, infraStatus(created.error));
      return c.json({ project: projectHttpDto(created.value) }, 201);
    });

    app.patch('/api/v1/projects/:projectId', async (c) => {
      const parsed = await readJsonSafe(c);
      if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
      const body = asRecord(parsed.body);
      const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false, parsed.body);
      if (!actorResult.ok) {
        return c.json({ error: actorResult.error }, actorResult.status);
      }

      const lookRaw =
        'defaultLookProfileId' in body
          ? body.defaultLookProfileId
          : 'default_look_profile_id' in body
            ? body.default_look_profile_id
            : undefined;
      if (lookRaw !== undefined && lookRaw !== null && typeof lookRaw !== 'string') {
        return c.json({ error: '22023' }, 422);
      }
      const lookCheck = await assertOwnedLook(
        deps.look,
        actorResult.actor,
        typeof lookRaw === 'string' || lookRaw === null ? lookRaw : undefined,
      );
      if (!lookCheck.ok) {
        return c.json({ error: lookCheck.error }, lookCheck.status);
      }

      let worldId: string | undefined;
      if (
        'worldProfileId' in body ||
        'world_profile_id' in body ||
        'worldId' in body ||
        'world_id' in body
      ) {
        const raw =
          typeof body.worldProfileId === 'string'
            ? body.worldProfileId
            : typeof body.world_profile_id === 'string'
              ? body.world_profile_id
              : typeof body.worldId === 'string'
                ? body.worldId
                : typeof body.world_id === 'string'
                  ? body.world_id
                  : null;
        if (raw === null || typeof raw !== 'string' || !raw.trim()) {
          return c.json({ error: '22023' }, 422);
        }
        worldId = raw.trim();
        if (!deps.world?.read.getWorld) {
          return c.json({ error: 'store-unavailable' }, 503);
        }
        const worldRead = deps.world.read.getWorld(actorResult.actor, worldId);
        if (!worldRead.ok) {
          return c.json(
            { error: worldRead.error },
            worldRead.error === 'world-not-found' || worldRead.error === 'P0002' ? 404 : 403,
          );
        }
      }

      const title =
        typeof body.name === 'string'
          ? body.name
          : typeof body.title === 'string'
            ? body.title
            : undefined;
      const description =
        'description' in body
          ? typeof body.description === 'string'
            ? body.description
            : body.description === null
              ? null
              : undefined
          : undefined;
      const status = typeof body.status === 'string' ? body.status : undefined;
      const allowOverride =
        typeof body.allowPlayerCharacterLookOverride === 'boolean'
          ? body.allowPlayerCharacterLookOverride
          : typeof body.allow_player_character_look_override === 'boolean'
            ? body.allow_player_character_look_override
            : undefined;

      const updated = project.updateOwned(actorResult.actor, c.req.param('projectId'), {
        title,
        description,
        status,
        worldId,
        defaultLookProfileId:
          lookRaw === undefined
            ? undefined
            : lookRaw === null
              ? null
              : String(lookRaw).trim() || null,
        allowPlayerCharacterLookOverride: allowOverride,
      });
      if (!updated.ok) return c.json({ error: updated.error }, infraStatus(updated.error));
      return c.json({ project: projectHttpDto(updated.value) }, 200);
    });

    app.delete('/api/v1/projects/:projectId', async (c) => {
      const actorResult = await resolveProjectActor(deps, c.req.raw.headers, false);
      if (!actorResult.ok) {
        return c.json({ error: actorResult.error }, actorResult.status);
      }
      const archived = project.archiveOwned(actorResult.actor, c.req.param('projectId'));
      if (!archived.ok) return c.json({ error: archived.error }, infraStatus(archived.error));
      return c.json({ ok: true, id: archived.value.id }, 200);
    });
  }

  if (!infra) return;

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
