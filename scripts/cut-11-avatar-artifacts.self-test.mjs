#!/usr/bin/env node
/**
 * cut-11-avatar-artifacts.self-test — Host Avatar V2 artifact CRUD / authz (#1146).
 * Location: scripts/cut-11-avatar-artifacts.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';

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

const work = mkdtempSync(join(tmpdir(), 'cut-11-avatar-'));
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
  const ownerCookie = await signIn(baseURL, 'owner@cut11.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut11.test', strangerPassword);

  const ownerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: ownerCookie,
  });
  assert(ownerWho.res.status === 200, `owner whoami ${ownerWho.res.status}`);
  const ownerId = ownerWho.json.actorId;
  assert(typeof ownerId === 'string' && ownerId.length > 0, 'owner actorId');

  const createdChar = await httpJson(baseURL, '/api/v1/library/characters', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-11 Held',
      description: 'Avatar artifact source',
      class: 'Wanderer',
      race: 'human',
      level: 1,
      sheet_status: 'draft',
      sheet: { class: 'Wanderer', race: 'human', attributes: {}, skills: {} },
    },
  });
  assert(
    createdChar.res.status === 201,
    `create character ${createdChar.res.status} ${createdChar.text}`,
  );
  const characterId = createdChar.json.character.id;
  assert(typeof characterId === 'string', 'character id');

  const artifactId = randomUUID();
  const storagePath = `${ownerId}/${artifactId}.glb`;
  const created = await httpJson(baseURL, '/api/v1/library/avatar-artifacts', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      artifactId,
      characterId,
      source: { origin: 'import', importAssetId: randomUUID() },
      asset: {
        assetKey: `avatar-asset:${ownerId}:${artifactId}`,
        storagePath,
        format: 'glb',
      },
      materializationStatus: 'materialized',
      analysisStatus: 'pending',
      idempotencyKey: `idem-${artifactId}`,
    },
  });
  assert(created.res.status === 201, `create artifact ${created.res.status} ${created.text}`);
  assert(created.json.artifact?.artifactId === artifactId, 'artifact id');
  assert(created.json.artifact?.asset?.assetKey === `avatar-asset:${ownerId}:${artifactId}`, 'asset key');
  assert(created.json.artifact?.isActive === false, 'inactive on create');

  const retry = await httpJson(baseURL, '/api/v1/library/avatar-artifacts', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      artifactId: randomUUID(),
      characterId,
      source: { origin: 'import' },
      asset: {
        assetKey: `avatar-asset:${ownerId}:other`,
        storagePath: `${ownerId}/other.glb`,
        format: 'glb',
      },
      materializationStatus: 'materialized',
      idempotencyKey: `idem-${artifactId}`,
    },
  });
  assert(retry.res.status === 201, `idempotent create ${retry.res.status}`);
  assert(retry.json.artifact?.artifactId === artifactId, 'idempotent returns same');

  const listed = await httpJson(
    baseURL,
    `/api/v1/library/avatar-artifacts?characterId=${encodeURIComponent(characterId)}`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(listed.res.status === 200, `list ${listed.res.status}`);
  assert(
    (listed.json.artifacts ?? []).some((a) => a.artifactId === artifactId),
    'list includes artifact',
  );

  const got = await httpJson(baseURL, `/api/v1/library/avatar-artifacts/${artifactId}`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(got.res.status === 200, `get ${got.res.status}`);

  const strangerGet = await httpJson(baseURL, `/api/v1/library/avatar-artifacts/${artifactId}`, {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(strangerGet.res.status === 404, `stranger get ${strangerGet.res.status}`);

  const activated = await httpJson(
    baseURL,
    `/api/v1/library/avatar-artifacts/${artifactId}/activate`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(activated.res.status === 200, `activate ${activated.res.status} ${activated.text}`);
  assert(activated.json.ok === true && activated.json.artifact?.isActive === true, 'active');

  const analysis = await httpJson(
    baseURL,
    `/api/v1/library/avatar-artifacts/${artifactId}/analysis`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {
        result: {
          authoritative: true,
          status: 'ready',
          contractVersion: 'SagaDriveAvatarStructureAnalyzerV2',
        },
      },
    },
  );
  assert(analysis.res.status === 200, `analysis ${analysis.res.status} ${analysis.text}`);

  const after = await httpJson(baseURL, `/api/v1/library/avatar-artifacts/${artifactId}`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(after.json.artifact?.analysisStatus === 'ready', 'analysis ready');

  const traversal = await httpJson(baseURL, '/api/v1/library/avatar-artifacts', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      source: { origin: 'import' },
      asset: {
        assetKey: `avatar-asset:${ownerId}:${randomUUID()}`,
        storagePath: '../etc/passwd',
        format: 'glb',
      },
      materializationStatus: 'materialized',
    },
  });
  assert(traversal.res.status === 422 || traversal.res.status === 400, `traversal ${traversal.res.status}`);

  await host.stop();
  console.log('PASS: cut-11-avatar-artifacts.self-test');
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
