#!/usr/bin/env node
/**
 * cut-09-character-arcs.self-test — Host adventure arc sync + developments.
 * Location: scripts/cut-09-character-arcs.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-09-arcs-'));
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
  const ownerCookie = await signIn(baseURL, 'owner@cut09.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut09.test', strangerPassword);

  const ownerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: ownerCookie,
  });
  assert(ownerWho.res.status === 200, `owner whoami ${ownerWho.res.status}`);
  const ownerActorId = ownerWho.json.actorId;
  assert(typeof ownerActorId === 'string' && ownerActorId.length > 0, 'owner actorId');

  // Membership bind requires assertOwnedCompletePc — seed a complete PC via host ports.
  assert(typeof host.character?.seedPcForTests === 'function', 'character seed port');
  const seeded = host.character.seedPcForTests({
    ownerUserId: ownerActorId,
    name: 'CUT-09 Held',
    sheetStatus: 'complete',
  });
  const characterId = seeded.id;
  assert(typeof characterId === 'string', 'character id');

  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-09 Kampagne', description: 'Arc project' },
  });
  assert(
    createdProject.res.status === 201,
    `project ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  assert(typeof projectId === 'string', 'project id');

  const setChar = await httpJson(baseURL, `/api/v1/projects/${projectId}/my-character`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { characterId },
  });
  assert(
    setChar.res.status === 200,
    `set my-character ${setChar.res.status} ${setChar.text}`,
  );

  const listed1 = await httpJson(
    baseURL,
    `/api/v1/library/characters/${characterId}/adventure-arcs`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(listed1.res.status === 200, `list arcs ${listed1.res.status} ${listed1.text}`);
  assert(Array.isArray(listed1.json.arcs), 'arcs array');
  assert(listed1.json.arcs.length >= 1, 'at least one arc after sync');
  const arcId = listed1.json.arcs[0].id;
  assert(listed1.json.arcs[0].project_id === projectId, 'project linked');
  assert(typeof listed1.json.arcs[0].project_name === 'string', 'project_name');
  assert(typeof listed1.json.arcs[0].session_count === 'number', 'session_count');

  const listed2 = await httpJson(
    baseURL,
    `/api/v1/library/characters/${characterId}/adventure-arcs`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(listed2.json.arcs.length === listed1.json.arcs.length, 'no duplicate arcs');

  const appended = await httpJson(
    baseURL,
    `/api/v1/library/adventure-arcs/${arcId}/developments`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { kind: 'level', title: 'Level 2 erreicht', detail: 'Test' },
    },
  );
  assert(appended.res.status === 201, `append ${appended.res.status} ${appended.text}`);
  assert(appended.json.arc.developments.length === 1, 'one development');
  assert(appended.json.arc.developments[0].kind === 'level', 'kind');

  const strangerList = await httpJson(
    baseURL,
    `/api/v1/library/characters/${characterId}/adventure-arcs`,
    { cookie: strangerCookie, headers: { Origin: baseURL } },
  );
  assert(
    strangerList.res.status === 404 || strangerList.res.status === 403,
    `stranger list denied ${strangerList.res.status}`,
  );

  const strangerAppend = await httpJson(
    baseURL,
    `/api/v1/library/adventure-arcs/${arcId}/developments`,
    {
      method: 'POST',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: { kind: 'note', title: 'Hijack' },
    },
  );
  assert(
    strangerAppend.res.status === 404 || strangerAppend.res.status === 403,
    `stranger append denied ${strangerAppend.res.status}`,
  );

  await host.stop();
  console.log('PASS: cut-09-character-arcs.self-test');
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
