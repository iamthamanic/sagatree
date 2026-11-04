#!/usr/bin/env node
/**
 * fe-host-12-project-writes.self-test — project CRUD + session look DENY/happy path.
 * Location: scripts/fe-host-12-project-writes.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
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

const residualDoc = readFileSync(
  join(root, 'docs/architecture/fe-host-09-residual-supabase.md'),
  'utf8',
);
assert(/Project create\/update\/delete/.test(residualDoc), 'residual row present');
assert(/DONE \(FE-HOST-12\)/.test(residualDoc), 'residual row marked DONE');

const projectSvc = readFileSync(
  join(root, 'src/infrastructure/project/project-service.ts'),
  'utf8',
);
assert(/createHostProject/.test(projectSvc), 'FE dual-path createHostProject');
assert(/updateHostProject/.test(projectSvc), 'FE dual-path updateHostProject');
assert(/deleteHostProject/.test(projectSvc), 'FE dual-path deleteHostProject');
assert(/updateHostSessionLook/.test(projectSvc), 'FE dual-path updateHostSessionLook');

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-12-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19600 + Math.floor(Math.random() * 1000);
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

  const gmPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const gmCookie = await signIn(baseURL, 'gm@fehost12.test', gmPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost12.test', strangerPassword);

  const unauth = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { name: 'NoAuth' },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth DENY ${unauth.res.status}`);

  const created = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'Silberkrone', description: 'Pitch' },
  });
  assert(created.res.status === 201, `create ${created.res.status} ${created.text}`);
  assert(typeof created.json?.project?.id === 'string', 'project id');
  assert(/^SA-/i.test(created.json.project.publicId || ''), 'publicId SA-');
  assert(typeof created.json.project.code === 'string' && created.json.project.code.length >= 4, 'code');
  assert(typeof created.json.project.worldId === 'string', 'world auto-allocated');
  const projectId = created.json.project.id;

  const patched = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'Goldkrone', description: 'Updated' },
  });
  assert(patched.res.status === 200, `patch ${patched.res.status} ${patched.text}`);
  assert(patched.json?.project?.name === 'Goldkrone', 'patched name');

  const strangerPatch = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { name: 'Stolen' },
  });
  assert(
    strangerPatch.res.status === 403 || strangerPatch.res.status === 404,
    `stranger patch DENY ${strangerPatch.res.status}`,
  );

  const lookCreate = await httpJson(baseURL, '/api/v1/library/looks', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {
      displayName: 'Test Look',
      source: 'manual',
      capabilities: [],
      executionModes: ['realtime'],
      references: [],
    },
  });
  assert(lookCreate.res.status === 201, `look create ${lookCreate.res.status} ${lookCreate.text}`);
  const lookId =
    lookCreate.json?.look?.profile?.id ||
    lookCreate.json?.look?.id ||
    lookCreate.json?.look?.profileId;
  assert(typeof lookId === 'string' && lookId.length >= 8, `look id ${JSON.stringify(lookCreate.json)}`);

  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  const now = new Date().toISOString();
  const sessionId = `sess-${randomBytes(4).toString('hex')}`;
  pdb
    .prepare(
      `INSERT INTO play_sessions (
         session_id, project_id, public_id, join_code, status, created_at,
         session_number, name, notes, world_state, runtime_revision, updated_at
       ) VALUES (?, ?, ?, ?, 'scheduled', ?, 1, 'S1', NULL, '{}', 0, ?)`,
    )
    .run(sessionId, projectId, `SE-${randomBytes(3).toString('hex').toUpperCase()}`, 'JOIN12AB', now, now);
  pdb.close();

  const lookPatch = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { defaultLookProfileId: lookId, allowPlayerCharacterLookOverride: false },
  });
  assert(lookPatch.res.status === 200, `look patch ${lookPatch.res.status} ${lookPatch.text}`);
  assert(lookPatch.json?.project?.defaultLookProfileId === lookId, 'default look set');
  assert(lookPatch.json?.project?.allowPlayerCharacterLookOverride === false, 'allow override');

  const foreignLook = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { defaultLookProfileId: 'look-not-owned' },
  });
  assert(
    foreignLook.res.status === 403 || foreignLook.res.status === 404,
    `foreign look DENY ${foreignLook.res.status}`,
  );

  const sessionLook = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/look`, {
    method: 'PATCH',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { lookProfileId: lookId },
  });
  assert(sessionLook.res.status === 200, `session look ${sessionLook.res.status} ${sessionLook.text}`);
  assert(sessionLook.json?.session?.lookProfileId === lookId, 'session look set');

  const strangerLook = await httpJson(baseURL, `/api/v1/sessions/${sessionId}/look`, {
    method: 'PATCH',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { lookProfileId: lookId },
  });
  assert(
    strangerLook.res.status === 403 || strangerLook.res.status === 404,
    `stranger session look DENY ${strangerLook.res.status}`,
  );

  const listed = await httpJson(baseURL, '/api/v1/library/projects', {
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, `list ${listed.res.status}`);
  assert(
    (listed.json?.projects || []).some((p) => p.id === projectId),
    'project in library list',
  );

  const deleted = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(deleted.res.status === 200, `delete ${deleted.res.status} ${deleted.text}`);

  const listedAfter = await httpJson(baseURL, '/api/v1/library/projects', {
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(
    !(listedAfter.json?.projects || []).some((p) => p.id === projectId),
    'archived project omitted from list',
  );

  const strangerDelete = await httpJson(baseURL, `/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    strangerDelete.res.status === 403 || strangerDelete.res.status === 404,
    `stranger delete DENY ${strangerDelete.res.status}`,
  );

  console.log('PASS: fe-host-12-project-writes.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
