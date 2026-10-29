/**
 * Hono HTTP app — typed command/query transport (GATE-03 Variant B / MIG-020).
 * Location: server/src/api/create-app.ts
 *
 * Auth (`/api/auth`) stays on Better Auth's Node handler (composition root).
 * Pipeline for commands: validate → authenticate → authorize → execute.
 */
import { Hono } from 'hono';
import type { createHealthUseCase } from '../application/health/index.ts';
import type { TransportUseCase } from '../application/transport/index.ts';
import type { createAiProviderCredentialsUseCases } from '../application/ai-provider-credentials/index.ts';
import type { createOllamaSettingsUseCases } from '../application/ollama-settings/index.ts';
import type { OpsPorts } from '../modules/ops/index.ts';
import type { PermissionsPorts } from '../modules/permissions/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { RealtimeSessionRooms } from '../realtime/index.ts';
import { actorToWhoamiDto } from '../auth/session.ts';
import { authDenyStatus, transportStatus } from './errors.ts';
import { mountAiHttpRoutes } from './ai-routes.ts';

export type HostApiDeps = {
  readonly health: ReturnType<typeof createHealthUseCase>;
  readonly ops: OpsPorts;
  readonly permissions: PermissionsPorts;
  readonly identity: IdentityPorts;
  readonly transport: TransportUseCase;
  /** MIG-021 authorized session rooms (join/resync). */
  readonly realtime?: RealtimeSessionRooms;
  /** Solo vs remote — solo-only mutation shortcuts are refused in remote mode. */
  readonly hostMode?: 'solo' | 'remote';
  readonly recordPing: () => { ok: true } | { ok: false; status: number; error: string };
  readonly tryAuthorizedProjectTouch: (input: {
    actorId: string;
    projectId: string;
    claimedRole?: unknown;
    claimedOwnerUserId?: unknown;
  }) => { ok: true; mutated: boolean } | { ok: false; status: number; error: string };
  readonly tryAuthorizedWorldTouch: (input: {
    actorId: string;
    worldId: string;
  }) => { ok: true; mutated: boolean } | { ok: false; status: number; error: string };
  /** MIG-301 infrastructure/ai host HTTP adapters (optional until ports wired). */
  readonly aiCredentials?: ReturnType<typeof createAiProviderCredentialsUseCases>;
  readonly aiOllama?: ReturnType<typeof createOllamaSettingsUseCases>;
};

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

/**
 * Build the Hono application. Composition root mounts this via @hono/node-server.
 */
