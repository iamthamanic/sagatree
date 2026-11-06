#!/usr/bin/env node
/**
 * fe-host-09-host-first.self-test — host-first default + residual DENY + smoke.
 * Location: scripts/fe-host-09-host-first.self-test.mjs
 */
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

// --- Static FE wiring ---
const hostLibSrc = readFileSync(join(root, 'src/infrastructure/host/host-library-http.ts'), 'utf8');
assert(/isHostLibraryExplicitlyDisabled/.test(hostLibSrc), 'explicit opt-out helper');
assert(/getHostAuthBaseUrl\(env\) !== null/.test(hostLibSrc), 'auth URL enables host-first');
assert(/flag === '0'/.test(hostLibSrc), 'LIBRARY=0 opt-out');
assert(
  /if \(isHostLibraryExplicitlyDisabled\(env\)\) return false;\s*return getHostAuthBaseUrl\(env\) !== null;/s.test(
    hostLibSrc,
  ),
  'host-first: auth URL on unless explicitly disabled',
);

const supabaseSrc = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8');
assert(/hostFirst/.test(supabaseSrc), 'supabase host-first branch');
assert(/persistSession: !hostFirst/.test(supabaseSrc), 'GoTrue session off under host-first');
assert(/isHostLibraryExplicitlyDisabled/.test(supabaseSrc), 'supabase respects opt-out');

const authUserSrc = readFileSync(join(root, 'src/lib/authenticatedUser.ts'), 'utf8');
assert(/probeHostActor/.test(authUserSrc), 'authenticatedUser host actor');

const denySrc = readFileSync(join(root, 'src/infrastructure/host/host-product-deny.ts'), 'utf8');
assert(/assertHostProductSurfaceAvailable/.test(denySrc), 'deny helper');
assert(/Host-Modus noch nicht verfügbar/.test(denySrc), 'German DENY copy');

const residualDoc = readFileSync(
  join(root, 'docs/architecture/fe-host-09-residual-supabase.md'),
  'utf8',
);
assert(/Residual allowlist/.test(residualDoc), 'residual allowlist doc');

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
assert(/FE-HOST-09 host-first/.test(envExample), '.env.example host-first');
assert(/VITE_SAGATREE_HOST_LIBRARY=0/.test(envExample), '.env.example opt-out');

// CUT-16: item-thumbnail Soft-DENY removed — host dual-path via isHostLibraryEnabled.
{
  const thumbSrc = readFileSync(
    join(root, 'src/infrastructure/inventory/item-thumbnail-service.ts'),
    'utf8',
  );
  assert(!/Host-Modus noch nicht verfügbar/.test(thumbSrc), 'thumbnail Soft-DENY removed');
  assert(/isHostLibraryEnabled\(\)/.test(thumbSrc), 'thumbnail host-first gate');
  assert(/\/api\/v1\/items\/thumbnail/.test(thumbSrc), 'thumbnail host route');
}

for (const [file, needle] of [
  ['src/infrastructure/inventory/item-model3d-service.ts', 'Host-Modus noch nicht verfügbar'],
  ['src/infrastructure/session/media/media-token-client.ts', 'Host-Modus noch nicht verfügbar'],
  ['src/infrastructure/saga/saga-definition-service.ts', 'assertHostProductSurfaceAvailable'],
  ['src/infrastructure/character/avatar/character-avatar-meshy-service.ts', 'Avatar-3D-Generierung ist im Host-Modus ohne Meshy-Edge nicht verfügbar.'],
  ['src/infrastructure/ai/host-ai-invoke.ts', 'isHostLibraryEnabled'],
  ['src/infrastructure/project/project-service.ts', 'assertHostProductSurfaceAvailable'],
  ['src/infrastructure/project/project-service.ts', 'createHostProjectSession'],
  ['src/lib/authenticatedUser.ts', 'branch on `isHostLibraryEnabled()`'],
]) {
  const src = readFileSync(join(root, file), 'utf8');
  assert(src.includes(needle), `residual gate in ${file}`);
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-09-'));
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
  const cookie = await signIn(baseURL, 'owner@fehost09.test', password);

  const whoami = await httpJson(baseURL, '/api/whoami', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(whoami.res.status === 200 && typeof whoami.json?.actorId === 'string', 'whoami');
  const actorId = whoami.json.actorId;

  // Library write (character create) — no Supabase
  const created = await httpJson(baseURL, '/api/v1/library/characters', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { name: 'Host-First Hero', class: 'Krieger', race: 'Mensch', level: 1 },
  });
  assert(created.res.status === 201, `create char ${created.res.status} ${created.text}`);
  assert(created.json?.character?.name === 'Host-First Hero', 'character payload');

  const listed = await httpJson(baseURL, '/api/v1/library/characters', {
    cookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200 && Array.isArray(listed.json?.characters), 'library list');
  assert(
    listed.json.characters.some((c) => c.name === 'Host-First Hero'),
    'created character listed',
  );

  // Seed world/project for session + atlas smoke
  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  pdb.exec(`
    INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-fehost09', '${actorId.replace(/'/g, "''")}', 'W09', '2026-11-04T00:00:00.000Z');
    INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('proj-fehost09', 'world-fehost09', '${actorId.replace(/'/g, "''")}', 'P09', '2026-11-04T00:00:00.000Z');
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('proj-fehost09', '${actorId.replace(/'/g, "''")}', 'gm', 1, '2026-11-04T00:00:00.000Z');
  `);
  pdb.close();

  const session = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: { projectId: 'proj-fehost09', name: 'FE-HOST-09 Abend' },
  });
  assert(session.res.status === 201, `session ${session.res.status} ${session.text}`);
  assert(typeof session.json?.session?.sessionId === 'string', 'sessionId');

  const atlas = await httpJson(baseURL, '/api/v1/worlds/world-fehost09/atlas/ensure-root', {
    method: 'POST',
    cookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(atlas.res.status === 200 || atlas.res.status === 201, `atlas ${atlas.res.status} ${atlas.text}`);

  await host.stop();
  console.log('OK: fe-host-09-host-first.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
