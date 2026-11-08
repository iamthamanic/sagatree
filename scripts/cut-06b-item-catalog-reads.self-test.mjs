#!/usr/bin/env node
/**
 * cut-06b-item-catalog-reads.self-test — Host character/world item catalog reads.
 * Location: scripts/cut-06b-item-catalog-reads.self-test.mjs
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

const work = mkdtempSync(join(tmpdir(), 'cut-06b-item-'));
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
  assert(host.isReady(), 'ready');

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut06b.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut06b.test', strangerPassword);

  const world = await httpJson(baseURL, '/api/v1/library/worlds', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-06b Welt' },
  });
  assert(world.res.status === 201, `create world ${world.res.status} ${world.text}`);
  const worldId = world.json.world.id;
  assert(typeof worldId === 'string', 'world id');

  const validPayload = {
    name: 'CUT-06b Relikt',
    type: 'misc',
    load: 1,
    cost: 2,
  };
  const createdWorldItem = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-06b Relikt',
      origin: 'world',
      worldProfileId: worldId,
      payload: validPayload,
    },
  });
  assert(
    createdWorldItem.res.status === 201,
    `create world item ${createdWorldItem.res.status} ${createdWorldItem.text}`,
  );
  const worldItemId = createdWorldItem.json.item.id;

  const personal = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-06b Personal',
      origin: 'personal',
      payload: { ...validPayload, name: 'CUT-06b Personal' },
    },
  });
  assert(personal.res.status === 201, `create personal ${personal.res.status}`);
  const personalId = personal.json.item.id;

  const characterList = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(characterList.res.status === 200, `character catalog ${characterList.res.status}`);
  const characterItems = characterList.json.items ?? [];
  assert(
    characterItems.some((row) => row.id === worldItemId),
    'world item in character-scoped list',
  );
  assert(
    characterItems.some((row) => row.id === personalId),
    'personal item in character-scoped list',
  );

  const strangerList = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}`,
    { cookie: strangerCookie, headers: { Origin: baseURL } },
  );
  assert(
    strangerList.res.status === 403 && strangerList.json?.error === 'not-authorized',
    `stranger world list DENY ${strangerList.res.status} ${strangerList.text}`,
  );

  const unauth = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}`,
    { headers: { Origin: baseURL } },
  );
  assert(unauth.res.status === 401, `unauth list ${unauth.res.status}`);

  const archived = await httpJson(baseURL, `/api/v1/library/items/${worldItemId}/archive`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(archived.res.status === 200, `archive ${archived.res.status}`);
  assert(archived.json.item.status === 'archived', 'archived status');

  const activeOnly = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}&origin=world`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(activeOnly.res.status === 200, 'active world-only list');
  assert(
    !(activeOnly.json.items ?? []).some((row) => row.id === worldItemId),
    'archived omitted without includeArchived',
  );

  const worldAuthoring = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1&origin=world`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(worldAuthoring.res.status === 200, `world authoring list ${worldAuthoring.res.status}`);
  const authoringItems = worldAuthoring.json.items ?? [];
  assert(
    authoringItems.some((row) => row.id === worldItemId && row.status === 'archived'),
    'archived world item visible with includeArchived',
  );
  assert(
    authoringItems.every((row) => row.origin === 'world'),
    'origin=world only',
  );
  assert(
    !authoringItems.some((row) => row.id === personalId),
    'personal excluded from world authoring list',
  );

  const strangerAuthoring = await httpJson(
    baseURL,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1&origin=world`,
    { cookie: strangerCookie, headers: { Origin: baseURL } },
  );
  assert(
    strangerAuthoring.res.status === 403,
    `stranger world authoring DENY ${strangerAuthoring.res.status}`,
  );

  // Restart durability
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
  const ownerCookie2 = await signIn(baseURL2, 'owner@cut06b.test', ownerPassword);
  const durable = await httpJson(
    baseURL2,
    `/api/v1/library/items?worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1&origin=world`,
    { cookie: ownerCookie2, headers: { Origin: baseURL2 } },
  );
  assert(durable.res.status === 200, 'list after restart');
  assert(
    (durable.json.items ?? []).some(
      (row) => row.id === worldItemId && row.status === 'archived',
    ),
    'archived world item durable',
  );
  await host2.stop();

  // FE host-only wiring (static)
  const service = readFileSync(join(root, 'src/infrastructure/inventory/item-catalog-service.ts'), 'utf8');
  const serviceCode = service.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(/isHostLibraryEnabled/.test(service), 'item catalog host gate');
  assert(!/supabase\.(from|rpc)|functions\.invoke/.test(serviceCode), 'item catalog no supabase');
  assert(/fetchHostLibraryItems/.test(service), 'FE wires fetchHostLibraryItems');
  assert(/includeArchived:\s*true/.test(service), 'world catalog requests includeArchived');
  assert(/origins:\s*\[\s*['"]world['"]\s*\]/.test(service), 'world catalog origins filter');
  assert(
    /worldProfileId:\s*effectiveWorldProfileId/.test(service),
    'character catalog passes effective worldProfileId',
  );
  assert(
    !/Itemkatalog.*noch nicht verfügbar|Soft-DENY|soft DENY/i.test(service),
    'no Soft-DENY in item-catalog-service',
  );

  const httpClient = readFileSync(join(root, 'src/infrastructure/host/host-library-http.ts'), 'utf8');
  assert(/includeArchived/.test(httpClient), 'host-library-http supports includeArchived');
  assert(/worldProfileId/.test(httpClient), 'host-library-http supports worldProfileId');

  console.log('PASS: cut-06b-item-catalog-reads.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
