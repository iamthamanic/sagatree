/**
 * HTTP route registry — composition entry for host HTTP adapters.
 * Location: server/src/http/route-registry.ts
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createHealthUseCase } from '../application/health/index.ts';
import type { OpsPorts } from '../modules/ops/index.ts';
import type { PermissionsPorts } from '../modules/permissions/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { NodeAuthHandler } from '../auth/wrap-auth-handler.ts';
import { actorToWhoamiDto } from '../auth/session.ts';

export type RouteRegistryDeps = {
  readonly health: ReturnType<typeof createHealthUseCase>;
  readonly ops: OpsPorts;
  readonly permissions: PermissionsPorts;
  readonly identity: IdentityPorts;
  readonly recordPing: () => { ok: true } | { ok: false; status: number; error: string };
  /** Better Auth cookie handler ref (filled after async auth init in start()). */
  readonly authHandlerRef: { current: NodeAuthHandler | null };
  /**
   * Project mutation canary — only invoked after successful remote auth + policy.
   * Returns whether a durable write occurred (for revoke negatives).
   */
  readonly tryAuthorizedProjectTouch: (input: {
    actorId: string;
    projectId: string;
    /** Client-supplied role claim — must be ignored for elevation. */
    claimedRole?: unknown;
    claimedOwnerUserId?: unknown;
  }) => { ok: true; mutated: boolean } | { ok: false; status: number; error: string };
};

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded || res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * Route handler that never rejects: invalid targets → 400, unexpected errors → 500.
 */
export function createRouteHandler(deps: RouteRegistryDeps) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      let url: URL;
      try {
        url = new URL(req.url ?? '/', 'http://127.0.0.1');
      } catch {
        sendJson(res, 400, { error: 'invalid-request-target' });
        return;
      }
      const method = req.method ?? 'GET';

      if (deps.authHandlerRef.current && url.pathname.startsWith('/api/auth')) {
        deps.authHandlerRef.current(req, res);
        return;
      }

      if (method === 'GET' && url.pathname === '/health') {
        const actor = deps.identity.resolveSoloActor();
        const decision = deps.permissions.authorize('host.health.read', actor);
        if (!decision.allow) {
          sendJson(res, 403, { error: decision.reason });
          return;
        }
        const health = deps.health.execute();
        sendJson(res, health.ready ? 200 : 503, health);
        return;
      }

      if (method === 'GET' && url.pathname === '/api/whoami') {
        const resolved = await deps.identity.resolveRemoteSession(req.headers, {
          allowSameOriginRead: true,
        });
        if (!resolved.ok) {
          const status =
            resolved.code === 'UNAUTHENTICATED' ||
            resolved.code === 'BEARER_FORBIDDEN' ||
            resolved.code === 'AUTH_NOT_CONFIGURED'
              ? 401
              : 403;
          sendJson(res, status, { error: resolved.code });
          return;
        }
        sendJson(res, 200, actorToWhoamiDto(resolved.actor));
        return;
      }

      if (method === 'POST' && url.pathname === '/api/project-touch') {
        const resolved = await deps.identity.resolveRemoteSession(req.headers, {
          allowSameOriginRead: false,
        });
        if (!resolved.ok) {
          const status =
            resolved.code === 'UNAUTHENTICATED' ||
            resolved.code === 'BEARER_FORBIDDEN' ||
            resolved.code === 'AUTH_NOT_CONFIGURED'
              ? 401
              : 403;
          sendJson(res, status, { error: resolved.code, mutated: false });
          return;
        }

        const body = await readJsonBody(req);
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { error: 'INVALID_PAYLOAD', mutated: false });
          return;
        }
        const record = body as Record<string, unknown>;
        const projectId = typeof record.projectId === 'string' ? record.projectId : '';
        const decision = deps.permissions.authorize(
          'session.gm',
          { kind: 'remote-account', actorId: resolved.actor.actorId, sessionId: resolved.actor.sessionId, email: resolved.actor.email },
          { projectId },
        );
        if (!decision.allow) {
          // Client-claimed role/owner fields are intentionally ignored for elevation.
          sendJson(res, 403, {
            error: decision.reason,
            mutated: false,
            ignoredClaims: {
              role: record.role ?? null,
              ownerUserId: record.ownerUserId ?? null,
            },
          });
          return;
        }

        const touch = deps.tryAuthorizedProjectTouch({
          actorId: resolved.actor.actorId,
          projectId,
          claimedRole: record.role,
          claimedOwnerUserId: record.ownerUserId,
        });
        if (!touch.ok) {
          sendJson(res, touch.status, { error: touch.error, mutated: false });
          return;
        }
        sendJson(res, 200, { ok: true, mutated: touch.mutated });
        return;
      }

      if (method === 'POST' && url.pathname === '/v1/ping') {
        const actor = deps.identity.resolveSoloActor();
        const decision = deps.permissions.authorize('host.ping.write', actor);
        if (!decision.allow) {
          sendJson(res, 403, { error: decision.reason });
          return;
        }
        if (!deps.ops.acceptMutations()) {
          sendJson(res, 503, { error: 'host-shutting-down' });
          return;
        }
        const result = deps.recordPing();
        if (!result.ok) {
          sendJson(res, result.status, { error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: 'not-found' });
    } catch {
      sendJson(res, 500, { error: 'internal-error' });
    }
  };
}
