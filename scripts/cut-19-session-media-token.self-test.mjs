#!/usr/bin/env node
/**
 * cut-19-session-media-token.self-test — Host LiveKit media-token activate (#1154).
 * Location: scripts/cut-19-session-media-token.self-test.mjs
 *
 * Covers: configured GM/player token, unauth 401, foreign 403, LiveKit absent 503,
 * Soft-DENY removed, client role/caps/room ignored.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const mediaModUrl = pathToFileURL(
  join(root, 'server/src/modules/session/session-media-token.ts'),
).href;

const API_KEY = 'lk_cut19_api_key';
const API_SECRET = 'lk_cut19_api_secret_super_secret';
const LIVEKIT_URL = 'wss://livekit.cut19.test.invalid';

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function cookieHeaderFromResponse(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length > 0) return raw.map((c) => c.split(';')[0]).join('; ');
  const single = res.headers.get('set-cookie');
  if (!single) return '';
  return single.split(',').map((part) => part.trim().split(';')[0]).join('; ');
}

async function httpJson(base, path, { method = 'GET', headers = {}, body, cookie } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text, cookie: cookieHeaderFromResponse(res) };
}

async function signIn(baseURL, email, password) {
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name: email },
  });
  let cookie = signUp.cookie;
  if (!cookie || signUp.res.status >= 400) {
    const signInRes = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email, password },
    });
    assert(signInRes.res.status < 400, `sign-in ${email}: ${signInRes.res.status}`);
    cookie = signInRes.cookie;
  }
  assert(cookie && cookie.includes('='), `cookie for ${email}`);
  return cookie;
}

async function createActiveSession(baseURL, cookie) {
  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-19 Media', description: 'LiveKit project' },
  });
  assert(
    createdProject.res.status === 201,
    `project ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  assert(typeof projectId === 'string', 'project id');

  const createdSession = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'Media Episode' },
  });
  assert(
    createdSession.res.status === 201 || createdSession.res.status === 200,
    `session ${createdSession.res.status} ${createdSession.text}`,
  );
  const sessionId =
    createdSession.json?.session?.sessionId ?? createdSession.json?.sessionId;
  assert(typeof sessionId === 'string', 'session id');

  const toActive = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/status`, {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { status: 'active' },
  });
  assert(toActive.res.status === 200, `active ${toActive.res.status} ${toActive.text}`);

  return { projectId, sessionId };
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const {
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  deriveMediaRoomId,
  verifyLiveKitAccessToken,
} = await import(mediaModUrl);

assert(SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation flag true');

const routes = readFileSync(join(root, 'server/src/api/session-routes.ts'), 'utf8');
assert(routes.includes('/api/v1/sessions/:sessionId/media-token'), 'route mounted');
assert(/sessionMediaToken/i.test(readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8')), 'create-app wires dep');

const fe = readFileSync(
  join(root, 'src/infrastructure/session/media/media-token-client.ts'),
  'utf8',
);
assert(!fe.includes('Host-Modus noch nicht verfügbar'), 'soft-DENY removed');
assert(fe.includes('/api/v1/sessions/') || fe.includes('fetchHostSessionMediaToken'), 'FE host path');
assert(
  readFileSync(join(root, 'src/infrastructure/host/host-session-http.ts'), 'utf8').includes(
    '/media-token',
  ),
  'host-session-http media-token',
);

const work = mkdtempSync(join(tmpdir(), 'cut-19-media-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20500 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

let host;
try {
  // Without LiveKit → 503 degraded (membership still works)
  {
    const bareDir = join(work, 'bare');
    mkdirSync(bareDir);
    const barePort = port + 1;
    const bareURL = `http://127.0.0.1:${barePort}`;
    const bare = createHost({
      SAGATREE_DATA_DIR: bareDir,
      SAGATREE_PORT: String(barePort),
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_ENABLE_HOST_AUTH: '1',
      SAGATREE_BETTER_AUTH_SECRET: authSecret,
      SAGATREE_AUTH_BASE_URL: bareURL,
      SAGATREE_AUTH_TRUSTED_ORIGINS: bareURL,
      LIVEKIT_API_KEY: '',
      LIVEKIT_API_SECRET: '',
      LIVEKIT_URL: '',
    });
    assert(!('error' in bare), `bare ${JSON.stringify(bare)}`);
    await bare.start();
    const cookie = await signIn(
      bareURL,
      'bare@cut19.test',
      `Pw-${randomBytes(8).toString('base64url')}`,
    );
    const { sessionId } = await createActiveSession(bareURL, cookie);
    const missing = await httpJson(bareURL, `/api/v1/sessions/${sessionId}/media-token`, {
      method: 'POST',
      cookie,
      headers: { Origin: bareURL },
      body: { sessionId },
    });
    assert(missing.res.status === 503, `bare 503 ${missing.res.status}`);
    assert(missing.json?.ok === false && missing.json?.degraded === true, 'bare degraded');
    assert(missing.json?.reason === 'media_service_unavailable', 'bare reason');
    assert(
      !JSON.stringify(missing.json).includes(API_SECRET),
      'no secret leak on bare',
    );
    await bare.stop();
  }

  host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL,
    LIVEKIT_API_KEY: API_KEY,
    LIVEKIT_API_SECRET: API_SECRET,
    LIVEKIT_URL: LIVEKIT_URL,
  });
  assert(!('error' in host), `host ${JSON.stringify(host)}`);
  await host.start();

  const gmPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const gmCookie = await signIn(baseURL, 'gm@cut19.test', gmPw);
  const strangerCookie = await signIn(baseURL, 'stranger@cut19.test', strangerPw);

  const { sessionId } = await createActiveSession(baseURL, gmCookie);
  const room = deriveMediaRoomId(sessionId);

  const unauth = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/media-token`, {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { sessionId },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);

  const ok = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/media-token`, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {
      sessionId,
      role: 'viewer',
      capabilities: ['director'],
      room: 'hijacked-room',
    },
  });
  assert(ok.res.status === 200 && ok.json?.ok === true, `gm token ${ok.res.status} ${ok.text}`);
  assert(ok.json.roomId === room, 'room server-derived');
  assert(ok.json.url === LIVEKIT_URL, 'livekit url');
  assert(typeof ok.json.token === 'string' && ok.json.token.length > 20, 'jwt present');
  assert(ok.json.grant?.canPublish === true, 'gm canPublish');
  assert(ok.json.ttlSeconds === 120, 'default ttl');

  const claims = await verifyLiveKitAccessToken(ok.json.token, API_SECRET);
  assert(claims, 'jwt verifies');
  assert(claims.room === room, 'jwt room');
  assert(claims.iss === API_KEY, 'jwt iss');
  assert(claims.canPublish === true, 'jwt canPublish');
  assert(!ok.text.includes(API_SECRET), 'response body has no secret');

  const foreign = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/media-token`, {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { sessionId, role: 'gamemaster' },
  });
  assert(foreign.res.status === 403, `foreign ${foreign.res.status}`);
  assert(foreign.json?.reason === 'forbidden', 'foreign forbidden');

  const badTtl = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/media-token`, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { sessionId, ttlSeconds: 'nope' },
  });
  assert(badTtl.res.status === 400, `bad ttl ${badTtl.res.status}`);

  console.log('PASS: cut-19 session-media-token host activate');
} finally {
  if (host) await host.stop().catch(() => undefined);
  rmSync(work, { recursive: true, force: true });
}
