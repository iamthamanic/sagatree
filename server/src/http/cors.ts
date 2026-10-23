/**
 * Credentialed CORS for cross-origin frontend → host bridge.
 * Location: server/src/http/cors.ts
 *
 * Never uses Access-Control-Allow-Origin: *. Exact origin echo + credentials only.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isTrustedOrigin, normalizeOrigin } from '../auth/origin.ts';

export type CorsDecision =
  | { ok: true; origin: string }
  | { ok: false; reason: 'missing-origin' | 'origin-denied' };

/**
 * Decide whether the request Origin is allowed for credentialed CORS.
 */
export function decideCredentialedCors(
  req: IncomingMessage,
  trustedOrigins: readonly string[],
): CorsDecision {
  const raw = req.headers.origin;
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, reason: 'missing-origin' };
  }
  const normalized = normalizeOrigin(raw);
  if (!normalized || !isTrustedOrigin(normalized, trustedOrigins)) {
    return { ok: false, reason: 'origin-denied' };
  }
  return { ok: true, origin: normalized };
}

/**
 * Apply exact Allow-Origin + Credentials for an allowed origin.
 * Call before writeHead / sendJson. Idempotent.
 */
export function applyCredentialedCorsHeaders(
  res: ServerResponse,
  allowedOrigin: string,
): void {
  if (res.headersSent) return;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

/**
 * Handle CORS preflight for credentialed host-bridge routes.
 * Returns true when the response was fully written.
 */
export function handleCorsPreflight(
  req: IncomingMessage,
  res: ServerResponse,
  trustedOrigins: readonly string[],
): boolean {
  const decision = decideCredentialedCors(req, trustedOrigins);
  if (!decision.ok) {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'ORIGIN_DENIED' }));
    return true;
  }
  applyCredentialedCorsHeaders(res, decision.origin);
  res.writeHead(204, {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '600',
  });
  res.end();
  return true;
}
