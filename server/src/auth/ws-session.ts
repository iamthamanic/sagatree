/**
 * Minimal WebSocket upgrade that reuses cookie session resolution (MIG-014).
 * Location: server/src/auth/ws-session.ts
 *
 * Full Colyseus rooms land in later MIG tickets; this proves transport parity
 * for session restore / revoke / cross-host deny on WS.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import type { HostBetterAuth } from './cookie-profile.ts';
import { actorToWhoamiDto, resolveCookieSession } from './session.ts';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(secWebSocketKey: string): string {
  return createHash('sha1').update(secWebSocketKey + WS_GUID).digest('base64');
}

function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  if (len < 126) {
    return Buffer.concat([Buffer.from([0x81, len]), payload]);
  }
  if (len < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(len), 2);
  return Buffer.concat([header, payload]);
}

/** RFC6455 close frame — normal closure (1000) so browsers do not report 1006. */
function encodeCloseFrame(code = 1000, reason = ''): Buffer {
  const reasonBuf = Buffer.from(reason, 'utf8');
  const payload = Buffer.alloc(2 + reasonBuf.length);
  payload.writeUInt16BE(code, 0);
  reasonBuf.copy(payload, 2);
  const len = payload.length;
  if (len < 126) {
    return Buffer.concat([Buffer.from([0x88, len]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x88;
  header[1] = 126;
  header.writeUInt16BE(len, 2);
  return Buffer.concat([header, payload]);
}

export type WsSessionDeps = {
  readonly auth: HostBetterAuth;
  readonly origin: string;
  readonly trustedOrigins?: readonly string[];
  /** Called after a successful authenticated probe (for mutation canaries). */
  readonly onAuthenticatedProbe?: (actorId: string) => void;
};

/**
 * Attach `/v1/session-ws` upgrade handler. Unauthenticated / wrong-host /
 * bearer / revoked sessions never complete the handshake as an open room.
 */
export function attachSessionWebSocket(server: Server, deps: WsSessionDeps): void {
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, _head: Buffer) => {
    void handleUpgrade(req, socket, deps);
  });
}

async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  deps: WsSessionDeps,
): Promise<void> {
  let pathname = '/';
  try {
    pathname = new URL(req.url ?? '/', deps.origin).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname !== '/v1/session-ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || !key) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const resolved = await resolveCookieSession({
    auth: deps.auth,
    origin: deps.origin,
    trustedOrigins: deps.trustedOrigins,
    headers: req.headers,
    allowSameOriginRead: false,
  });

  if (!resolved.ok) {
    const status =
      resolved.code === 'UNAUTHENTICATED' ||
      resolved.code === 'BEARER_FORBIDDEN' ||
      resolved.code === 'SOLO_IDENTITY_FORBIDDEN'
        ? 401
        : 403;
    socket.write(
      `HTTP/1.1 ${status} Denied\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ error: resolved.code })}`,
    );
    socket.destroy();
    return;
  }

  const dto = actorToWhoamiDto(resolved.actor);
  deps.onAuthenticatedProbe?.(resolved.actor.actorId);

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n` +
      '\r\n',
  );
  socket.write(encodeTextFrame(JSON.stringify(dto)));
  // One-shot probe: send a protocol close frame before ending the TCP stream.
  socket.write(encodeCloseFrame(1000));
  socket.end();
}

/** Build a client Sec-WebSocket-Key for self-tests. */
export function randomSecWebSocketKey(): string {
  return randomBytes(16).toString('base64');
}
