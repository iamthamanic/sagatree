#!/usr/bin/env node
/**
 * fe-host-07-product-auth.self-test — Better Auth cookie product path + DENY.
 * Location: scripts/fe-host-07-product-auth.self-test.mjs
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

// Static FE wiring checks (no Vite).
const authCtx = readFileSync(join(root, 'src/lib/auth-context.tsx'), 'utf8');
assert(/signInHostEmail/.test(authCtx), 'auth-context uses signInHostEmail');
assert(/isHostLibraryEnabled\(\)/.test(authCtx), 'auth-context gates on host library');
assert(/signOutHost/.test(authCtx), 'auth-context signs out host');
const atlas = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
assert(/!isHostLibraryEnabled\(\) && !hasJwtSession/.test(atlas), 'atlas JWT gate skipped under host flag');
const bridge = readFileSync(join(root, 'src/lib/hostAuthBridge.ts'), 'utf8');
assert(/signInHostEmail/.test(bridge) && /signUpHostEmail/.test(bridge), 'hostAuthBridge product auth');
assert(/ensureHostSoloAccountLinked/.test(bridge), 'hostAuthBridge links solo after sign-in');
assert(/same-origin/.test(bridge), 'hostAuthBridge documents same-origin auth base');
assert(/response\.ok/.test(bridge) && /Host-Abmeldung/.test(bridge), 'signOutHost checks response.ok');
assert(/AbortController|abort\(/.test(bridge), 'probeHostActor is bounded by abort timeout');
const cookieProfile = readFileSync(join(root, 'server/src/auth/cookie-profile.ts'), 'utf8');
assert(
  /minPasswordLength:/.test(cookieProfile) &&
    /SAGATREE_ALLOW_DEMO_PASSWORDS/.test(cookieProfile) &&
    /:\s*4/.test(cookieProfile),
  'host minPasswordLength gates DEV demo 1234 (prod floor 8)',
);
const viteCfg = readFileSync(join(root, 'vite.config.ts'), 'utf8');
assert(/proxy[\s\S]*['"]\/api['"]/.test(viteCfg), 'vite proxies /api to host for first-party cookies');
const dash = readFileSync(join(root, 'src/app/dashboard/Dashboard.tsx'), 'utf8');
assert(/Session hosten/.test(dash), 'Dashboard CTA Session hosten');
const libRoutes = readFileSync(join(root, 'server/src/api/library-routes.ts'), 'utf8');
assert(/libraryActorIds/.test(libRoutes), 'library routes honor linked solo ids');

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-07-'));
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

  const password = `Pw-${randomBytes(12).toString('base64url')}`;
  const email = 'owner@fehost07.test';

  // Fall 2 — unauthenticated whoami / library DENY
  const unauthWho = await httpJson(baseURL, '/api/whoami', { headers: { Origin: baseURL } });
  assert(unauthWho.res.status === 401, `unauth whoami ${unauthWho.res.status}`);
  const unauthLib = await httpJson(baseURL, '/api/v1/library/characters', {
    headers: { Origin: baseURL },
  });
  assert(unauthLib.res.status === 401, `unauth library ${unauthLib.res.status}`);

  // Fall 1 — sign-up + whoami + library list (no GoTrue)
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name: email },
  });
  assert(signUp.res.status < 400, `sign-up ${signUp.res.status} ${signUp.text}`);
  let cookie = signUp.cookie;
  if (!cookie) {
    const signIn = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email, password },
    });
    assert(signIn.res.status < 400, `sign-in ${signIn.res.status}`);
    cookie = signIn.cookie;
  }
  assert(cookie && cookie.includes('='), 'session cookie');

  const whoami = await httpJson(baseURL, '/api/whoami', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(whoami.res.status === 200, `whoami ${whoami.res.status}`);
  assert(whoami.json?.ok === true && typeof whoami.json?.actorId === 'string', 'whoami actor');

  const listed = await httpJson(baseURL, '/api/v1/library/characters', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, `library ${listed.res.status}`);
  assert(Array.isArray(listed.json?.characters), 'characters array');

  // FE-HOST-10 — solo identity probe + ensure-starter seeds owned Dornhain
  const soloId = await httpJson(baseURL, '/api/solo/identity', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(soloId.res.status === 200, `solo identity ${soloId.res.status}`);
  assert(typeof soloId.json?.soloActorId === 'string', 'soloActorId');
  assert(soloId.json?.soloActorId.startsWith('solo-'), 'solo id prefix');

  const starter = await httpJson(baseURL, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { slug: 'dornhain.whisper' },
  });
  assert(starter.res.status === 200, `ensure-starter ${starter.res.status} ${starter.text}`);
  assert(typeof starter.json?.id === 'string', 'starter project id');

  const afterSeed = await httpJson(baseURL, '/api/v1/library/characters', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(afterSeed.res.status === 200, `library after seed ${afterSeed.res.status}`);
  assert(
    (afterSeed.json?.characters?.length ?? 0) >= 4,
    `dornhain pregens for remote actor (got ${afterSeed.json?.characters?.length ?? 0})`,
  );

  const worlds = await httpJson(baseURL, '/api/v1/library/worlds', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(
    (worlds.json?.worlds ?? []).some((w) => w.title === 'Dornhain'),
    'Dornhain world listed',
  );

  // Second remote user also gets an owned Dornhain copy (no solo-link required).
  const email2 = 'player@fehost07.test';
  const password2 = '1234';
  const signUp2 = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email: email2, password: password2, name: 'player1' },
  });
  assert(signUp2.res.status < 400, `player sign-up ${signUp2.res.status} ${signUp2.text}`);
  let cookie2 = signUp2.cookie;
  if (!cookie2) {
    const signIn2 = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email: email2, password: password2 },
    });
    assert(signIn2.res.status < 400, `player sign-in ${signIn2.res.status}`);
    cookie2 = signIn2.cookie;
  }
  const starter2 = await httpJson(baseURL, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    cookie: cookie2,
    headers: { Origin: baseURL },
    body: { slug: 'dornhain.whisper' },
  });
  assert(starter2.res.status === 200, `player ensure-starter ${starter2.res.status}`);
  const chars2 = await httpJson(baseURL, '/api/v1/library/characters', {
    cookie: cookie2,
    headers: { Origin: baseURL },
  });
  assert(
    (chars2.json?.characters?.length ?? 0) >= 4,
    'player Dornhain pregens without stealing owner1 rows',
  );

  // Sign-out clears session
  await httpJson(baseURL, '/api/auth/sign-out', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
  });
  const afterOut = await httpJson(baseURL, '/api/whoami', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(afterOut.res.status === 401, `post sign-out whoami ${afterOut.res.status}`);

  await host.stop();
  console.log('OK: fe-host-07-product-auth.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
