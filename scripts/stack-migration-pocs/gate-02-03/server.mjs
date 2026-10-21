import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { jwt, bearer } from 'better-auth/plugins';
import { toNodeHandler } from 'better-auth/node';
import { defineServer, Room, ServerError, createRouter, createEndpoint } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { schema, t } from '@colyseus/schema';
import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { Policy, Fault, errorBody, errorResponse } from './policy.mjs';

let game, db, policy, origin, poll, browserScript;
const rooms = new Set();
const seatBindings = new Map();
const send = (value) => new Promise((resolve, reject) => process.send(value, (error) => error ? reject(error) : resolve()));
const authHeaders = (context) => {
  const headers = new Headers(context.headers);
  // Explicit headers are used by the Node client. Credential-bearing WS URLs are not accepted.
  return Object.fromEntries(headers.entries());
};
const FixtureState = schema({ revision: t.number().default(0) }, 'FixtureState');

class SessionRoom extends Room {
  static async onAuth(_token, options, context) {
    try {
      const headers = authHeaders(context);
      const principal = await policy.authenticate(headers);
      policy.authorize(principal, 'join', options);
      // Pinned Colyseus reserveSeatFor uses authData.sessionId as the opaque room seat id.
      // Bind the HTTP reservation to the same Better Auth session at the actual WS upgrade.
      const seatId = randomUUID();
      seatBindings.set(seatId, { userId: principal.userId, authSessionId: principal.sessionId, expiresAt: Date.now() + 15000 });
      return { sessionId: seatId, headers, principal, seat: { sessionId: options.sessionId, seat: options.seat, characterId: options.characterId } };
    } catch (error) { throw new ServerError(error.status ?? 500, error.code ?? 'INTERNAL_ERROR'); }
  }
  onCreate(options) {
    if (options.sessionId !== 'demo') throw new ServerError(403, 'SESSION_FORBIDDEN');
    this.maxClients = 512;
    this.state = new FixtureState();
    this.state.revision = policy.revision;
    this.setSeatReservationTime(15);
    rooms.add(this);
    for (const action of ['pingSession', 'gmOnly', 'getSnapshot', 'whoami']) {
      this.onMessage(action, async (client, message) => {
        try { return await policy.execute(client.auth.headers, action, message, 'ws'); }
        catch (error) { return errorBody(error); }
      });
    }
    this.onMessage('seat', async (client) => {
      try {
        const principal = await policy.authenticate(client.auth.headers);
        policy.authorize(principal, 'join', client.auth.seat);
        return { ok: true, sessionId: client.sessionId, roomId: this.roomId, role: principal.role, seat: client.auth.seat.seat };
      } catch (error) { return errorBody(error); }
    });
  }
  async onJoin(client) {
    // Close the gap between HTTP reservation and WebSocket seat consumption.
    const principal = await policy.authenticate(client.auth.headers);
    policy.authorize(principal, 'join', client.auth.seat);
    client.auth.principal = principal;
    seatBindings.get(client.sessionId).expiresAt = Infinity;
  }
  onDrop(client) { this.allowReconnection(client, 10); }
  async onReconnect(client) {
    policy.metrics.reconnectChecks++;
    try {
      const principal = await policy.authenticate(client.auth.headers);
      policy.authorize(principal, 'join', client.auth.seat);
      client.auth.principal = principal;
    } catch (error) { throw new ServerError(error.status ?? 500, error.code ?? 'INTERNAL_ERROR'); }
  }
  onLeave(client) { seatBindings.delete(client.sessionId); }
  onDispose() { rooms.delete(this); }
}

