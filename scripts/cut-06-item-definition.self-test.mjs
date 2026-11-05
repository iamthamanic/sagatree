#!/usr/bin/env node
/**
 * cut-06-item-definition.self-test — Host item catalog update/archive/restore/fork.
 * Location: scripts/cut-06-item-definition.self-test.mjs
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-06-item-'));
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
  const ownerCookie = await signIn(baseURL, 'owner@cut06.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut06.test', strangerPassword);

  const created = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-06 Dolch',
      origin: 'personal',
      payload: { name: 'CUT-06 Dolch', category: 'weapon' },
    },
  });
  assert(created.res.status === 201, `create ${created.res.status} ${created.text}`);
  const itemId = created.json.item.id;
  assert(typeof itemId === 'string', 'item id');

  const patched = await httpJson(baseURL, `/api/v1/library/items/${itemId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-06 Dolch+',
      payload: { name: 'CUT-06 Dolch+', category: 'weapon', rarity: 'uncommon' },
    },
  });
  assert(patched.res.status === 200, `patch ${patched.res.status} ${patched.text}`);
  assert(patched.json.item.name === 'CUT-06 Dolch+', 'name updated');
  assert(patched.json.item.payload?.rarity === 'uncommon', 'payload updated');
  assert(patched.json.item.origin === 'personal', 'origin immutable');
  assert(patched.json.item.id === itemId, 'id immutable');

  const strangerPatch = await httpJson(baseURL, `/api/v1/library/items/${itemId}`, {
    method: 'PATCH',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { name: 'Stolen', payload: { name: 'Stolen' } },
  });
  assert(strangerPatch.res.status === 403 || strangerPatch.res.status === 404, `stranger patch ${strangerPatch.res.status}`);

  const unauthPatch = await httpJson(baseURL, `/api/v1/library/items/${itemId}`, {
    method: 'PATCH',
    headers: { Origin: baseURL },
    body: { name: 'No Auth', payload: { name: 'No Auth' } },
  });
  assert(unauthPatch.res.status === 401, `unauth patch ${unauthPatch.res.status}`);

  const archived = await httpJson(baseURL, `/api/v1/library/items/${itemId}/archive`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(archived.res.status === 200, `archive ${archived.res.status} ${archived.text}`);
  assert(archived.json.item.status === 'archived', 'archived status');

  const listedAfterArchive = await httpJson(baseURL, '/api/v1/library/items', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listedAfterArchive.res.status === 200, 'list after archive');
  assert(
    !(listedAfterArchive.json.items ?? []).some((row) => row.id === itemId),
    'archived omitted from active list',
  );

  const restored = await httpJson(baseURL, `/api/v1/library/items/${itemId}/restore`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(restored.res.status === 200, `restore ${restored.res.status} ${restored.text}`);
  assert(restored.json.item.status === 'active', 'restored status');

  const forked = await httpJson(baseURL, `/api/v1/library/items/${itemId}/fork`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { origin: 'personal' },
  });
  assert(forked.res.status === 201, `fork ${forked.res.status} ${forked.text}`);
  assert(forked.json.item.id !== itemId, 'fork new id');
  assert(forked.json.item.origin === 'personal', 'fork personal');
  assert(forked.json.item.payload?.forkedFromId === itemId, 'fork provenance');

  const strangerFork = await httpJson(baseURL, `/api/v1/library/items/${itemId}/fork`, {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { origin: 'personal' },
  });
  assert(
    strangerFork.res.status === 404 || strangerFork.res.status === 403,
    `stranger fork ${strangerFork.res.status}`,
  );

  const standard = host.inventory?.seedStandardDefinitionForTests?.({
    name: 'Standard Seed Blade',
    payload: { name: 'Standard Seed Blade' },
  });
  if (standard && typeof standard.id === 'string') {
    const stdUpdate = await httpJson(baseURL, `/api/v1/library/items/${standard.id}`, {
      method: 'PATCH',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { name: 'Hijack', payload: { name: 'Hijack' } },
    });
    assert(
      stdUpdate.res.status === 403 || stdUpdate.res.status === 404,
      `standard immutable ${stdUpdate.res.status}`,
    );
    const stdFork = await httpJson(baseURL, `/api/v1/library/items/${standard.id}/fork`, {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { origin: 'personal' },
    });
    assert(stdFork.res.status === 201, `standard fork ${stdFork.res.status} ${stdFork.text}`);
    assert(stdFork.json.item.id !== standard.id, 'standard fork new id');
  }

  // Restart durability (new port — prior listener may linger briefly after stop)
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
  assert(!('error' in host2), 'host2 create');
  await host2.start();
  const ownerCookie2 = await signIn(baseURL2, 'owner@cut06.test', ownerPassword);
  const listed = await httpJson(baseURL2, '/api/v1/library/items', {
    cookie: ownerCookie2,
    headers: { Origin: baseURL2 },
  });
  assert(listed.res.status === 200, 'list after restart');
  assert(
    (listed.json.items ?? []).some((row) => row.id === itemId && row.name === 'CUT-06 Dolch+'),
    'updated item durable',
  );
  await host2.stop();

  // FE dual-path wiring (static)
  const service = readFileSync(join(root, 'src/infrastructure/inventory/item-catalog-service.ts'), 'utf8');
  assert(/updateHostLibraryItem/.test(service), 'FE wires updateHostLibraryItem');
  assert(/archiveHostLibraryItem/.test(service), 'FE wires archiveHostLibraryItem');
  assert(/restoreHostLibraryItem/.test(service), 'FE wires restoreHostLibraryItem');
  assert(/forkHostLibraryItem/.test(service), 'FE wires forkHostLibraryItem');
  assert(
    !/Item-Definition aktualisieren ist auf dem Host noch nicht verfügbar/.test(service),
    'update Soft-DENY removed',
  );
  assert(
    !/Item-Definition archivieren ist auf dem Host noch nicht verfügbar/.test(service),
    'archive Soft-DENY removed',
  );

  console.log('PASS: cut-06-item-definition.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
