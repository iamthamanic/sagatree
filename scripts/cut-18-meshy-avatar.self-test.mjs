#!/usr/bin/env node
/**
 * cut-18-meshy-avatar.self-test — Host character avatar Meshy activate (#1153).
 * Location: scripts/cut-18-meshy-avatar.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const modUrl = pathToFileURL(
  join(root, 'server/src/modules/character/character-avatar-meshy.ts'),
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED } = await import(modUrl);

assert(CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation');
const routes = readFileSync(join(root, 'server/src/api/ai-routes.ts'), 'utf8');
assert(routes.includes('/api/v1/ai/character-avatar-meshy'), 'action route');
const fe = readFileSync(
  join(root, 'src/infrastructure/character/avatar/character-avatar-meshy-service.ts'),
  'utf8',
);
assert(fe.includes('/api/v1/ai/character-avatar-meshy'), 'FE host path');
assert(!fe.includes('ohne Meshy-Edge nicht verfügbar'), 'soft-DENY removed');

const work = mkdtempSync(join(tmpdir(), 'cut-18-avatar-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20400 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

let host;
try {
  // Without Meshy → start not-configured
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
      CHARACTER_AVATAR_MESHY_MOCK: '',
      ITEM_THUMBNAIL_MESHY_MOCK: '',
      ITEM_MODEL3D_MESHY_MOCK: '',
      MESHY_AVATAR_USE_MOCK: '',
    });
    assert(!('error' in bare), `bare ${JSON.stringify(bare)}`);
    await bare.start();
    const cookie = await signIn(
      bareURL,
      'bare@cut18.test',
      `Pw-${randomBytes(8).toString('base64url')}`,
    );
    const cfg = await httpJson(bareURL, '/api/v1/ai/character-avatar-meshy', {
      method: 'POST',
      cookie,
      headers: { Origin: bareURL },
      body: { action: 'config' },
    });
    assert(cfg.res.status === 200 && cfg.json?.status === 'ok', `bare config ${cfg.text}`);
    assert(cfg.json?.meshyConfigured === false, 'bare not configured');
    const start = await httpJson(bareURL, '/api/v1/ai/character-avatar-meshy', {
      method: 'POST',
      cookie,
      headers: { Origin: bareURL },
      body: {
        action: 'start',
        clientNonce: 'bare-nonce',
        generationMode: 'text',
        prompt: 'abcdefghijkl',
      },
    });
    assert(
      start.json?.status === 'not-configured',
      `bare start not-configured ${start.res.status} ${start.text}`,
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
    CHARACTER_AVATAR_MESHY_MOCK: '1',
  });
  assert(!('error' in host), `host ${JSON.stringify(host)}`);
  await host.start();

  const ownerPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPw = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut18.test', ownerPw);
  const strangerCookie = await signIn(baseURL, 'stranger@cut18.test', strangerPw);

  const unauth = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { action: 'config' },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);

  const cfg = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'config' },
  });
  assert(cfg.res.status === 200 && cfg.json?.status === 'ok', `config ${cfg.text}`);
  assert(cfg.json?.meshyConfigured === true, 'meshy mock configured');

  const badPrompt = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'start', clientNonce: 'n1', prompt: 'short' },
  });
  assert(badPrompt.res.status === 400 || badPrompt.json?.status === 'error', 'short prompt');

  const started = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'start',
      clientNonce: 'cut18-nonce-1',
      generationMode: 'text',
      prompt: 'a brave ranger stands ready for adventure',
    },
  });
  assert(started.res.status === 200 && started.json?.status === 'ok', `start ${started.text}`);
  const jobId = started.json?.job?.id;
  assert(typeof jobId === 'string' && jobId.length > 0, `jobId ${JSON.stringify(started.json)}`);

  const foreign = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { action: 'poll', jobId },
  });
  assert(
    foreign.res.status === 404 || foreign.json?.status === 'error',
    `foreign poll ${foreign.res.status}`,
  );

  const poll = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'poll', jobId },
  });
  assert(poll.res.status === 200 && poll.json?.status === 'ok', `poll ${poll.text}`);
  assert(poll.json?.job?.status === 'succeeded', `succeeded ${JSON.stringify(poll.json?.job)}`);
  assert(typeof poll.json?.modelUrl === 'string', 'modelUrl');
  assert(
    String(poll.json.modelUrl).includes('/api/v1/assets/'),
    `durable asset URL ${poll.json.modelUrl}`,
  );
  const assetGet = await fetch(String(poll.json.modelUrl), {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(assetGet.status === 200, `asset GET ${assetGet.status}`);

  const denySign = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { action: 'signStoragePath', storagePath: `owner/avatars/${jobId}.glb` },
  });
  assert(
    denySign.res.status === 403 || denySign.json?.status === 'error',
    `stranger sign ${denySign.res.status}`,
  );

  const replay = await httpJson(baseURL, '/api/v1/ai/character-avatar-meshy', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'start',
      clientNonce: 'cut18-nonce-1',
      generationMode: 'text',
      prompt: 'a brave ranger stands ready for adventure',
    },
  });
  assert(replay.res.status === 200 && replay.json?.status === 'ok', `replay ${replay.text}`);
  assert(replay.json?.replayed === true, 'idempotent replay');

  console.log('PASS: cut-18 meshy-avatar host activate');
} finally {
  if (host) await host.stop().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
