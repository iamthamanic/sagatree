#!/usr/bin/env node
/**
 * cut-16-item-thumbnail.self-test — Host item thumbnail lifecycle (#1151).
 * Location: scripts/cut-16-item-thumbnail.self-test.mjs
 */
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const thumbModUrl = pathToFileURL(
  join(root, 'server/src/modules/inventory/item-thumbnail.ts'),
).href;

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

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pngB64 = Buffer.from(pngBytes).toString('base64');

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED } = await import(thumbModUrl);

assert(ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation');
const routes = readFileSync(join(root, 'server/src/api/item-thumbnail-routes.ts'), 'utf8');
assert(routes.includes('/api/v1/items/thumbnail'), 'action route');
assert(routes.includes('/api/v1/items/:id/thumbnail/upload'), 'REST upload');

const work = mkdtempSync(join(tmpdir(), 'cut-16-thumb-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20300 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

let host;
try {
  // Without Meshy → generate not-configured
  {
    const bareDir = join(work, 'bare');
    mkdirSync(bareDir);
    const barePort = port + 1;
    const bareURL = `http://127.0.0.1:${barePort}`;
    const bare = createHost({
      SAGATREE_DATA_DIR: bareDir,
      SAGATREE_PORT: String(barePort),
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_ENABLE_HOST_AUTH: '1',
      SAGATREE_BETTER_AUTH_SECRET: authSecret,
      SAGATREE_AUTH_BASE_URL: bareURL,
      SAGATREE_AUTH_TRUSTED_ORIGINS: bareURL,
      MESHY_API_KEY: '',
      ITEM_THUMBNAIL_MESHY_MOCK: '',
      MESHY_ASSET_BASE_URL: 'https://assets.test.invalid',
    });
    assert(!('error' in bare), `bare ${JSON.stringify(bare)}`);
    await bare.start();
    const cookie = await signIn(
      bareURL,
      'bare@cut16.test',
      `Pw-${randomBytes(8).toString('base64url')}`,
    );
    const created = await httpJson(bareURL, '/api/v1/library/items', {
      method: 'POST',
      cookie,
      headers: { Origin: bareURL },
      body: {
        name: 'Bare Sword',
        origin: 'personal',
        payload: { name: 'Bare Sword', type: 'weapon', load: 1, cost: 1 },
      },
    });
    assert(created.res.status === 201, `create item ${created.res.status} ${created.text}`);
    const defId = created.json?.item?.id;
    assert(typeof defId === 'string', `def id ${JSON.stringify(created.json)}`);
    const gen = await httpJson(bareURL, '/api/v1/items/thumbnail', {
      method: 'POST',
      cookie,
      headers: { Origin: bareURL },
      body: { action: 'generate', definitionId: defId },
    });
    assert(
      gen.json?.status === 'not-configured',
      `not-configured ${gen.res.status} ${gen.text}`,
    );
    await bare.stop();
  }

  host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL,
    ITEM_THUMBNAIL_MESHY_MOCK: '1',
    MESHY_ASSET_BASE_URL: 'https://assets.test.invalid',
  });
  assert(!('error' in host), `host ${JSON.stringify(host)}`);
  await host.start();

  const ownerPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut16.test', ownerPw);
  const strangerCookie = await signIn(baseURL, 'stranger@cut16.test', strangerPw);

  const unauth = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { action: 'config' },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);

  const cfg = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'config' },
  });
  assert(cfg.res.status === 200 && cfg.json?.status === 'ok', `config ${cfg.text}`);
  assert(cfg.json?.meshyConfigured === true, 'meshy mock configured');

  const created = await httpJson(baseURL, '/api/v1/library/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-16 Blade',
      origin: 'personal',
      payload: { name: 'CUT-16 Blade', type: 'weapon', load: 1, cost: 2 },
    },
  });
  assert(created.res.status === 201, `item ${created.res.status} ${created.text}`);
  const defId = created.json?.item?.id;
  assert(typeof defId === 'string', `defId ${JSON.stringify(created.json)}`);

  const upload = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'upload',
      definitionId: defId,
      contentBase64: pngB64,
      mime: 'image/png',
    },
  });
  assert(upload.res.status === 200 && upload.json?.status === 'ok', `upload ${upload.text}`);
  assert(typeof upload.json?.assetKey === 'string', 'assetKey');
  assert(typeof upload.json?.signedUrl === 'string', 'signedUrl');
  assert(
    String(upload.json.signedUrl).includes('/api/v1/assets/'),
    `durable asset URL ${upload.json.signedUrl}`,
  );
  const assetGet = await fetch(String(upload.json.signedUrl), {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(assetGet.status === 200, `asset GET ${assetGet.status}`);

  const foreignUpload = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'upload',
      definitionId: defId,
      contentBase64: pngB64,
      mime: 'image/png',
    },
  });
  assert(
    foreignUpload.res.status === 403 ||
      foreignUpload.res.status === 404 ||
      foreignUpload.res.status === 500,
    `foreign ${foreignUpload.res.status}`,
  );

  const gen = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'generate', definitionId: defId },
  });
  assert(gen.res.status === 200 && gen.json?.status === 'ok', `generate ${gen.text}`);
  assert(typeof gen.json?.jobId === 'string', 'jobId');

  const status = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'status', jobId: gen.json.jobId },
  });
  assert(status.res.status === 200 && status.json?.status === 'ok', `status ${status.text}`);

  const latest = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'latest-job', definitionId: defId },
  });
  assert(latest.res.status === 200 && latest.json?.status === 'ok', `latest ${latest.text}`);

  // REST alias upload
  const restUpload = await httpJson(baseURL, `/api/v1/items/${defId}/thumbnail/upload`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { contentBase64: pngB64, mime: 'image/png' },
  });
  assert(
    restUpload.res.status === 200 && restUpload.json?.status === 'ok',
    `rest upload ${restUpload.text}`,
  );

  const remove = await httpJson(baseURL, '/api/v1/items/thumbnail', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'remove', definitionId: defId },
  });
  assert(remove.res.status === 200 && remove.json?.status === 'ok', `remove ${remove.text}`);

  console.log('PASS: cut-16 item-thumbnail host activate');
} finally {
  if (host) await host.stop().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
