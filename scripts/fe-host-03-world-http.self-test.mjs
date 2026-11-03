#!/usr/bin/env node
/**
 * fe-host-03-world-http.self-test — atlas/map/places product HTTP + DENY.
 * Location: scripts/fe-host-03-world-http.self-test.mjs
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

const work = mkdtempSync(join(tmpdir(), 'fe-host-03-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19400 + Math.floor(Math.random() * 1000);
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
  const ownerCookie = await signIn(baseURL, 'owner@fehost03.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost03.test', strangerPassword);

  const ownerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: ownerCookie,
  });
  assert(ownerWho.res.status === 200, `owner whoami ${ownerWho.res.status}`);
  const ownerActorId = ownerWho.json.actorId;

  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  pdb.exec(`
    INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-fehost03', '${ownerActorId.replace(/'/g, "''")}', 'Dornhain FE-HOST-03', '2026-11-03T00:00:00.000Z');
    INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at, public_id, status)
    VALUES ('proj-fehost03', 'world-fehost03', '${ownerActorId.replace(/'/g, "''")}', 'P', '2026-11-03T00:00:00.000Z', 'SA-FEH03', 'active');
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('proj-fehost03', '${ownerActorId.replace(/'/g, "''")}', 'gm', 1, '2026-11-03T00:00:00.000Z');
  `);
  pdb.close();

  const unauth = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/atlas/ensure-root', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: {},
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth DENY ${unauth.res.status}`);

  const ensure = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/atlas/ensure-root', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(ensure.res.status === 200, `ensure-root ${ensure.res.status} ${ensure.text}`);
  assert(Array.isArray(ensure.json?.maps) && ensure.json.maps.length >= 1, 'root maps');

  const mapList = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/atlas/maps', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(mapList.res.status === 200, `list maps ${mapList.res.status}`);
  const rootMapId = mapList.json?.maps?.[0]?.id;
  assert(typeof rootMapId === 'string', 'rootMapId');

  const getMap = await httpJson(baseURL, `/api/v1/worlds/atlas/maps/${rootMapId}`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(getMap.res.status === 200, `get map ${getMap.res.status} ${getMap.text}`);
  assert(getMap.json?.id === rootMapId, 'map id');

  const saveMap = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/map', {
    method: 'PUT',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      expectedRevision: 0,
      mapData: { size: 24, tiles: {}, countries: [], pins: [] },
    },
  });
  assert(saveMap.res.status === 200, `save world map ${saveMap.res.status} ${saveMap.text}`);

  const loadMap = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/map', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(loadMap.res.status === 200, `load world map ${loadMap.res.status}`);
  assert(typeof loadMap.json?.revision === 'number', 'revision');

  const place = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/places', {
    method: 'PUT',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      kind: 'settlement',
      name: 'Dorfplatz',
      status: 'draft',
      sortOrder: 0,
    },
  });
  assert(place.res.status === 200, `upsert place ${place.res.status} ${place.text}`);
  assert(typeof place.json?.id === 'string', 'place id');

  const places = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/places', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(places.res.status === 200, `list places ${places.res.status}`);
  assert(Array.isArray(places.json?.places) && places.json.places.length >= 1, 'places');

  const strangerAtlas = await httpJson(baseURL, '/api/v1/worlds/world-fehost03/atlas/maps', {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    strangerAtlas.res.status === 403 || strangerAtlas.res.status === 404,
    `stranger atlas DENY ${strangerAtlas.res.status}`,
  );

  const missing = await httpJson(baseURL, '/api/v1/worlds/atlas/maps/no-such-map-id', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    missing.res.status === 403 || missing.res.status === 404,
    `missing map ${missing.res.status}`,
  );

  console.log('PASS: fe-host-03-world-http.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
