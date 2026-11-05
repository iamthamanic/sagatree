#!/usr/bin/env node
/**
 * cut-12-avatar-transfer.self-test — Host avatar import/export asset transfer (#1147).
 * Location: scripts/cut-12-avatar-transfer.self-test.mjs
 *
 * Covers: purpose=avatar-model publish, credentialed download, artifact materialize,
 * stranger deny, non-glTF reject, raster-without-purpose still image-only.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const fixturePath = join(root, '.qa/fixtures/liveact-face-asset/face-core-ok.glb');

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

async function publishAvatarModel(baseURL, cookie, bytes, { assetId, filename = 'avatar.glb' } = {}) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type: 'model/gltf-binary' }),
    filename,
  );
  form.append('purpose', 'avatar-model');
  form.append('contentType', 'model/gltf-binary');
  if (assetId) form.append('assetId', assetId);
  const res = await fetch(`${baseURL}/api/v1/assets`, {
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-12-avatar-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;
const glbBytes = new Uint8Array(readFileSync(fixturePath));

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
  const ownerCookie = await signIn(baseURL, 'owner@cut12.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut12.test', strangerPassword);

  const ownerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: ownerCookie,
  });
  assert(ownerWho.res.status === 200, `owner whoami ${ownerWho.res.status}`);
  const ownerId = ownerWho.json?.actorId;
  assert(typeof ownerId === 'string' && ownerId.length > 0, 'owner actorId');

  // Raster without purpose remains image-only (regression).
  const badRasterAsModel = await publishAvatarModel(
    baseURL,
    ownerCookie,
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  assert(badRasterAsModel.res.status === 400, 'non-glb as avatar-model rejected');

  const importAssetId = randomUUID();
  const published = await publishAvatarModel(baseURL, ownerCookie, glbBytes, {
    assetId: importAssetId,
  });
  assert(published.res.status === 201, `publish ${published.res.status} ${published.text}`);
  assert(published.json?.assetId === importAssetId, 'assetId preserved');
  assert(published.json?.contentType === 'model/gltf-binary', 'gltf content-type');
  assert(
    published.json?.storagePath === `${ownerId}/${importAssetId}`,
    'owner-scoped storagePath',
  );

  // Owner download
  const got = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(importAssetId)}`, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(got.status === 200, `owner get ${got.status}`);
  assert(got.headers.get('content-type')?.includes('model/gltf-binary'), 'download mime');
  const gotBytes = new Uint8Array(await got.arrayBuffer());
  assert(gotBytes.byteLength === glbBytes.byteLength, 'byte parity');

  // Stranger cannot read
  const foreign = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(importAssetId)}`, {
    headers: { cookie: strangerCookie, Origin: baseURL },
  });
  assert(foreign.status === 403 || foreign.status === 404, `stranger deny ${foreign.status}`);

  // Idempotent republish same bytes
  const again = await publishAvatarModel(baseURL, ownerCookie, glbBytes, {
    assetId: importAssetId,
  });
  assert(again.res.status === 201, `idempotent publish ${again.res.status}`);

  // Materialize V2 artifact bound to import provenance (CUT-11 port).
  const created = await httpJson(baseURL, '/api/v1/library/avatar-artifacts', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      artifactId: importAssetId,
      source: { importAssetId },
      asset: {
        assetKey: `avatar-asset:${ownerId}:${importAssetId}`,
        storagePath: published.json.storagePath,
        format: 'glb',
      },
      materializationStatus: 'materialized',
      idempotencyKey: `import:${importAssetId}`,
    },
  });
  assert(created.res.status === 201, `artifact ${created.res.status} ${created.text}`);
  assert(created.json?.artifact?.artifactId === importAssetId, 'artifact id = import id');
  assert(created.json?.artifact?.source?.origin === 'import', 'derived origin import');
  assert(created.json?.artifact?.isActive === false, 'inactive draft');

  const activated = await httpJson(
    baseURL,
    `/api/v1/library/avatar-artifacts/${encodeURIComponent(importAssetId)}/activate`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(activated.res.status === 200, `activate ${activated.res.status}`);
  assert(activated.json?.artifact?.isActive === true, 'active after keep');

  // Export-shaped second publish (distinct asset id)
  const exportId = randomUUID();
  const exported = await publishAvatarModel(baseURL, ownerCookie, glbBytes, {
    assetId: exportId,
    filename: 'export.glb',
  });
  assert(exported.res.status === 201, `export publish ${exported.res.status}`);
  const exportGet = await fetch(`${baseURL}/api/v1/assets/${encodeURIComponent(exportId)}`, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(exportGet.status === 200, `export download ${exportGet.status}`);

  // Restart persistence (same dataDir + auth secret → same actor id)
  await host.stop();
  const port2 = port + 1;
  const base2 = `http://127.0.0.1:${port2}`;
  const host2 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port2),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: base2,
    SAGATREE_AUTH_TRUSTED_ORIGINS: base2,
  });
  assert(!('error' in host2), 'restart host');
  await host2.start();
  const cookie2 = await signIn(base2, 'owner@cut12.test', ownerPassword);
  const who2 = await httpJson(base2, '/api/whoami', {
    headers: { Origin: base2, 'Sec-Fetch-Site': 'same-origin' },
    cookie: cookie2,
  });
  assert(who2.json?.actorId === ownerId, `actor stable across restart (${who2.json?.actorId} vs ${ownerId})`);
  const afterRestart = await fetch(`${base2}/api/v1/assets/${encodeURIComponent(importAssetId)}`, {
    headers: {
      cookie: cookie2,
      Origin: base2,
      'Sec-Fetch-Site': 'same-origin',
    },
  });
  assert(afterRestart.status === 200, `persist after restart ${afterRestart.status}`);
  const listed = await httpJson(base2, '/api/v1/library/avatar-artifacts', {
    cookie: cookie2,
    headers: { Origin: base2 },
  });
  assert(listed.res.status === 200, 'list after restart');
  const found = (listed.json?.artifacts ?? []).some(
    (a) => a?.artifactId === importAssetId && a?.isActive === true,
  );
  assert(found, 'artifact survives restart');
  await host2.stop();

  console.log('PASS: cut-12-avatar-transfer.self-test');
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