async function initialize(config) {
  const bindHost = config.bindHost ?? '127.0.0.1';
  if (config.mode === 'solo' && !['127.0.0.1', '::1', 'localhost'].includes(bindHost)) throw new Fault('SOLO_REQUIRES_LOOPBACK');
  if (!['minimal', 'hono'].includes(config.variant)) throw new Error('unknown HTTP variant');
  const http = createServer();
  const call = async (request, action, body) => {
    try {
      if (action === 'failure') throw new Error('intentional HTTP failure');
      return Response.json(await policy.execute(request.headers, action, body, 'http'));
    } catch (error) { return errorResponse(error); }
  };
  const routes = createRouter({
    health: createEndpoint('/health', { method: 'GET' }, async () => Response.json({ ok: true })),
    whoami: createEndpoint('/api/whoami', { method: 'GET' }, (ctx) => call(ctx.request, 'whoami', {})),
    snapshot: createEndpoint('/api/snapshot', { method: 'GET' }, (ctx) => call(ctx.request, 'getSnapshot', { sessionId: new URL(ctx.request.url).searchParams.get('sessionId') })),
    ping: createEndpoint('/api/ping-session', { method: 'POST' }, (ctx) => call(ctx.request, 'pingSession', ctx.body)),
    gm: createEndpoint('/api/gm-command', { method: 'POST' }, (ctx) => call(ctx.request, 'gmOnly', ctx.body)),
    failure: createEndpoint('/api/failure', { method: 'GET' }, (ctx) => call(ctx.request, 'failure', {})),
  });
  const transport = new WebSocketTransport({
    server: http,
    maxPayload: 65536,
    pingInterval: 1000,
    pingMaxRetries: 3,
    beforeUpgrade: async (request, context) => {
      try {
        const url = new URL(request.url);
        if (url.searchParams.has('_authToken')) throw new Fault('URL_CREDENTIAL_FORBIDDEN');
        const principal = await policy.authenticate(context.headers);
        const binding = seatBindings.get(url.searchParams.get('sessionId'));
        if (!binding || binding.expiresAt < Date.now()) throw new Fault('SEAT_BINDING_REQUIRED');
        if (binding.userId !== principal.userId || binding.authSessionId !== principal.sessionId) throw new Fault('SEAT_BINDING_MISMATCH');
      } catch (error) { return errorResponse(error); }
    },
  });
  game = defineServer({ rooms: {}, transport, routes: config.variant === 'minimal' ? routes : createRouter({}), auth: false, greet: false, gracefullyShutdown: false,
    logger: { debug() {}, info() {}, warn() {}, error() {}, log() {} },
  });
  game.define('session_room', SessionRoom).filterBy(['sessionId']);
  await game.listen(0, bindHost);
  origin = `http://127.0.0.1:${http.address().port}`;
  db = new DatabaseSync(config.databasePath);
  const auth = betterAuth({
    database: db, baseURL: origin, secret: randomBytes(48).toString('base64url'), trustedOrigins: [origin],
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    session: { cookieCache: { enabled: false } },
    advanced: { defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: false } },
    rateLimit: { enabled: false }, logger: { disabled: true },
    plugins: [bearer(), jwt({ jwt: { issuer: origin, audience: origin, expirationTime: '5m', definePayload: ({ user, session }) => ({ sub: user.id, sid: session.id }) } })],
  });
  await (await getMigrations(auth.options)).runMigrations();
  policy = new Policy({ auth, db, origin, publish: (event) => {
    for (const room of rooms) { room.state.revision = event.revision; room.broadcast('session.delta', event); }
  } });
  const betterAuthHandler = toNodeHandler(auth);
  const hono = new Hono();
  hono.get('/health', (c) => c.json({ ok: true }));
  hono.get('/api/whoami', (c) => call(c.req.raw, 'whoami', {}));
  hono.get('/api/snapshot', (c) => call(c.req.raw, 'getSnapshot', { sessionId: c.req.query('sessionId') }));
  hono.post('/api/ping-session', async (c) => call(c.req.raw, 'pingSession', await c.req.json()));
  hono.post('/api/gm-command', async (c) => call(c.req.raw, 'gmOnly', await c.req.json()));
  hono.get('/api/failure', (c) => call(c.req.raw, 'failure', {}));
  hono.onError((error) => errorResponse(error));
  const honoHandler = getRequestListener(hono.fetch, { overrideGlobalObjects: false });
  // Public Node HTTP composition: preserve Colyseus's real matchmaking/router listener,
  // mount Better Auth before either application adapter, and direct only application HTTP to Hono in B.
  const colyseusListeners = http.listeners('request');
  http.removeAllListeners('request');
  http.on('request', (request, response) => {
    const pathname = new URL(request.url, origin).pathname;
    if (request.headers.host !== new URL(origin).host) {
      response.writeHead(403, { 'content-type': 'application/json' }); response.end(JSON.stringify(errorBody(new Fault('HOST_DENIED')))); return;
    }
    if (request.method === 'OPTIONS') {
      const sameOrigin = request.headers.origin === origin;
      response.writeHead(sameOrigin ? 204 : 403, sameOrigin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST' } : {});
      response.end(); return;
    }
    if (request.method === 'GET' && pathname === '/__poc/browser' && browserScript) {
      response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      response.end('<!doctype html><html lang="en"><title>Isolated GATE-02 browser fixture</title><body><script src="/__poc/colyseus-browser.js"></script></body></html>'); return;
    }
    if (request.method === 'GET' && pathname === '/__poc/colyseus-browser.js' && browserScript) {
      response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); response.end(browserScript); return;
    }
    if (pathname.startsWith('/api/auth/')) { betterAuthHandler(request, response); return; }
    if (config.variant === 'hono' && !pathname.startsWith('/matchmake/') && pathname !== '/__healthcheck') { honoHandler(request, response); return; }
    for (const listener of colyseusListeners) listener.call(http, request, response);
  });
  let checking = false;
  poll = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      for (const [seatId, binding] of seatBindings) if (binding.expiresAt < Date.now()) seatBindings.delete(seatId);
      const checked = new Map();
      for (const room of rooms) for (const client of [...room.clients]) {
        const key = JSON.stringify(client.auth?.headers);
        if (!checked.has(key)) checked.set(key, policy.authenticate(client.auth?.headers ?? {}).then((principal) => principal, () => null));
        const principal = await checked.get(key);
        try {
          if (!principal) throw new Fault('UNAUTHENTICATED', 401);
          policy.authorize(principal, 'join', client.auth.seat);
        } catch {
          policy.metrics.revokedConnections++;
          client.leave(4003, 'SESSION_REVOKED');
        }
      }
    } finally { checking = false; }
  }, 250);
  poll.unref();
  return { origin, variant: config.variant, bindHost, sqlite: db.prepare('SELECT sqlite_version() version').get().version, sessionColumns: db.prepare('PRAGMA table_info(session)').all().map((row) => ({ name: row.name, type: row.type })) };
}

