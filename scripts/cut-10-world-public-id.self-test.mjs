#!/usr/bin/env node
/**
 * cut-10-world-public-id.self-test — Host world lookup by WO- public id.
 * Location: scripts/cut-10-world-public-id.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

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

const work = mkdtempSync(join(tmpdir(), 'cut-10-world-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
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

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut10.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut10.test', strangerPassword);

  const created = await httpJson(baseURL, '/api/v1/library/worlds', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-10 Welt' },
  });
  assert(created.res.status === 201, `create world ${created.res.status} ${created.text}`);
  const worldId = created.json.world.id;
  const publicId = created.json.world.publicId;
  assert(typeof worldId === 'string', 'world id');
  assert(
    typeof publicId === 'string' && /^WO-[A-Z2-9]{5}$/.test(publicId),
    `publicId ${publicId}`,
  );

  const listed = await httpJson(baseURL, '/api/v1/library/worlds', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, `list ${listed.res.status}`);
  const listedRow = (listed.json.worlds ?? []).find((w) => w.id === worldId);
  assert(listedRow?.publicId === publicId, 'list includes publicId');

  const byPublic = await httpJson(
    baseURL,
    `/api/v1/library/worlds/by-public-id/${encodeURIComponent(publicId.toLowerCase())}`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(byPublic.res.status === 200, `by-public ${byPublic.res.status} ${byPublic.text}`);
  assert(byPublic.json.world.id === worldId, 'id match');
  assert(byPublic.json.world.publicId === publicId, 'publicId match');

  const missing = await httpJson(
    baseURL,
    '/api/v1/library/worlds/by-public-id/WO-ZZZZZ',
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(missing.res.status === 404, `missing ${missing.res.status}`);

  const stranger = await httpJson(
    baseURL,
    `/api/v1/library/worlds/by-public-id/${encodeURIComponent(publicId)}`,
    { cookie: strangerCookie, headers: { Origin: baseURL } },
  );
  assert(
    stranger.res.status === 404 || stranger.res.status === 403,
    `stranger denied ${stranger.res.status}`,
  );

  await host.stop();
  console.log('PASS: cut-10-world-public-id.self-test');
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
