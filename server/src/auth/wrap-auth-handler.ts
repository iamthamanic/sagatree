/**
 * Cookie-profile Better Auth Node handler wrapper.
 * Hard-denies JWT issuance and strips browser-readable session bearers.
 * Location: server/src/auth/wrap-auth-handler.ts
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

const SESSION_BEARER_KEYS = new Set([
  'token',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'idToken',
]);

export function stripSessionBearerFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) stripSessionBearerFields(item);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SESSION_BEARER_KEYS.has(key) && typeof record[key] === 'string') {
      delete record[key];
    } else {
      stripSessionBearerFields(record[key]);
    }
  }
}

function scrubAuthResponseHeaders(
  headers: Record<string, unknown> | Array<unknown>,
): Record<string, unknown> | Array<unknown> {
  if (Array.isArray(headers)) {
    const out = [...headers];
    for (let i = out.length - 2; i >= 0; i -= 2) {
      if (String(out[i]).toLowerCase() === 'set-auth-token') out.splice(i, 2);
    }
    return out;
  }
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (key.toLowerCase() === 'set-auth-token') delete out[key];
  }
  return out;
}

export type NodeAuthHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

/**
 * Wrap Better Auth's toNodeHandler for the cookie-only profile.
 * `/api/auth/token` is always 404 JWT_ISSUANCE_DISABLED (not UA/Origin sniffing).
 */
export function wrapCookieAuthHandler(handler: NodeAuthHandler, origin: string): NodeAuthHandler {
  return (request, response) => {
    const pathname = new URL(request.url ?? '/', origin).pathname;
    if (pathname === '/api/auth/token' || pathname.startsWith('/api/auth/token/')) {
      const body = JSON.stringify({ error: { code: 'JWT_ISSUANCE_DISABLED' } });
      response.writeHead(404, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
      });
      response.end(body);
      return;
    }

    const setHeader = response.setHeader.bind(response);
    response.setHeader = ((name: string, value: number | string | readonly string[]) => {
      if (String(name).toLowerCase() === 'set-auth-token') return response;
      return setHeader(name, value);
    }) as typeof response.setHeader;

    const writeHead = response.writeHead.bind(response);
    response.writeHead = ((
      statusCode: number,
      reasonOrHeaders?: string | Record<string, unknown> | Array<unknown>,
      maybeHeaders?: Record<string, unknown> | Array<unknown>,
    ) => {
      if (typeof reasonOrHeaders === 'object' && reasonOrHeaders !== null) {
        return writeHead(
          statusCode,
          scrubAuthResponseHeaders(reasonOrHeaders) as Parameters<typeof writeHead>[1],
        );
      }
      if (typeof maybeHeaders === 'object' && maybeHeaders !== null) {
        return writeHead(
          statusCode,
          reasonOrHeaders as string,
          scrubAuthResponseHeaders(maybeHeaders) as Parameters<typeof writeHead>[2],
        );
      }
      return writeHead(statusCode, reasonOrHeaders as string | undefined);
    }) as typeof response.writeHead;

    const chunks: Buffer[] = [];
    const write = response.write.bind(response);
    const end = response.end.bind(response);
    response.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
      if (chunk) {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk as string | ArrayBuffer, typeof encoding === 'string' ? encoding as BufferEncoding : undefined),
        );
      }
      if (typeof encoding === 'function') (encoding as () => void)();
      else if (typeof cb === 'function') (cb as () => void)();
      return true;
    }) as typeof response.write;

    response.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
      if (typeof chunk !== 'function' && chunk) {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk as string | ArrayBuffer, typeof encoding === 'string' ? encoding as BufferEncoding : undefined),
        );
      }
      const callback =
        typeof chunk === 'function'
          ? (chunk as () => void)
          : typeof encoding === 'function'
            ? (encoding as () => void)
            : (cb as (() => void) | undefined);
      let body = Buffer.concat(chunks);
      try {
        const parsed: unknown = JSON.parse(body.toString('utf8'));
        stripSessionBearerFields(parsed);
        body = Buffer.from(JSON.stringify(parsed));
        if (response.getHeader('content-length') !== undefined) {
          setHeader('content-length', Buffer.byteLength(body));
        }
      } catch {
        // Non-JSON Better Auth responses pass through unchanged.
      }
      return end(body, callback);
    }) as typeof response.end;

    void handler(request, response);
  };
}
