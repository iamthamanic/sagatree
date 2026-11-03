#!/usr/bin/env node
/**
 * fe-host-05-inventory-npc-http.self-test — catalog/NPC write DENY + happy path.
 * Location: scripts/fe-host-05-inventory-npc-http.self-test.mjs
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

const work = mkdtempSync(join(tmpdir(), 'fe-host-05-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19600 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

const npcDraft = {
  name: 'Waldwolf FE-HOST-05',
  description: 'Testkreatur',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'full',
  level: 2,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['wald'],
};

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
  const ownerCookie = await signIn(baseURL, 'owner@fehost05.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost05.test', strangerPassword);

  const unauthItem = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { name: 'No Auth', origin: 'personal', payload: { name: 'No Auth' } },
  });
  assert(unauthItem.res.status === 401, `unauth item create ${unauthItem.res.status}`);

  const createdItem = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'Host Dolch',
      origin: 'personal',
      payload: { name: 'Host Dolch', category: 'weapon' },
    },
  });
  assert(createdItem.res.status === 201, `item create ${createdItem.res.status} ${createdItem.text}`);
  assert(typeof createdItem.json?.item?.id === 'string', 'item id');
  assert(createdItem.json.item.origin === 'personal', 'item origin personal');
  assert(createdItem.json.item.ownerUserId, 'item owner from actor');

  const listedItems = await httpJson(baseURL, '/api/v1/library/items', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listedItems.res.status === 200, `list items ${listedItems.res.status}`);
  assert(
    Array.isArray(listedItems.json?.items) &&
      listedItems.json.items.some((row) => row.id === createdItem.json.item.id),
    'created item listed',
  );

  const strangerItems = await httpJson(baseURL, '/api/v1/library/items', {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(strangerItems.res.status === 200, `stranger list ${strangerItems.res.status}`);
  assert(
    !(strangerItems.json?.items ?? []).some((row) => row.id === createdItem.json.item.id),
    'stranger cannot see owner personal item',
  );

  const forgedWorld = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'Stolen World Blade',
      origin: 'world',
      worldProfileId: 'world-not-owned',
      payload: { name: 'Stolen World Blade' },
    },
  });
  assert(
    forgedWorld.res.status === 403 || forgedWorld.res.status === 422,
    `forged world item ${forgedWorld.res.status}`,
  );

  const createdNpc = await httpJson(baseURL, '/api/v1/library/npc-creatures', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { scope: 'personal', draft: npcDraft },
  });
  assert(createdNpc.res.status === 201, `npc create ${createdNpc.res.status} ${createdNpc.text}`);
  assert(typeof createdNpc.json?.definition?.id === 'string', 'npc id');
  const npcId = createdNpc.json.definition.id;

  const patched = await httpJson(baseURL, `/api/v1/library/npc-creatures/${encodeURIComponent(npcId)}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { draft: { ...npcDraft, name: 'Waldwolf Updated' } },
  });
  assert(patched.res.status === 200, `npc update ${patched.res.status} ${patched.text}`);
  assert(patched.json?.definition?.payload?.name === 'Waldwolf Updated', 'npc name updated');

  const strangerPatch = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(npcId)}`,
    {
      method: 'PATCH',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: { draft: { ...npcDraft, name: 'Hijack' } },
    },
  );
  assert(strangerPatch.res.status === 403, `stranger npc update ${strangerPatch.res.status}`);

  const archived = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(npcId)}/archive`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
    },
  );
  assert(archived.res.status === 200, `npc archive ${archived.res.status}`);
  assert(archived.json?.definition?.status === 'archived', 'npc archived');

  const missingArchive = await httpJson(
    baseURL,
    '/api/v1/library/npc-creatures/personal:00000000-0000-4000-8000-000000000099/archive',
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
    },
  );
  assert(missingArchive.res.status === 404, `missing archive ${missingArchive.res.status}`);

  await host.stop();
  console.log('PASS: fe-host-05-inventory-npc-http.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
