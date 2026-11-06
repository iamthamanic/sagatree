#!/usr/bin/env node
/**
 * cut-15-look-reference.self-test — Host look reference analysis (#1150).
 * Location: scripts/cut-15-look-reference.self-test.mjs
 *
 * Injected deterministic OpenAI-compatible vision adapter (local mock server).
 * Covers: configured OK, not-configured, 401, invalid MIME, rate limit, secret strip.
 */
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const lookModUrl = pathToFileURL(join(root, 'server/src/modules/look/index.ts')).href;

const DRAFT_PAYLOAD = {
  displayName: 'CUT-15 Look',
  palette: {
    primary: '#8899AA',
    secondary: '#556677',
    accent: '#CCDDEE',
    background: '#112233',
  },
  knobs: {
    characterStylization: 55,
    characterOutline: 40,
    lightingWarmth: 60,
    lightingKey: 50,
    postFxContrast: 45,
    postFxSaturation: 50,
  },
  contentNotes: 'mock motif',
  apiKey: 'SHOULD-BE-STRIPPED',
};

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

/** Minimal PNG that passes look-ref sniff (8-byte signature). */
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const pngB64 = Buffer.from(pngBytes).toString('base64');

function analyzeBody(extra = {}) {
  return {
    action: 'analyze',
    displayNameHint: 'Hint Look',
    references: [
      {
        id: 'ref-1',
        kind: 'style',
        mime: 'image/png',
        uri: `data:image/png;base64,${pngB64}`,
        contentBase64: pngB64,
        ...extra,
      },
    ],
  };
}

function startMockVision() {
  let invocations = 0;
  const server = createServer((req, res) => {
    if (
      req.method === 'POST' &&
      (req.url === '/v1/chat/completions' || req.url === '/chat/completions')
    ) {
      invocations += 1;
      const payload = JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(DRAFT_PAYLOAD),
            },
          },
        ],
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED } = await import(lookModUrl);

assert(LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED === true, 'activation flag true');

const aiRoutes = readFileSync(join(root, 'server/src/api/ai-routes.ts'), 'utf8');
assert(
  aiRoutes.includes('/api/v1/ai/look-reference-analysis'),
  'ai-routes mounts look-reference-analysis',
);

