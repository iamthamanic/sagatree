#!/usr/bin/env node
/**
 * fe-host-06-assets-http.self-test — asset publish/get + portrait character bind.
 * Location: scripts/fe-host-06-assets-http.self-test.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

/** Minimal valid 1×1 PNG. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

const work = mkdtempSync(join(tmpdir(), 'fe-host-06-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19700 + Math.floor(Math.random() * 1000);
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

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@fehost06.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost06.test', strangerPassword);

  // Fall 2 — unauthenticated publish DENY
  const unauth = await httpJson(baseURL, '/api/v1/assets', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: {
      contentType: 'image/png',
      bytesBase64: PNG_BYTES.toString('base64'),
    },
  });
  assert(unauth.res.status === 401, `unauth publish ${unauth.res.status}`);

  // Fall 1 — owner publish + get
  const published = await httpJson(baseURL, '/api/v1/assets', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      contentType: 'image/png',
      bytesBase64: PNG_BYTES.toString('base64'),
    },
  });
  assert(published.res.status === 201, `publish status ${published.res.status} ${published.text}`);
  assert(typeof published.json?.assetId === 'string', 'assetId');
  assert(typeof published.json?.url === 'string' && published.json.url.includes('/api/v1/assets/'), 'url');
  assert(
    typeof published.json?.storagePath === 'string' && published.json.storagePath.includes('/'),
    'storagePath',
  );
  const expectedChecksum = createHash('sha256').update(PNG_BYTES).digest('hex');
  assert(published.json.checksumSha256 === expectedChecksum, 'checksum');

  const assetId = published.json.assetId;
  const getOwner = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(assetId)}`, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(getOwner.status === 200, `owner get ${getOwner.status}`);
  assert((getOwner.headers.get('content-type') || '').startsWith('image/png'), 'content-type');
  const gotBytes = Buffer.from(await getOwner.arrayBuffer());
  assert(gotBytes.equals(PNG_BYTES), 'bytes round-trip');

  // Fall 2 — stranger DENY (no payload)
  const getStranger = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(assetId)}`, {
    headers: { cookie: strangerCookie, Origin: baseURL },
  });
  assert(getStranger.status === 403, `stranger get ${getStranger.status}`);
  const strangerBody = await getStranger.text();
  assert(!strangerBody.includes(PNG_BYTES.toString('base64')), 'no leak');

  // Fall 3 — missing asset (ports collapse missing→not-authorized; HTTP 403 not-found)
  const missing = await fetch(`${baseURL}/api/v1/assets/doesnotexist000000000000000000`, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(missing.status === 403 || missing.status === 404, `missing ${missing.status}`);
  const missingJson = await missing.json().catch(() => ({}));
  assert(missingJson?.error === 'not-found', `missing body ${JSON.stringify(missingJson)}`);

  // Portrait bind on character update via display URL
  const created = await httpJson(baseURL, '/api/v1/library/characters', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'Portrait Hero', class: 'Ranger', race: 'Elf', level: 1 },
  });
  assert(created.res.status === 201, `create char ${created.res.status}`);
  const characterId = created.json?.character?.id;
  assert(typeof characterId === 'string', 'characterId');

  const patched = await httpJson(baseURL, `/api/v1/library/characters/${characterId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { portrait_url: published.json.url },
  });
  assert(patched.res.status === 200, `patch portrait ${patched.res.status} ${patched.text}`);
  assert(
    typeof patched.json?.character?.portraitUrl === 'string' &&
      patched.json.character.portraitUrl.includes(`/api/v1/assets/${assetId}`),
    `portrait display url ${patched.json?.character?.portraitUrl}`,
  );

  // Foreign display URL must fail (stranger's asset)
  const strangerPub = await httpJson(baseURL, '/api/v1/assets', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: {
      contentType: 'image/png',
      bytesBase64: PNG_BYTES.toString('base64'),
    },
  });
  assert(strangerPub.res.status === 201, 'stranger publish');
  const foreignPatch = await httpJson(baseURL, `/api/v1/library/characters/${characterId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { portrait_url: strangerPub.json.url },
  });
  assert(foreignPatch.res.status === 400, `foreign portrait ${foreignPatch.res.status}`);

  console.log('OK: fe-host-06-assets-http.self-test');
  await host.stop();
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
