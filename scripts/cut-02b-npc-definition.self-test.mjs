#!/usr/bin/env node
/**
 * cut-02b-npc-definition.self-test — Host HTTP duplicate/restore/catalog/promote (#1159).
 * Location: scripts/cut-02b-npc-definition.self-test.mjs
 *
 * Happy duplicate + restore + filtered world catalog + compact→full promote;
 * foreign-owner DENY; unauth DENY.
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

const legalAttrs = {
  strength: 3,
  dexterity: 2,
  endurance: 4,
  mind: 3,
  perception: 2,
  charisma: 1,
};

const compactDraft = {
  name: 'CUT-02b Compact',
  description: 'Compact sheet for promote',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'compact',
  level: 2,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['cut-02b'],
};

const fullDraft = {
  name: 'CUT-02b Full',
  description: 'Full sheet for duplicate/restore',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'full',
  level: 3,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['cut-02b'],
};

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-02b-npc-def-'));
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
  const ownerCookie = await signIn(baseURL, 'owner@cut02b.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut02b.test', strangerPassword);

  const world = await httpJson(baseURL, '/api/v1/library/worlds', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-02b Welt' },
  });
  assert(world.res.status === 201, `world create ${world.res.status} ${world.text}`);
  const worldId = world.json?.world?.id;
  assert(typeof worldId === 'string', 'world id');

  const createdWorldNpc = await httpJson(baseURL, '/api/v1/library/npc-creatures', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { scope: 'world', worldProfileId: worldId, draft: fullDraft },
  });
  assert(
    createdWorldNpc.res.status === 201,
    `world npc create ${createdWorldNpc.res.status} ${createdWorldNpc.text}`,
  );
  const worldDefId = createdWorldNpc.json?.definition?.id;
  assert(typeof worldDefId === 'string', 'world definition id');

  const createdPersonal = await httpJson(baseURL, '/api/v1/library/npc-creatures', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { scope: 'personal', draft: fullDraft },
  });
  assert(
    createdPersonal.res.status === 201,
    `personal npc create ${createdPersonal.res.status} ${createdPersonal.text}`,
  );
  const personalId = createdPersonal.json?.definition?.id;
  assert(typeof personalId === 'string', 'personal definition id');

  const unauthDup = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(personalId)}/duplicate`,
    { method: 'POST', headers: { Origin: baseURL }, body: {} },
  );
  assert(unauthDup.res.status === 401, `unauth duplicate ${unauthDup.res.status}`);

  const strangerDup = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(personalId)}/duplicate`,
    {
      method: 'POST',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(strangerDup.res.status === 403, `stranger duplicate ${strangerDup.res.status}`);

  const dup = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(personalId)}/duplicate`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(dup.res.status === 201, `duplicate ${dup.res.status} ${dup.text}`);
  assert(dup.json?.definition?.id !== personalId, 'duplicate new id');
  assert(dup.json?.definition?.scope === 'personal', 'duplicate personal scope');
  assert(
    String(dup.json?.definition?.payload?.name ?? '').includes('Kopie'),
    'duplicate name has Kopie',
  );

  const archived = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(worldDefId)}/archive`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
    },
  );
  assert(archived.res.status === 200, `archive ${archived.res.status}`);
  assert(archived.json?.definition?.status === 'archived', 'archived status');

  const listActive = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures?scope=world&worldProfileId=${encodeURIComponent(worldId)}`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(listActive.res.status === 200, `list active ${listActive.res.status}`);
  assert(
    !(listActive.json?.definitions ?? []).some((row) => row.id === worldDefId),
    'archived excluded without includeArchived',
  );

  const listArchived = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures?scope=world&worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(listArchived.res.status === 200, `list archived ${listArchived.res.status}`);
  assert(
    (listArchived.json?.definitions ?? []).some(
      (row) => row.id === worldDefId && row.status === 'archived',
    ),
    'archived included with includeArchived=1',
  );

  const strangerList = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures?scope=world&worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1`,
    { cookie: strangerCookie, headers: { Origin: baseURL } },
  );
  assert(strangerList.res.status === 200, `stranger world list ${strangerList.res.status}`);
  assert(
    !(strangerList.json?.definitions ?? []).some((row) => row.id === worldDefId),
    'stranger cannot see foreign world catalog',
  );

  const strangerRestore = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(worldDefId)}/restore`,
    {
      method: 'POST',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(strangerRestore.res.status === 403, `stranger restore ${strangerRestore.res.status}`);

  const restored = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(worldDefId)}/restore`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(restored.res.status === 200, `restore ${restored.res.status} ${restored.text}`);
  assert(restored.json?.definition?.status === 'active', 'restored active');

  const compact = await httpJson(baseURL, '/api/v1/library/npc-creatures', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { scope: 'personal', draft: compactDraft },
  });
  assert(compact.res.status === 201, `compact create ${compact.res.status} ${compact.text}`);
  const compactId = compact.json?.definition?.id;
  assert(typeof compactId === 'string', 'compact id');

  const promoteDraft = {
    ...compactDraft,
    sheetMode: 'full',
    fullSheet: {
      attributes: legalAttrs,
      sagatree_profile: { baseAttributes: legalAttrs },
    },
  };
  const promoted = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(compactId)}`,
    {
      method: 'PATCH',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { draft: promoteDraft },
    },
  );
  assert(promoted.res.status === 200, `promote patch ${promoted.res.status} ${promoted.text}`);
  assert(promoted.json?.definition?.payload?.sheetMode === 'full', 'promoted sheetMode full');
  assert(
    promoted.json?.definition?.payload?.fullSheet?.attributes?.strength === 3,
    'promoted fullSheet attrs',
  );

  const strangerPromote = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures/${encodeURIComponent(compactId)}`,
    {
      method: 'PATCH',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: { draft: { ...promoteDraft, name: 'Hijack' } },
    },
  );
  assert(strangerPromote.res.status === 403, `stranger promote ${strangerPromote.res.status}`);

  // Availability composition uses filtered list HTTP (host-first residual export).
  const availabilityList = await httpJson(
    baseURL,
    `/api/v1/library/npc-creatures?scope=world&worldProfileId=${encodeURIComponent(worldId)}&includeArchived=1`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(
    availabilityList.res.status === 200 &&
      (availabilityList.json?.definitions ?? []).some((row) => row.id === worldDefId),
    'availability source list includes restored world def',
  );

  await host.stop();
  console.log('PASS: cut-02b-npc-definition.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