process.on('message', async (message) => {
  const { id, type } = message;
  try {
    let result;
    if (type === 'init') result = await initialize(message.config);
    else if (type === 'browser-assets') { browserScript = message.script; result = { installed: true }; }
    else if (type === 'assign') {
      db.prepare('INSERT OR REPLACE INTO poc_roles VALUES (?, ?)').run(message.userId, message.role);
      if (message.characterId) db.prepare('INSERT OR REPLACE INTO poc_characters VALUES (?, ?)').run(message.characterId, message.userId);
      result = { assigned: true };
    } else if (type === 'expire') {
      result = db.prepare('UPDATE session SET expiresAt=? WHERE userId=?').run(Date.now() - 1000, message.userId);
    } else if (type === 'drop-room') {
      let count = 0;
      for (const room of rooms) if (!message.roomId || room.roomId === message.roomId) for (const client of [...room.clients]) { client.ref.terminate(); count++; }
      result = { dropped: count };
    } else if (type === 'stats') result = { ...policy.metrics, revision: policy.revision, commands: policy.commands.size, rooms: rooms.size, activeClients: [...rooms].reduce((sum, room) => sum + room.clients.length, 0) };
    else if (type === 'close') {
      clearInterval(poll);
      await game?.gracefullyShutdown(false);
      db?.close();
      await send({ id, result: { closed: true } });
      process.disconnect(); return;
    } else throw new Error('unknown fixture control message');
    await send({ id, result });
  } catch (error) { await send({ id, error: error.code ?? String(error.message) }); }
});
