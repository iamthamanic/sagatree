#!/usr/bin/env node
/**
 * cut-13-character-lore.self-test — Host character-lore generate-background (#1148).
 * Location: scripts/cut-13-character-lore.self-test.mjs
 *
 * Injected deterministic OpenAI-compatible inference adapter (local mock server).
 * Covers: configured OK, not-configured, 401, foreign project deny, rate limit.
 */
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const loreModUrl = pathToFileURL(
  join(root, 'server/src/modules/character/character-lore.ts'),
).href;

const STORY =
  'In den Grenzlanden wuchs Aria unter dem Schatten alter Steine auf. ' +
  'Ihre Neugier trieb sie über den Pass, und die Freiheit der Wälder wurde ihr Ideal.';

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

/** Local OpenAI-compatible mock — real HTTP, deterministic story. */
function startMockLlm() {
  let invocations = 0;
  const server = createServer((req, res) => {
    if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/chat/completions')) {
      invocations += 1;
      const payload = JSON.stringify({
        choices: [{ message: { role: 'assistant', content: STORY } }],
      });
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}/v1`,
        get invocations() {
          return invocations;
        },
        close: () =>
          new Promise((r, j) => {
            server.close((err) => (err ? j(err) : r()));
          }),
      });
    });
  });
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { characterLoreMinimalContext, CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED } =
  await import(loreModUrl);

assert(CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation flag true');

const mock = await startMockLlm();
const work = mkdtempSync(join(tmpdir(), 'cut-13-lore-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19900 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

let host;
try {
  // --- Host without provider → not-configured ---
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
      // Explicitly no CHARACTER_AI_MODEL
      CHARACTER_AI_PROVIDER: 'ollama',
      CHARACTER_AI_MODEL: '',
      OLLAMA_MODEL: '',
    });
    assert(!('error' in bare), `bare host: ${JSON.stringify(bare)}`);
    await bare.start();
    const bareCookie = await signIn(bareURL, 'bare@cut13.test', `Pw-${randomBytes(8).toString('base64url')}`);
    const missing = await httpJson(bareURL, '/api/v1/ai/character-lore', {
      method: 'POST',
      cookie: bareCookie,
      headers: { Origin: bareURL },
      body: characterLoreMinimalContext(),
    });
    assert(missing.res.status === 200, `not-configured status ${missing.res.status}`);
    assert(missing.json?.status === 'not-configured', 'not-configured envelope');
    assert(typeof missing.json?.message === 'string' && missing.json.message.length > 0, 'degraded message');
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
    CHARACTER_AI_PROVIDER: 'openai-compatible',
    CHARACTER_AI_BASE_URL: mock.baseUrl,
    CHARACTER_AI_API_KEY: 'test-key-not-secret-for-fixture',
    CHARACTER_AI_MODEL: 'cut13-mock',
  });
  assert(!('error' in host), `host create: ${JSON.stringify(host)}`);
  await host.start();

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut13.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut13.test', strangerPassword);

  // 401 without cookie
  const unauth = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: characterLoreMinimalContext(),
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);
  assert(unauth.json?.status === 'error', 'unauth error envelope');

  // Positive generate (setting-neutral, no project)
  const beforeInv = mock.invocations;
  const ok = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: characterLoreMinimalContext(),
  });
  assert(ok.res.status === 200, `ok status ${ok.res.status} ${ok.text}`);
  assert(ok.json?.status === 'ok', 'ok envelope');
  assert(ok.json?.story === STORY, 'story from mock provider');
  assert(ok.json?.provider === 'openai-compatible', 'provider');
  assert(ok.json?.model === 'cut13-mock', 'model');
  assert(mock.invocations === beforeInv + 1, 'provider invoked once');

  // Owner project + stranger deny (legacy 500)
  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-13 Kampagne', description: 'Lore project' },
  });
  assert(
    createdProject.res.status === 201,
    `project ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  assert(typeof projectId === 'string', 'project id');

  const beforeDeny = mock.invocations;
  const denied = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: characterLoreMinimalContext({ projectId }),
  });
  assert(denied.res.status === 500, `foreign project ${denied.res.status}`);
  assert(denied.json?.status === 'error', 'deny error envelope');
  assert(mock.invocations === beforeDeny, 'deny before provider');

  // Owner with project context succeeds
  const withProject = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: characterLoreMinimalContext({ projectId }),
  });
  assert(withProject.res.status === 200 && withProject.json?.status === 'ok', 'owner project ok');

  // Rate limit: 6/min — burn remaining quota then expect 429
  // Already used 2 owner successes; burn 4 more then 7th fails.
  for (let i = 0; i < 4; i += 1) {
    const r = await httpJson(baseURL, '/api/v1/ai/character-lore', {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: characterLoreMinimalContext(),
    });
    assert(r.res.status === 200 && r.json?.status === 'ok', `quota burn ${i + 1}`);
  }
  const limited = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: characterLoreMinimalContext(),
  });
  assert(limited.res.status === 429, `rate limit ${limited.res.status}`);
  assert(limited.json?.status === 'error', '429 error envelope');

  // Invalid body
  const bad = await httpJson(baseURL, '/api/v1/ai/character-lore', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'nope' },
  });
  assert(bad.res.status === 400 || bad.res.status === 429, `invalid body ${bad.res.status}`);

  console.log('PASS: cut-13 character-lore host generate-background');
} finally {
  if (host) await host.stop().catch(() => {});
  await mock.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
