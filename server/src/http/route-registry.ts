/**
 * HTTP route registry — composition entry mounting Hono + Better Auth.
 * Location: server/src/http/route-registry.ts
 *
 * GATE-03 Variant B: Hono owns typed HTTP; Better Auth keeps `/api/auth/*`.
 * Colyseus realtime rooms remain later MIG tickets (MIG-021+).
 * Credentialed CORS + remote ping auth from MIG-014/015 hardening.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import type { createHealthUseCase } from '../application/health/index.ts';
import type { TransportUseCase } from '../application/transport/index.ts';
import type { OpsPorts } from '../modules/ops/index.ts';
import type { PermissionsPorts } from '../modules/permissions/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { NodeAuthHandler } from '../auth/wrap-auth-handler.ts';
import { createHostApi } from '../api/index.ts';
import {
  applyCredentialedCorsHeaders,
  decideCredentialedCors,
  handleCorsPreflight,
} from './cors.ts';

export type RouteRegistryDeps = {
  readonly health: ReturnType<typeof createHealthUseCase>;
  readonly ops: OpsPorts;
  readonly permissions: PermissionsPorts;
  readonly identity: IdentityPorts;
  readonly transport: TransportUseCase;
  /** Solo vs remote — solo-only mutation shortcuts are refused in remote mode. */
  readonly hostMode?: 'solo' | 'remote';
  /** Normalized trusted origins for credentialed CORS (empty → no CORS echo). */
  readonly trustedOrigins?: readonly string[];
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
  /**
   * World ownership canary — only after remote auth + world.edit policy
   * (MIG-015 account-link proof).
   */
  readonly tryAuthorizedWorldTouch: (input: {
    actorId: string;
    worldId: string;
  }) => { ok: true; mutated: boolean } | { ok: false; status: number; error: string };
};

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  corsOrigin?: string | null,
): void {
  if (res.writableEnded || res.headersSent) return;
  if (corsOrigin) {
    applyCredentialedCorsHeaders(res, corsOrigin);
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function corsOriginFor(req: IncomingMessage, trustedOrigins: readonly string[]): string | null {
  if (trustedOrigins.length === 0) return null;
  const decision = decideCredentialedCors(req, trustedOrigins);
  return decision.ok ? decision.origin : null;
}

/**
 * Route handler that never rejects: invalid targets → 400, unexpected errors → 500.
 * Better Auth is mounted ahead of Hono so cookie routes keep their Node adapter.
 */
export function createRouteHandler(deps: RouteRegistryDeps) {
  const trustedOrigins = deps.trustedOrigins ?? [];
  const hostMode = deps.hostMode ?? 'solo';
  const app = createHostApi({
    health: deps.health,
    ops: deps.ops,
    permissions: deps.permissions,
    identity: deps.identity,
    transport: deps.transport,
    hostMode,
    recordPing: deps.recordPing,
    tryAuthorizedProjectTouch: deps.tryAuthorizedProjectTouch,
    tryAuthorizedWorldTouch: deps.tryAuthorizedWorldTouch,
  });
  const honoListener = getRequestListener(app.fetch, { overrideGlobalObjects: false });

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let corsOrigin: string | null = null;
    try {
      corsOrigin = corsOriginFor(req, trustedOrigins);
      let pathname: string;
      try {
        pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
      } catch {
        sendJson(res, 400, { error: 'invalid-request-target' }, corsOrigin);
        return;
      }

      const method = req.method ?? 'GET';
      if (method === 'OPTIONS' && trustedOrigins.length > 0) {
        handleCorsPreflight(req, res, trustedOrigins);
        return;
      }

      if (deps.authHandlerRef.current && pathname.startsWith('/api/auth')) {
        if (corsOrigin) applyCredentialedCorsHeaders(res, corsOrigin);
        await Promise.resolve(deps.authHandlerRef.current(req, res));
        return;
      }

      if (corsOrigin) applyCredentialedCorsHeaders(res, corsOrigin);
      await Promise.resolve(honoListener(req, res));
    } catch {
      sendJson(res, 500, { error: 'internal-error' }, corsOrigin);
    }
  };
}