const mock = await startMockVision();
const work = mkdtempSync(join(tmpdir(), 'cut-15-look-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20100 + Math.floor(Math.random() * 1000);
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
      LOOK_AI_MODEL: '',
      CHARACTER_AI_MODEL: '',
      CHARACTER_AI_BASE_URL: '',
      CHARACTER_AI_API_KEY: '',
    });
    assert(!('error' in bare), `bare host: ${JSON.stringify(bare)}`);
    await bare.start();
    const bareCookie = await signIn(
      bareURL,
      'bare@cut15.test',
      `Pw-${randomBytes(8).toString('base64url')}`,
    );
    const missing = await httpJson(bareURL, '/api/v1/ai/look-reference-analysis', {
      method: 'POST',
      cookie: bareCookie,
      headers: { Origin: bareURL },
      body: analyzeBody(),
    });
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
    LOOK_AI_BASE_URL: mock.baseUrl,
    LOOK_AI_API_KEY: 'test-key-not-secret-for-fixture',
    LOOK_AI_MODEL: 'cut15-mock',
    // High ceiling for functional cases; dedicated rate host below uses 4/min.
    LOOK_AI_RATE_LIMIT_PER_MINUTE: '30',
  });
  assert(!('error' in host), `host create: ${JSON.stringify(host)}`);
  await host.start();

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut15.test', ownerPassword);

  // 401 without cookie
  const unauth = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: analyzeBody(),
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth ${unauth.res.status}`);
  assert(unauth.json?.status === 'error', 'unauth error envelope');

  // Positive analyze
  const beforeInv = mock.invocations;
  const ok = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: analyzeBody(),
  });
  assert(ok.res.status === 200, `ok status ${ok.res.status} ${ok.text}`);
  assert(ok.json?.status === 'ok', 'ok envelope');
  assert(isRecord(ok.json?.payload), 'payload present');
  assert(ok.json.payload.displayName === 'CUT-15 Look', 'displayName from mock');
  assert(ok.json.payload.apiKey === undefined, 'top-level secret stripped');
  assert(typeof ok.json?.analyzedAtIso === 'string', 'analyzedAtIso');
  assert(mock.invocations === beforeInv + 1, 'provider invoked once');

  // Owner-scoped storagePath under dataDir/media loads (Codex P2) — before rate burn.
  const meRes = await httpJson(baseURL, '/api/auth/get-session', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  const ownerId =
    meRes.json?.user?.id || meRes.json?.session?.userId || meRes.json?.user?.userId;
  assert(typeof ownerId === 'string' && ownerId.length > 0, `owner id ${JSON.stringify(meRes.json)}`);
  const mediaDir = join(dataDir, 'media', ownerId);
  mkdirSync(mediaDir, { recursive: true });
  writeFileSync(join(mediaDir, 'ref.png'), pngBytes);
  const beforeStorage = mock.invocations;
  const fromStorage = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'analyze',
      references: [
        {
          id: 'stored',
          kind: 'style',
          mime: 'image/png',
          uri: 'storage://ref.png',
          storagePath: `${ownerId}/ref.png`,
        },
      ],
    },
  });
  assert(
    fromStorage.res.status === 200 && fromStorage.json?.status === 'ok',
    `storagePath ok ${fromStorage.res.status} ${fromStorage.text}`,
  );
  assert(mock.invocations === beforeStorage + 1, 'storagePath invoked provider');

  // Invalid MIME rejected (rate slot consumed before validation — expected legacy order)
  const badMime = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'analyze',
      references: [
        {
          id: 'bad',
          kind: 'style',
          mime: 'image/gif',
          uri: 'x',
          contentBase64: pngB64,
        },
      ],
    },
  });
  assert(badMime.res.status === 400, `bad mime ${badMime.res.status}`);
  assert(badMime.json?.status === 'error', 'bad mime error');

  // Zero references rejected
  const zero = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { action: 'analyze', references: [] },
  });
  assert(zero.res.status === 400, `zero refs ${zero.res.status}`);

  // Foreign storage path denied
  const beforeForeign = mock.invocations;
  const foreign = await httpJson(baseURL, '/api/v1/ai/look-reference-analysis', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      action: 'analyze',
      references: [
        {
          id: 'foreign',
          kind: 'style',
          mime: 'image/png',
          uri: 'storage://x',
          storagePath: 'other-user/secret.png',
        },
      ],
    },
  });
  assert(foreign.res.status === 400, `foreign path ${foreign.res.status}`);
  assert(mock.invocations === beforeForeign, 'foreign denied before provider');

  // Dedicated rate-limit host: 4/min — burn 4 then 5th fails.
  {
    const rateDir = join(work, 'rate');
    mkdirSync(rateDir);
    const ratePort = port + 2;
    const rateURL = `http://127.0.0.1:${ratePort}`;
    const rateHost = createHost({
      SAGATREE_DATA_DIR: rateDir,
      SAGATREE_PORT: String(ratePort),
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_ENABLE_HOST_AUTH: '1',
      SAGATREE_BETTER_AUTH_SECRET: authSecret,
      SAGATREE_AUTH_BASE_URL: rateURL,
      SAGATREE_AUTH_TRUSTED_ORIGINS: rateURL,
      LOOK_AI_BASE_URL: mock.baseUrl,
      LOOK_AI_API_KEY: 'test-key-not-secret-for-fixture',
      LOOK_AI_MODEL: 'cut15-mock',
      LOOK_AI_RATE_LIMIT_PER_MINUTE: '4',
    });
    assert(!('error' in rateHost), `rate host: ${JSON.stringify(rateHost)}`);
    await rateHost.start();
    try {
      const quotaCookie = await signIn(
        rateURL,
        'quota@cut15.test',
        `Pw-${randomBytes(12).toString('base64url')}`,
      );
      for (let i = 0; i < 4; i += 1) {
        const r = await httpJson(rateURL, '/api/v1/ai/look-reference-analysis', {
          method: 'POST',
          cookie: quotaCookie,
          headers: { Origin: rateURL },
          body: analyzeBody(),
        });
        assert(r.res.status === 200 && r.json?.status === 'ok', `quota burn ${i + 1}`);
      }
      const limited = await httpJson(rateURL, '/api/v1/ai/look-reference-analysis', {
        method: 'POST',
        cookie: quotaCookie,
        headers: { Origin: rateURL },
        body: analyzeBody(),
      });
      assert(limited.res.status === 429, `rate limit ${limited.res.status}`);
      assert(limited.json?.status === 'error', '429 error envelope');
    } finally {
      await rateHost.stop().catch(() => {});
    }
  }

  console.log('PASS: cut-15 look-reference-analysis host activate');
} finally {
  if (host) await host.stop().catch(() => {});
  await mock.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}
