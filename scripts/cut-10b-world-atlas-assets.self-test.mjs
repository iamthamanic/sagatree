#!/usr/bin/env node
/**
 * cut-10b-world-atlas-assets.self-test — Host world map/atlas asset uploads (#1161).
 * Location: scripts/cut-10b-world-atlas-assets.self-test.mjs
 *
 * Covers: world.edit gate for map-pin + azgaar publish, credentialed signed read,
 * stranger deny, invalid MIME reject. Soft-DENY must not remain in FE services.
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
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

/** Minimal PNG (8-byte signature + IHDR stub enough for sniff). */
function minimalPng() {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

function minimalAzgaarJson() {
  return new TextEncoder().encode(JSON.stringify({ info: { version: '1.0', name: 'cut-10b' } }));
}

async function publishWorldAsset(baseURL, cookie, worldId, bytes, purpose, contentType, filename) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), filename);
  form.append('purpose', purpose);
  form.append('contentType', contentType);
  const res = await fetch(`${baseURL}/api/v1/worlds/${encodeURIComponent(worldId)}/assets`, {
    method: 'POST',
    headers: { cookie, Origin: baseURL, Accept: 'application/json' },
    body: form,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

// Soft-DENY must be gone from product facades.
const mapSvc = readFileSync(join(root, 'src/infrastructure/world/world-map-service.ts'), 'utf8');
const atlasSvc = readFileSync(
  join(root, 'src/infrastructure/world/world-atlas-service.ts'),
  'utf8',
);
assert(!mapSvc.includes('noch nicht verfügbar'), 'map soft-DENY removed');
assert(!atlasSvc.includes('noch nicht verfügbar'), 'atlas soft-DENY removed');
assert(mapSvc.includes('publishHostWorldAsset'), 'map uses world asset publish');
assert(atlasSvc.includes('publishHostWorldAsset'), 'atlas uses world asset publish');
assert(atlasSvc.includes('resolveHostWorldAssetUrl'), 'atlas signed URL resolver');

const routes = readFileSync(join(root, 'server/src/api/world-atlas-routes.ts'), 'utf8');
assert(routes.includes("/api/v1/worlds/:worldId/assets"), 'world assets route');
assert(routes.includes('MAP_PIN_PURPOSE'), 'map-pin purpose');
assert(routes.includes('AZGAAR_PURPOSE'), 'azgaar purpose');
assert(routes.includes("authorize('world.edit'"), 'world.edit authz');

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-10b-assets-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20400 + Math.floor(Math.random() * 1000);
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
  const ownerCookie = await signIn(baseURL, 'owner@cut10b.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut10b.test', strangerPassword);

  const ownerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: ownerCookie,
  });
  assert(ownerWho.res.status === 200, `owner whoami ${ownerWho.res.status}`);
  const ownerId = ownerWho.json?.actorId;
  assert(typeof ownerId === 'string' && ownerId.length > 0, 'owner actorId');

  const created = await httpJson(baseURL, '/api/v1/library/worlds', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-10b World' },
  });
  assert(created.res.status === 201, `create world ${created.res.status} ${created.text}`);
  const worldId = created.json?.world?.id;
  assert(typeof worldId === 'string' && worldId.length > 0, `world id ${created.text}`);

  // --- map-pin happy path ---
  const png = minimalPng();
  const pin = await publishWorldAsset(
    baseURL,
    ownerCookie,
    worldId,
    png,
    'map-pin',
    'image/png',
    'pin.png',
  );
  assert(pin.res.status === 201, `pin publish ${pin.res.status} ${pin.text}`);
  assert(pin.json?.storagePath === `${ownerId}/${pin.json?.assetId}`, 'owner storagePath');
  assert(typeof pin.json?.url === 'string' && pin.json.url.includes('/api/v1/assets/'), 'pin url');

  const pinGet = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(pin.json.assetId)}`, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(pinGet.status === 200, `owner pin get ${pinGet.status}`);
  assert(pinGet.headers.get('content-type')?.includes('image/png'), 'pin mime');

  // --- azgaar happy path + signed-url successor ---
  const azgaarBytes = minimalAzgaarJson();
  const azgaar = await publishWorldAsset(
    baseURL,
    ownerCookie,
    worldId,
    azgaarBytes,
    'azgaar',
    'application/json',
    'world.map',
  );
  assert(azgaar.res.status === 201, `azgaar publish ${azgaar.res.status} ${azgaar.text}`);
  assert(azgaar.json?.contentType === 'application/json', 'azgaar sniffed json');
  const signedPath = azgaar.json.storagePath;
  const signedUrl = `${baseURL}/api/v1/assets/${encodeURIComponent(azgaar.json.assetId)}`;
  assert(azgaar.json.url === signedUrl, 'createSignedUrl successor matches publish url');
  const azgaarGet = await fetch(signedUrl, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(azgaarGet.status === 200, `azgaar download ${azgaarGet.status}`);
  const downloaded = new TextDecoder().decode(await azgaarGet.arrayBuffer());
  assert(downloaded.includes('cut-10b'), 'azgaar bytes round-trip');
  assert(typeof signedPath === 'string' && signedPath.startsWith(`${ownerId}/`), 'azgaar path');

  // --- foreign owner denied on publish ---
  const foreignPin = await publishWorldAsset(
    baseURL,
    strangerCookie,
    worldId,
    png,
    'map-pin',
    'image/png',
    'evil.png',
  );
  assert(foreignPin.res.status === 403, `stranger pin deny ${foreignPin.res.status}`);

  const foreignAzgaar = await publishWorldAsset(
    baseURL,
    strangerCookie,
    worldId,
    azgaarBytes,
    'azgaar',
    'application/json',
    'evil.map',
  );
  assert(foreignAzgaar.res.status === 403, `stranger azgaar deny ${foreignAzgaar.res.status}`);

  // --- stranger cannot read owner asset ---
  const foreignGet = await fetch(
    `${baseURL}/api/v1/assets/${encodeURIComponent(azgaar.json.assetId)}`,
    { headers: { cookie: strangerCookie, Origin: baseURL } },
  );
  assert(
    foreignGet.status === 403 || foreignGet.status === 404,
    `stranger read deny ${foreignGet.status}`,
  );

  // --- invalid MIME ---
  const badPin = await publishWorldAsset(
    baseURL,
    ownerCookie,
    worldId,
    new Uint8Array([1, 2, 3, 4]),
    'map-pin',
    'application/pdf',
    'x.pdf',
  );
  assert(badPin.res.status === 400, `bad pin mime ${badPin.res.status}`);

  const badAzgaar = await publishWorldAsset(
    baseURL,
    ownerCookie,
    worldId,
    new Uint8Array([0xff, 0xd8, 0xff]),
    'azgaar',
    'image/jpeg',
    'not.map',
  );
  assert(badAzgaar.res.status === 400, `bad azgaar mime ${badAzgaar.res.status}`);

  // Actor-only /api/v1/assets must not replace world.edit gate for this ticket.
  assert(
    routes.includes('world.edit'),
    'world assets route must authorize world.edit (not actor-only assets)',
  );

  await host.stop();
  console.log('PASS: cut-10b-world-atlas-assets.self-test');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
