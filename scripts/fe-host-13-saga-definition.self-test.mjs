#!/usr/bin/env node
/**
 * fe-host-13-saga-definition.self-test — saga-definition HTTP DENY/happy path.
 * Location: scripts/fe-host-13-saga-definition.self-test.mjs
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
assert(/Saga definition RPC editor/.test(residualDoc), 'residual row present');
assert(/DONE \(FE-HOST-13\)/.test(residualDoc), 'residual row marked DONE');

const svc = readFileSync(
  join(root, 'src/infrastructure/saga/saga-definition-service.ts'),
  'utf8',
);
assert(/isHostLibraryEnabled/.test(svc), 'FE dual-path isHostLibraryEnabled');
assert(/getHostSagaDefinitionEditor/.test(svc), 'FE dual-path getHostSagaDefinitionEditor');
assert(/saveHostSagaDefinitionDraft/.test(svc), 'FE dual-path saveHostSagaDefinitionDraft');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(/mountSagaDefinitionHttpRoutes/.test(createApp), 'HTTP mount wired');

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-13-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19700 + Math.floor(Math.random() * 1000);
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

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@fehost13.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost13.test', strangerPassword);

  const unauth = await httpJson(baseURL, '/api/v1/saga-definitions', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { title: 'NoAuth' },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth DENY ${unauth.res.status}`);

  const created = await httpJson(baseURL, '/api/v1/saga-definitions', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { title: 'Whisper Road', blurb: 'Pitch' },
  });
  assert(created.res.status === 201, `create ${created.res.status} ${created.text}`);
  assert(typeof created.json?.saga?.sagaId === 'string', 'sagaId');
  const sagaId = created.json.saga.sagaId;
  const revision0 =
    typeof created.json.saga.revision === 'number' ? created.json.saga.revision : 0;

  const editor = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/editor`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(editor.res.status === 200, `editor ${editor.res.status} ${editor.text}`);
  assert(editor.json?.editor?.canEdit === true, 'canEdit');
  assert(editor.json?.editor?.sagaId === sagaId, 'editor sagaId');

  const strangerEditor = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/editor`, {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  // Stranger may read with canEdit false, or get 403 — both are owner-scoped DENY for mutate.
  if (strangerEditor.res.status === 200) {
    assert(strangerEditor.json?.editor?.canEdit !== true, 'stranger cannot edit');
  } else {
    assert(
      strangerEditor.res.status === 403 || strangerEditor.res.status === 404,
      `stranger editor DENY ${strangerEditor.res.status}`,
    );
  }

  const draftPayload = {
    title: 'Whisper Road',
    blurb: 'Updated',
    synopsis: 'A road through Dornhain',
    knowledgeFacts: [],
    locations: [],
    pregens: [],
    packageId: null,
    initialAdventure: { scene: 'gate' },
  };
  const saved = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/draft`, {
    method: 'PUT',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { payload: draftPayload, expectedRevision: revision0 },
  });
  assert(saved.res.status === 200, `save ${saved.res.status} ${saved.text}`);
  assert(typeof saved.json?.draft?.revision === 'number', 'revision');
  assert(saved.json.draft.revision > revision0, 'revision bumped');
  const revision1 = saved.json.draft.revision;

  const stale = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/draft`, {
    method: 'PUT',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { payload: { ...draftPayload, blurb: 'stale' }, expectedRevision: revision0 },
  });
  assert(stale.res.status === 409, `stale revision ${stale.res.status}`);

  const strangerSave = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/draft`, {
    method: 'PUT',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { payload: draftPayload, expectedRevision: revision1 },
  });
  assert(
    strangerSave.res.status === 403 || strangerSave.res.status === 404,
    `stranger save DENY ${strangerSave.res.status}`,
  );

  const published = await httpJson(baseURL, `/api/v1/saga-definitions/${sagaId}/publish`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { expectedRevision: revision1 },
  });
  assert(published.res.status === 200, `publish ${published.res.status} ${published.text}`);
  assert(typeof published.json?.publish?.versionId === 'string', 'versionId');
  assert(typeof published.json?.publish?.versionLabel === 'string', 'versionLabel');

  const version = await httpJson(
    baseURL,
    `/api/v1/saga-definitions/versions/${published.json.publish.versionId}`,
    {
      cookie: ownerCookie,
      headers: { Origin: baseURL },
    },
  );
  assert(version.res.status === 200, `version ${version.res.status}`);
  assert(version.json?.version, 'version body');

  console.log('PASS: fe-host-13-saga-definition.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