export function createHostApi(deps: HostApiDeps): Hono {
  const app = new Hono();

  app.onError((_err, c) => c.json({ error: 'internal-error' }, 500));

  app.get('/health', (c) => {
    const actor = deps.identity.resolveSoloActor();
    const decision = deps.permissions.authorize('host.health.read', actor);
    if (!decision.allow) {
      return c.json({ error: decision.reason }, 403);
    }
    const health = deps.health.execute();
    return c.json(health, health.ready ? 200 : 503);
  });

  app.get('/api/whoami', async (c) => {
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: true,
    });
    if (!resolved.ok) {
      return c.json({ error: resolved.code }, authDenyStatus(resolved.code));
    }
    return c.json(actorToWhoamiDto(resolved.actor), 200);
  });

  app.post('/api/solo/link-account', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD', linked: false }, 400);
    }
    const body = parsed.body;
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json(
        { error: resolved.code, linked: false },
        authDenyStatus(resolved.code),
      );
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'INVALID_PAYLOAD', linked: false }, 400);
    }
    const record = body as Record<string, unknown>;
    const claimedSoloActorId =
      typeof record.soloActorId === 'string' ? record.soloActorId : '';
    const confirm = record.confirm === true;
    const link = deps.identity.linkSoloToRemoteAccount({
      claimedSoloActorId,
      remoteAccountId: resolved.actor.actorId,
      confirm,
    });
    if (!link.ok) {
      const status =
        link.code === 'INVALID_LINK_REQUEST'
          ? 400
          : link.code === 'LINK_STORE_WRITE_FAILED'
            ? 500
            : 403;
      return c.json({ error: link.code, linked: false }, status);
    }
    return c.json({ ok: true, linked: true, soloActorId: link.link.soloActorId }, 200);
  });

  app.post('/api/world-touch', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD', mutated: false }, 400);
    }
    const body = parsed.body;
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json(
        { error: resolved.code, mutated: false },
        authDenyStatus(resolved.code),
      );
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'INVALID_PAYLOAD', mutated: false }, 400);
    }
    const record = body as Record<string, unknown>;
    const worldId = typeof record.worldId === 'string' ? record.worldId : '';
    const decision = deps.permissions.authorize('world.edit', resolved.actor, { worldId });
    if (!decision.allow) {
      return c.json(
        {
          error: decision.reason,
          mutated: false,
          ignoredClaims: {
            role: record.role ?? null,
            ownerUserId: record.ownerUserId ?? null,
            localIdentity: record.localIdentity ?? null,
          },
        },
        403,
      );
    }
    const touch = deps.tryAuthorizedWorldTouch({
      actorId: resolved.actor.actorId,
      worldId,
    });
    if (!touch.ok) {
      return c.json({ error: touch.error, mutated: false }, touch.status);
    }
    return c.json({ ok: true, mutated: touch.mutated }, 200);
  });

  app.post('/api/project-touch', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD', mutated: false }, 400);
    }
    const body = parsed.body;
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json(
        { error: resolved.code, mutated: false },
        authDenyStatus(resolved.code),
      );
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'INVALID_PAYLOAD', mutated: false }, 400);
    }
    const record = body as Record<string, unknown>;
    const projectId = typeof record.projectId === 'string' ? record.projectId : '';
    const decision = deps.permissions.authorize('session.gm', resolved.actor, { projectId });
    if (!decision.allow) {
      return c.json(
        {
          error: decision.reason,
          mutated: false,
          ignoredClaims: {
            role: record.role ?? null,
            ownerUserId: record.ownerUserId ?? null,
          },
        },
        403,
      );
    }
    const touch = deps.tryAuthorizedProjectTouch({
      actorId: resolved.actor.actorId,
      projectId,
      claimedRole: record.role,
      claimedOwnerUserId: record.ownerUserId,
    });
    if (!touch.ok) {
      return c.json({ error: touch.error, mutated: false }, touch.status);
    }
    return c.json({ ok: true, mutated: touch.mutated }, 200);
  });

  app.post('/v1/ping', async (c) => {
    const hostMode = deps.hostMode ?? 'solo';
    if (hostMode === 'remote') {
      const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
        allowSameOriginRead: false,
      });
      if (!resolved.ok) {
        return c.json(
          { error: resolved.code, mutated: false },
          authDenyStatus(resolved.code),
        );
      }
      const decision = deps.permissions.authorize('host.ping.write', resolved.actor);
      if (!decision.allow) {
        return c.json({ error: decision.reason, mutated: false }, 403);
      }
    } else {
      const actor = deps.identity.resolveSoloActor();
      const decision = deps.permissions.authorize('host.ping.write', actor);
      if (!decision.allow) {
        return c.json({ error: decision.reason }, 403);
      }
    }
    if (!deps.ops.acceptMutations()) {
      return c.json({ error: 'host-shutting-down' }, 503);
    }
    const result = deps.recordPing();
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ ok: true }, 200);
  });

  /**
   * Typed transport query — validate → authenticate → authorize → execute.
   * Role-scoped projection: players never receive gmNotes.
   */
  app.get('/api/v1/sessions/:sessionId/snapshot', async (c) => {
    const sessionId = c.req.param('sessionId');
    const projectId = c.req.query('projectId') ?? '';
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: true,
    });
    if (!resolved.ok) {
      return c.json({ error: resolved.code }, authDenyStatus(resolved.code));
    }
    const result = deps.transport.getSnapshot(resolved.actor, { sessionId, projectId });
    if (!result.ok) {
      return c.json(
        { error: result.error, reason: result.reason ?? null },
        transportStatus(result.error),
      );
    }
    return c.json(result, 200);
  });

  /**
   * MIG-021 realtime join — membership re-checked; client role/reveal claims ignored.
   */
  app.post('/api/v1/sessions/:sessionId/realtime/join', async (c) => {
    if (!deps.realtime) {
      return c.json({ error: 'realtime-unavailable' }, 503);
    }
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    }
    const body =
      parsed.body !== null && typeof parsed.body === 'object' && !Array.isArray(parsed.body)
        ? (parsed.body as Record<string, unknown>)
        : {};
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json({ error: resolved.code }, authDenyStatus(resolved.code));
    }
    const result = deps.realtime.join(resolved.actor, {
      sessionId,
      roomId: typeof body.roomId === 'string' ? body.roomId : undefined,
      clientRevision: typeof body.clientRevision === 'number' ? body.clientRevision : 0,
      claimedRole: typeof body.role === 'string' ? body.role : undefined,
      claimedRevealedObjectIds: Array.isArray(body.revealedObjectIds)
        ? body.revealedObjectIds.filter((id): id is string => typeof id === 'string')
        : undefined,
    });
    if (!result.ok) {
      const status =
        result.error === 'UNAUTHENTICATED' ? 401 : result.error === 'INVALID_PAYLOAD' ? 422 : 403;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.sync, 200);
  });

  app.post('/api/v1/sessions/:sessionId/realtime/resync', async (c) => {
    if (!deps.realtime) {
      return c.json({ error: 'realtime-unavailable' }, 503);
    }
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    }
    const body =
      parsed.body !== null && typeof parsed.body === 'object' && !Array.isArray(parsed.body)
        ? (parsed.body as Record<string, unknown>)
        : {};
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json({ error: resolved.code }, authDenyStatus(resolved.code));
    }
    const result = deps.realtime.resync(resolved.actor, {
      sessionId,
      roomId: typeof body.roomId === 'string' ? body.roomId : undefined,
      clientRevision: typeof body.clientRevision === 'number' ? body.clientRevision : 0,
      claimedRole: typeof body.role === 'string' ? body.role : undefined,
    });
    if (!result.ok) {
      const status =
        result.error === 'UNAUTHENTICATED' ? 401 : result.error === 'INVALID_PAYLOAD' ? 422 : 403;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.sync, 200);
  });

  // MIG-301: BYOK + Ollama Organize host HTTP (Edge remains allowlisted until cutover).
  if (deps.aiCredentials && deps.aiOllama) {
    mountAiHttpRoutes(app, {
      identity: deps.identity,
      hostMode: deps.hostMode,
      credentials: deps.aiCredentials,
      ollama: deps.aiOllama,
    });
  }

  /**
   * Typed transport command — validate → authenticate → authorize → execute.
   * Idempotent retries return the same application result without a second mutation.
   */
  app.post('/api/v1/sessions/:sessionId/commands', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    }
    const body = parsed.body;
    const resolved = await deps.identity.resolveRemoteSession(c.req.raw.headers, {
      allowSameOriginRead: false,
      body,
    });
    if (!resolved.ok) {
      return c.json({ error: resolved.code }, authDenyStatus(resolved.code));
    }
    const merged =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? { ...(body as Record<string, unknown>), sessionId }
        : { sessionId };
    const result = deps.transport.applyCommand(resolved.actor, merged);
    if (!result.ok) {
      return c.json(
        { error: result.error, reason: result.reason ?? null },
        transportStatus(result.error),
      );
    }
    return c.json(result, 200);
  });

  app.notFound((c) => c.json({ error: 'not-found' }, 404));

  return app;
}
