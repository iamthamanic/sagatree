#!/usr/bin/env node
/**
 * fe-host-02-session-http.self-test — product session HTTP create/runtime DENY.
 * Location: scripts/fe-host-02-session-http.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-02-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19300 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

try {
  const host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL,
  });
  assert(!('error' in host), `host create: ${JSON.stringify(host)}`);
  await host.start();
  assert(host.isReady(), 'ready');

  const gmPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const gmCookie = await signIn(baseURL, 'gm@fehost02.test', gmPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost02.test', strangerPassword);

  const gmWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(gmWho.res.status === 200, `gm whoami ${gmWho.res.status}`);
  const gmActorId = gmWho.json.actorId;

  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  pdb.exec(`
    INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-fehost02', '${gmActorId.replace(/'/g, "''")}', 'W', '2026-11-03T00:00:00.000Z');
    INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('proj-fehost02', 'world-fehost02', '${gmActorId.replace(/'/g, "''")}', 'P', '2026-11-03T00:00:00.000Z');
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('proj-fehost02', '${gmActorId.replace(/'/g, "''")}', 'gm', 1, '2026-11-03T00:00:00.000Z');
  `);
  pdb.close();

  const unauth = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { projectId: 'proj-fehost02', name: 'NoAuth' },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth DENY ${unauth.res.status}`);

  const created = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId: 'proj-fehost02', name: 'Abend FE-HOST-02' },
  });
  assert(created.res.status === 201, `create session ${created.res.status} ${created.text}`);
  const sessionId = created.json?.session?.sessionId;
  assert(typeof sessionId === 'string', 'sessionId');

  const strangerCreate = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { projectId: 'proj-fehost02', name: 'Hack' },
  });
  assert(
    strangerCreate.res.status === 403 || strangerCreate.res.status === 400,
    `stranger create DENY ${strangerCreate.res.status}`,
  );

  const missing = await httpJson(baseURL, '/api/v1/sessions/no-such-session', {
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(missing.res.status === 404 || missing.res.status === 403, `missing ${missing.res.status}`);

  const snap = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/runtime`, {
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(snap.res.status === 200, `runtime ${snap.res.status} ${snap.text}`);
  const revision = typeof snap.json?.revision === 'number' ? snap.json.revision : 0;

  const cmd = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/runtime/presence`, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {
      expectedRevision: revision,
      isOnline: true,
      idempotencyKey: 'fe-host-02-presence-1',
    },
  });
  assert(cmd.res.status === 200, `presence ${cmd.res.status} ${cmd.text}`);

  const strangerSnap = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/runtime`, {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    strangerSnap.res.status === 403 || strangerSnap.res.status === 404,
    `stranger snap DENY ${strangerSnap.res.status}`,
  );

  console.log('PASS: fe-host-02-session-http.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
