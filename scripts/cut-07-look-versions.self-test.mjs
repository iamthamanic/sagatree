#!/usr/bin/env node
/**
 * cut-07-look-versions.self-test — Host LookProfile appendVersion + full history.
 * Location: scripts/cut-07-look-versions.self-test.mjs
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

const lookDraft = (displayName) => ({
  displayName,
  source: 'manual',
  references: [],
  capabilities: ['character'],
  executionModes: ['realtime'],
  ownerScope: 'player-character',
});

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-07-look-'));
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
  const ownerCookie = await signIn(baseURL, 'owner@cut07.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut07.test', strangerPassword);

  const created = await httpJson(baseURL, '/api/v1/library/looks', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { draft: lookDraft('Nordlicht v1') },
  });
  assert(created.res.status === 201, `create ${created.res.status} ${created.text}`);
  const profileId = created.json.look.profile.id;
  assert(created.json.look.profile.currentVersion === 1, 'start at v1');

  const append1 = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { draft: lookDraft('Nordlicht v2') },
  });
  assert(append1.res.status === 201, `append1 ${append1.res.status} ${append1.text}`);
  assert(append1.json.look.profile.currentVersion === 2, 'current v2');
  assert(append1.json.look.current.displayName === 'Nordlicht v2', 'current payload v2');

  const append2 = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { draft: lookDraft('Nordlicht v3') },
  });
  assert(append2.res.status === 201, `append2 ${append2.res.status} ${append2.text}`);
  assert(append2.json.look.profile.currentVersion === 3, 'current v3');

  const listed = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, `list ${listed.res.status}`);
  assert(Array.isArray(listed.json.versions) && listed.json.versions.length === 3, 'three versions');
  assert(listed.json.versions[0].displayName === 'Nordlicht v1', 'v1 immutable');
  assert(listed.json.versions[1].displayName === 'Nordlicht v2', 'v2 immutable');
  assert(listed.json.versions[2].displayName === 'Nordlicht v3', 'v3 current');

  const strangerList = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    strangerList.res.status === 403 || strangerList.res.status === 404,
    `stranger list ${strangerList.res.status}`,
  );

  const strangerAppend = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { draft: lookDraft('Stolen') },
  });
  assert(
    strangerAppend.res.status === 403 || strangerAppend.res.status === 404,
    `stranger append ${strangerAppend.res.status}`,
  );

  const unauth = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { draft: lookDraft('No Auth') },
  });
  assert(unauth.res.status === 401, `unauth ${unauth.res.status}`);

  const archived = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/archive`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(archived.res.status === 200, `archive ${archived.res.status}`);
  const appendArchived = await httpJson(baseURL, `/api/v1/library/looks/${profileId}/versions`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { draft: lookDraft('After archive') },
  });
  assert(appendArchived.res.status === 400, `append archived ${appendArchived.res.status}`);

  await host.stop();
  await new Promise((r) => setTimeout(r, 250));
  const port2 = port + 1;
  const baseURL2 = `http://127.0.0.1:${port2}`;
  const host2 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port2),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL2,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL2,
  });
  assert(!('error' in host2), 'host2');
  await host2.start();
  const ownerCookie2 = await signIn(baseURL2, 'owner@cut07.test', ownerPassword);
  const listed2 = await httpJson(baseURL2, `/api/v1/library/looks/${profileId}/versions`, {
    cookie: ownerCookie2,
    headers: { Origin: baseURL2 },
  });
  assert(listed2.res.status === 200, 'list after restart');
  assert(listed2.json.versions?.length === 3, 'history durable');
  await host2.stop();

  const service = readFileSync(join(root, 'src/infrastructure/look/look-service.ts'), 'utf8');
  assert(/appendHostLibraryLookVersion/.test(service), 'FE append wired');
  assert(/fetchHostLibraryLookVersions/.test(service), 'FE list wired');
  assert(
    !/Look-Version anhängen ist auf dem Host noch nicht verfügbar/.test(service),
    'Soft-DENY removed',
  );

  console.log('PASS: cut-07-look-versions.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
