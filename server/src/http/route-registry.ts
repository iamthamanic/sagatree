/**
 * HTTP route registry — composition entry for host HTTP adapters.
 * Location: server/src/http/route-registry.ts
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createHealthUseCase } from '../application/health/index.ts';
import type { OpsPorts } from '../modules/ops/index.ts';
import type { PermissionsPorts } from '../modules/permissions/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';

export type RouteRegistryDeps = {
  readonly health: ReturnType<typeof createHealthUseCase>;
  readonly ops: OpsPorts;
  readonly permissions: PermissionsPorts;
  readonly identity: IdentityPorts;
  readonly recordPing: () => { ok: true } | { ok: false; status: number; error: string };
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
