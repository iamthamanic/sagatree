#!/usr/bin/env node
/**
 * fe-host-14-ai-residuals.self-test — recap save + peer profiles + residual soft DENY.
 * Location: scripts/fe-host-14-ai-residuals.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

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

const residual = readFileSync(
  join(root, 'docs/architecture/fe-host-09-residual-supabase.md'),
  'utf8',
);
assert(/DONE \(FE-HOST-14\)/.test(residual), 'FE-HOST-14 DONE markers');
assert(/Info \| Soft/.test(residual) || /\| Info \|/.test(residual), 'optional AI Info rows');

assert(
  /saveHostSessionRecapSummary/.test(
    readFileSync(join(root, 'src/infrastructure/session/session-recap-ai-service.ts'), 'utf8'),
  ),
  'recap save host HTTP',
);
assert(
  /fetchHostProfilesByUserIds/.test(
    readFileSync(join(root, 'src/infrastructure/user-profile/user-profile-service.ts'), 'utf8'),
  ),
  'peer profiles host HTTP',
);
assert(
  /isHostLibraryEnabled\(env\)/.test(
    readFileSync(join(root, 'src/infrastructure/ai/host-ai-invoke.ts'), 'utf8'),
  ),
  'host-ai under host-first',
);

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-14-'));
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

  const pw = `Pw-${randomBytes(12).toString('base64url')}`;
  const cookieA = await signIn(baseURL, 'a@fehost14.test', pw);
  const cookieB = await signIn(baseURL, 'b@fehost14.test', pw);

  const meA = await httpJson(baseURL, '/api/v1/user-profile/me', {
    cookie: cookieA,
    headers: { Origin: baseURL },
  });
  assert(meA.res.status === 200, `meA ${meA.res.status}`);
  const idA = meA.json?.profile?.id;
  assert(typeof idA === 'string', 'profile A id');

  const meB = await httpJson(baseURL, '/api/v1/user-profile/me', {
    cookie: cookieB,
    headers: { Origin: baseURL },
  });
  assert(meB.res.status === 200, `meB ${meB.res.status}`);
  const idB = meB.json?.profile?.id;
  assert(typeof idB === 'string', 'profile B id');

  const batch = await httpJson(baseURL, '/api/v1/user-profile/batch', {
    method: 'POST',
    cookie: cookieA,
    headers: { Origin: baseURL },
    body: { userIds: [idA, idB, 'missing-user'] },
  });
  assert(batch.res.status === 200, `batch ${batch.res.status} ${batch.text}`);
  assert(Array.isArray(batch.json?.profiles), 'profiles array');
  assert(batch.json.profiles.some((p) => p.id === idB), 'includes peer B');
  const peerB = batch.json.profiles.find((p) => p.id === idB);
  assert(peerB && peerB.avatarUrl == null, 'peer avatarUrl null (no /me/avatar leak)');

  const unauthBatch = await httpJson(baseURL, '/api/v1/user-profile/batch', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { userIds: [idA] },
  });
  assert(
    unauthBatch.res.status === 401 || unauthBatch.res.status === 403,
    `unauth batch DENY ${unauthBatch.res.status}`,
  );

  // Minimal project + session for recap save
  const created = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: cookieA,
    headers: { Origin: baseURL },
    body: { name: 'Recap Host' },
  });
  assert(created.res.status === 201, `project ${created.res.status}`);
  const projectId = created.json.project.id;
  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const sessionId = `sess-${randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const pdb = new DatabaseSync(hostDbPath);
  pdb
    .prepare(
      `INSERT INTO play_sessions (
         session_id, project_id, public_id, join_code, status, created_at,
         session_number, name, notes, world_state, runtime_revision, updated_at
       ) VALUES (?, ?, ?, ?, 'scheduled', ?, 1, 'S1', NULL, '{}', 0, ?)`,
    )
    .run(sessionId, projectId, `SE-${randomBytes(3).toString('hex').toUpperCase()}`, 'JOIN14AB', now, now);
  pdb.close();

  const saved = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap`, {
    method: 'PUT',
    cookie: cookieA,
    headers: { Origin: baseURL },
    body: { summaryText: 'Die Gruppe fand den Schlüssel.', status: 'draft' },
  });
  assert(saved.res.status === 200, `recap save ${saved.res.status} ${saved.text}`);

  const strangerSave = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/recap`, {
    method: 'PUT',
    cookie: cookieB,
    headers: { Origin: baseURL },
    body: { summaryText: 'Stolen', status: 'draft' },
  });
  assert(
    strangerSave.res.status === 403 || strangerSave.res.status === 404,
    `stranger recap DENY ${strangerSave.res.status}`,
  );

  console.log('PASS: fe-host-14-ai-residuals.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
