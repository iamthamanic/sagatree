import { createRemoteJWKSet, jwtVerify } from 'jose';

export class Fault extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
export const errorBody = (error) => ({ ok: false, error: { code: error instanceof Fault ? error.code : 'INTERNAL_ERROR' } });
export const errorResponse = (error) => Response.json(errorBody(error), { status: error instanceof Fault ? error.status : 500 });

// One policy and one command/query implementation are shared by both HTTP adapters and Colyseus.
// Better Auth owns credential creation, signature verification for cookies and session lifecycle.
export class Policy {
  constructor({ auth, db, origin, publish, authProfile = 'cookie' }) {
    Object.assign(this, { auth, db, origin, publish, authProfile });
    // JWKS remote is only meaningful for Variant B JWT hosts.
    this.jwks = authProfile === 'jwt'
      ? createRemoteJWKSet(new URL('/api/auth/jwks', origin), { timeoutDuration: 3000 })
      : null;
    this.revision = 0;
    this.commands = new Map();
    this.metrics = { http: 0, ws: 0, denied: 0, commits: 0, notifications: 0, reconnectChecks: 0, revokedConnections: 0 };
    db.exec('CREATE TABLE poc_roles (user_id TEXT PRIMARY KEY, role TEXT NOT NULL); CREATE TABLE poc_characters (character_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL);');
  }

  assertOrigin(headers, allowSameOriginRead = false) {
    const host = headers.get('host');
    if (host && host !== new URL(this.origin).host) throw new Fault('HOST_DENIED');
    if (headers.get('origin') === this.origin) return;
    // Browsers omit Origin on ordinary same-origin GETs. Only these read-only
    // HTTP actions may use the browser's Fetch Metadata plus the exact Host.
    if (allowSameOriginRead && !headers.has('origin') && host === new URL(this.origin).host && headers.get('sec-fetch-site') === 'same-origin') return;
    throw new Fault('ORIGIN_DENIED');
  }

  async authenticate(rawHeaders, allowSameOriginRead = false) {
    const headers = new Headers(rawHeaders);
    this.assertOrigin(headers, allowSameOriginRead);
    const authorization = headers.get('authorization');
    let userId, sessionId, credentialKind;
    if (authorization) {
      // Cookie-only Variant A never accepts bearer/JWT — profile gate, not client sniffing.
      if (this.authProfile !== 'jwt' || !this.jwks) throw new Fault('UNAUTHENTICATED', 401);
      if (!authorization.startsWith('Bearer ')) throw new Fault('UNAUTHENTICATED', 401);
      try {
        // The JWT is issued by the real Better Auth JWT plugin, with a signed session id.
        const { payload } = await jwtVerify(authorization.slice(7), this.jwks, { issuer: this.origin, audience: this.origin, algorithms: ['EdDSA'] });
        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('missing session binding');
        const session = this.db.prepare('SELECT id, userId, expiresAt FROM session WHERE id=?').get(payload.sid);
        if (!session || session.userId !== payload.sub || Number(session.expiresAt) <= Date.now()) throw new Error('expired or revoked');
        userId = session.userId; sessionId = session.id; credentialKind = 'jwt';
      } catch { throw new Fault('UNAUTHENTICATED', 401); }
    } else {
      let found;
      try { found = await this.auth.api.getSession({ headers, query: { disableCookieCache: true } }); }
      catch { throw new Fault('UNAUTHENTICATED', 401); }
      if (!found?.session || !found?.user || new Date(found.session.expiresAt).getTime() <= Date.now()) throw new Fault('UNAUTHENTICATED', 401);
      userId = found.user.id; sessionId = found.session.id; credentialKind = 'cookie';
    }
    const role = this.db.prepare('SELECT role FROM poc_roles WHERE user_id=?').get(userId)?.role;
    return { userId, sessionId, role: role ?? 'outsider', credentialKind };
  }

  authorize(principal, action, data = {}) {
    if (!['host-admin', 'player'].includes(principal.role)) throw new Fault('SESSION_FORBIDDEN');
    if (data.sessionId !== 'demo') throw new Fault('SESSION_FORBIDDEN');
    if (action === 'join') {
      if (!['gm', 'player'].includes(data.seat)) throw new Fault('INVALID_SEAT', 400);
      if (data.seat === 'gm' && principal.role !== 'host-admin') throw new Fault('GM_REQUIRED');
      if (data.seat === 'player') {
        if (typeof data.characterId !== 'string') throw new Fault('CHARACTER_FORBIDDEN');
        const owner = this.db.prepare('SELECT owner_user_id FROM poc_characters WHERE character_id=?').get(data.characterId);
        if (!owner || owner.owner_user_id !== principal.userId) throw new Fault('CHARACTER_FORBIDDEN');
      }
    }
    if (action === 'gmOnly' && principal.role !== 'host-admin') throw new Fault('GM_REQUIRED');
  }

  async execute(headers, action, data, transport) {
    this.metrics[transport]++;
    try {
      const principal = await this.authenticate(headers, transport === 'http' && ['whoami', 'getSnapshot'].includes(action));
      if (action === 'whoami') return { ok: true, role: principal.role, credentialKind: principal.credentialKind };
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Fault('INVALID_PAYLOAD', 400);
      this.authorize(principal, action, data);
      if (action === 'getSnapshot') return { ok: true, sessionId: 'demo', revision: this.revision, value: this.commands.size };
      if (!['pingSession', 'gmOnly'].includes(action)) throw new Fault('UNKNOWN_COMMAND', 400);
      if (typeof data.commandId !== 'string' || !data.commandId || data.commandId.length > 128) throw new Fault('INVALID_COMMAND', 400);
      const key = `${principal.userId}:${data.commandId}`;
      if (this.commands.has(key)) return this.commands.get(key);
      const result = { ok: true, sessionId: 'demo', commandId: data.commandId, revision: ++this.revision };
      this.commands.set(key, result);
      this.metrics.commits++;
      this.publish({ sessionId: 'demo', revision: this.revision, commandId: data.commandId });
      this.metrics.notifications++;
      return result;
    } catch (error) { this.metrics.denied++; throw error; }
  }
}
