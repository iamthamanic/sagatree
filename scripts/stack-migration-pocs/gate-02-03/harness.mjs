import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

// Node's built-in browser-style WebSocket cannot send custom headers. Configure
// the real ws transport before importing the real Colyseus SDK. This is not browser evidence.
globalThis.WebSocket = WebSocket;
const { Client } = await import('@colyseus/sdk');
export const active = new Set();
export const timeout = (promise, ms = 15000, label = 'operation') => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
export const credentials = (host, login, kind = 'cookie', origin = host.origin) => ({ origin, ...(kind === 'cookie' ? { cookie: login.cookie } : { authorization: `Bearer ${login.jwt}` }) });
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FixtureHost {
  constructor() {
    this.child = fork(fileURLToPath(new URL('./server.mjs', import.meta.url)), [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] });
    this.nextId = 1; this.pending = new Map(); this.links = new Set(); this.stderr = '';
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk; });
    this.child.stdout.on('data', () => {});
    this.exit = new Promise((resolve) => this.child.once('exit', (code, signal) => {
      this.exitResult = { code, signal }; active.delete(this);
      for (const item of this.pending.values()) item.reject(new Error(`fixture exited ${code}/${signal}: ${this.stderr.slice(-1000)}`));
      this.pending.clear(); resolve(this.exitResult);
    }));
    this.child.on('message', (message) => {
      const item = this.pending.get(message.id);
      if (!item) return;
      this.pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error)); else item.resolve(message.result);
    });
    active.add(this);
  }
  call(type, args = {}) {
    const id = this.nextId++;
    return timeout(new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.send({ id, type, ...args }, (error) => { if (error) { this.pending.delete(id); reject(error); } });
    }), 15000, `fixture ${type}`);
  }
  async init(config) {
    this.config = await this.call('init', { config });
    this.origin = this.config.origin;
    this.authProfile = this.config.authProfile ?? 'cookie';
    return this;
  }
  async http(path, { body, headers = {}, method } = {}) {
    const response = await fetch(`${this.origin}${path}`, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { origin: this.origin, ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { unexpectedText: text.slice(0, 200) }; }
    return { status: response.status, data, headers: response.headers };
  }
  async user(label, role, characterId) {
    const email = `${label}@gate-poc.invalid`;
    const password = 'Fixture-only-password-42!';
    const signup = await this.http('/api/auth/sign-up/email', { body: { email, password, name: label } });
    if (signup.status !== 200 || !signup.data.user?.id) throw new Error(`real Better Auth signup failed: ${signup.status} ${JSON.stringify(signup.data)}`);
    await this.call('assign', { userId: signup.data.user.id, role, characterId });
    const user = { label, email, password, userId: signup.data.user.id, role, characterId };
    return { ...user, login: await this.login(user) };
  }
  async login(user) {
    // Cookie-only GATE-02 A: sign-in may omit body.token / set-auth-token; Set-Cookie is required.
    // JWT issuance is only available on a separate authProfile=jwt host (Variant B).
    const response = await this.http('/api/auth/sign-in/email', { body: { email: user.email, password: user.password } });
    if (response.status !== 200 || !response.data?.user?.id) throw new Error(`real Better Auth login failed: ${response.status}`);
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) => cookie.split('=')[0].endsWith('session_token'));
    if (!sessionCookie) throw new Error('Better Auth did not set its session cookie');
    const cookie = sessionCookie.split(';')[0];
    let jwtToken = null;
    if (this.authProfile === 'jwt') {
      const jwt = await this.http('/api/auth/token', { headers: { cookie } });
      if (jwt.status !== 200 || typeof jwt.data.token !== 'string') throw new Error(`real Better Auth JWT issuance failed: ${jwt.status}`);
      jwtToken = jwt.data.token;
    } else {
      const denied = await this.http('/api/auth/token', { headers: { cookie } });
      if (denied.status !== 404 || denied.data?.error?.code !== 'JWT_ISSUANCE_DISABLED') {
        throw new Error(`cookie profile must hard-deny /api/auth/token: ${denied.status} ${JSON.stringify(denied.data)}`);
      }
    }
    const sessionToken = typeof response.data.token === 'string'
      ? response.data.token
      : (await this.call('session-token', { userId: user.userId }))?.token ?? null;
    return {
      cookie,
      jwt: jwtToken,
      sessionToken,
      opaqueBearer: response.headers.get('set-auth-token'),
      attributes: { httpOnly: /;\s*httponly/i.test(sessionCookie), sameSiteLax: /;\s*samesite=lax/i.test(sessionCookie), secure: /;\s*secure(?:;|$)/i.test(sessionCookie) },
    };
  }
  sdk(headers) { return new Client(this.origin, { headers }); }
  track(sdk, room) {
    room.reconnection.enabled = false;
    const link = { sdk, room, deltas: [], leaves: [], errors: [] };
    room.onMessage('session.delta', (event) => link.deltas.push(event));
    room.onLeave((code) => link.leaves.push(code));
    room.onError((code) => link.errors.push(code));
    this.links.add(link);
    return link;
  }
  async join(headers, options = { sessionId: 'demo', seat: 'gm' }) {
    const sdk = this.sdk(headers);
    return this.track(sdk, await timeout(sdk.joinOrCreate('session_room', options), 10000, 'Colyseus join'));
  }
  async reconnect(headers, token) {
    const sdk = this.sdk(headers);
    return this.track(sdk, await timeout(sdk.reconnect(token), 10000, 'Colyseus reconnect'));
  }
  async leave(link) {
    this.links.delete(link);
    if (link.room.connection.isOpen) await timeout(link.room.leave(), 3000, 'room leave');
  }
  async close() {
    for (const link of [...this.links]) await this.leave(link).catch(() => {});
    if (!this.exitResult) {
      await this.call('close').catch(() => {});
      if (!this.exitResult) await timeout(this.exit, 3000, 'server close').catch(() => this.child.kill('SIGKILL'));
    }
  }
}
