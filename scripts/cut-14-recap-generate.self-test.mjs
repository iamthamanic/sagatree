#!/usr/bin/env node
/**
 * cut-14-recap-generate.self-test — Host session-recap AI generate (#1149).
 * Location: scripts/cut-14-recap-generate.self-test.mjs
 *
 * Injected deterministic OpenAI-compatible inference adapter (local mock server).
 * Covers: configured OK draft, not-configured, 401, non-GM 403, approved-lock 409, rate 429.
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
const recapModUrl = pathToFileURL(
  join(root, 'server/src/modules/session/session-recap-generate.ts'),
).href;

const SUMMARY =
  'Bei Morgengrauen betraten die Helden den Pass und ließen die Grenzlande hinter sich.';

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

function startMockLlm() {
  let invocations = 0;
  const server = createServer((req, res) => {
    if (
      req.method === 'POST' &&
      (req.url === '/v1/chat/completions' || req.url === '/chat/completions')
    ) {
      invocations += 1;
      const payload = JSON.stringify({
        choices: [{ message: { role: 'assistant', content: SUMMARY } }],
      });
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      });
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

async function createCompletedSession(baseURL, cookie) {
  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-14 Saga', description: 'Recap project' },
  });
  assert(
    createdProject.res.status === 201,
    `project ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  assert(typeof projectId === 'string', 'project id');

  const createdSession = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'Episode 1' },
  });
  assert(
    createdSession.res.status === 201 || createdSession.res.status === 200,
    `session ${createdSession.res.status} ${createdSession.text}`,
  );
  const sessionId =
    createdSession.json?.session?.sessionId ?? createdSession.json?.sessionId;
  assert(typeof sessionId === 'string', 'session id');

  const toActive = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/status`, {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { status: 'active' },
  });
  assert(toActive.res.status === 200, `active ${toActive.res.status} ${toActive.text}`);

  const toDone = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/status`, {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { status: 'completed' },
  });
  assert(toDone.res.status === 200, `completed ${toDone.res.status} ${toDone.text}`);

  return { projectId, sessionId };
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED } = await import(recapModUrl);

assert(SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation flag true');

const mock = await startMockLlm();
const work = mkdtempSync(join(tmpdir(), 'cut-14-recap-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
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
      CHARACTER_AI_PROVIDER: 'ollama',
      CHARACTER_AI_MODEL: '',
      OLLAMA_MODEL: '',
      SESSION_RECAP_AI_MODEL: '',
    });
    assert(!('error' in bare), `bare host: ${JSON.stringify(bare)}`);
    await bare.start();
    const bareCookie = await signIn(
      bareURL,
      'bare@cut14.test',
      `Pw-${randomBytes(8).toString('base64url')}`,
    );
    const { sessionId } = await createCompletedSession(bareURL, bareCookie);
    const missing = await httpJson(
      bareURL,
      `/api/v1/sessions/${sessionId}/recap/generate`,
      {
        method: 'POST',
        cookie: bareCookie,
        headers: { Origin: bareURL },
        body: { sessionId },
      },
    );
    assert(missing.res.status === 200, `not-configured status ${missing.res.status}`);
    assert(missing.json?.status === 'not-configured', 'not-configured envelope');
    assert(
      typeof missing.json?.message === 'string' && missing.json.message.length > 0,
      'degraded message',
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
    CHARACTER_AI_PROVIDER: 'openai-compatible',
    CHARACTER_AI_BASE_URL: mock.baseUrl,
    CHARACTER_AI_API_KEY: 'test-key-not-secret-for-fixture',
    CHARACTER_AI_MODEL: 'cut14-mock',
  });
  assert(!('error' in host), `host create: ${JSON.stringify(host)}`);
  await host.start();

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut14.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut14.test', strangerPassword);

  const { sessionId } = await createCompletedSession(baseURL, ownerCookie);

  // 401 without cookie
  const unauth = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap/generate`, {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { sessionId },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);
  assert(unauth.json?.status === 'error', 'unauth error envelope');

  // Positive generate
  const beforeInv = mock.invocations;
  const ok = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap/generate`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { sessionId },
  });
  assert(ok.res.status === 200, `ok status ${ok.res.status} ${ok.text}`);
  assert(ok.json?.status === 'ok', 'ok envelope');
  assert(ok.json?.summaryText === SUMMARY, 'summary from mock provider');
  assert(ok.json?.summaryStatus === 'draft', 'draft status');
  assert(ok.json?.provider === 'openai-compatible', 'provider');
  assert(ok.json?.model === 'cut14-mock', 'model');
  assert(mock.invocations === beforeInv + 1, 'provider invoked once');

  // Persist: GET recap shows draft
  const got = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(got.res.status === 200, `get recap ${got.res.status}`);
  assert(got.json?.recap?.summaryText === SUMMARY, 'persisted summary');
  assert(got.json?.recap?.summaryStatus === 'draft', 'persisted draft');

  // Non-GM stranger denied
  const beforeDeny = mock.invocations;
  const denied = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap/generate`, {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { sessionId },
  });
  assert(denied.res.status === 403 || denied.res.status === 404, `stranger ${denied.res.status}`);
  assert(denied.json?.status === 'error', 'deny error envelope');
  assert(mock.invocations === beforeDeny, 'deny before provider');

  // Approve then generate → 409
  const approved = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap`, {
    method: 'PUT',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { summaryText: SUMMARY, status: 'approved' },
  });
  assert(approved.res.status === 200, `approve ${approved.res.status}`);
  const locked = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap/generate`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { sessionId },
  });
  assert(locked.res.status === 409, `approved lock ${locked.res.status} ${locked.text}`);
  assert(locked.json?.status === 'error', '409 error envelope');

  // Fresh session for rate-limit burn (approved lock consumed a quota charge)
  const fresh = await createCompletedSession(baseURL, ownerCookie);
  for (let i = 0; i < 6; i += 1) {
    const r = await httpJson(
      baseURL,
      `/api/v1/sessions/${fresh.sessionId}/recap/generate`,
      {
        method: 'POST',
        cookie: ownerCookie,
        headers: { Origin: baseURL },
        body: { sessionId: fresh.sessionId },
      },
    );
    // First may succeed; after quota → 429. Also 409 never applies (none status).
    assert(
      (r.res.status === 200 && r.json?.status === 'ok') || r.res.status === 429,
      `quota burn ${i + 1}: ${r.res.status}`,
    );
    if (r.res.status === 429) break;
  }
  const limited = await httpJson(
    baseURL,
    `/api/v1/sessions/${fresh.sessionId}/recap/generate`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { sessionId: fresh.sessionId },
    },
  );
  assert(limited.res.status === 429, `rate limit ${limited.res.status}`);
  assert(limited.json?.status === 'error', '429 error envelope');

  console.log('PASS: cut-14 session-recap host generate');
} finally {
  if (host) await host.stop().catch(() => {});
  await mock.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
