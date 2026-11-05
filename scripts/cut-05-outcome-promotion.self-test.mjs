#!/usr/bin/env node
/**
 * cut-05-outcome-promotion.self-test — Host HTTP session outcome promote (#1140).
 * Location: scripts/cut-05-outcome-promotion.self-test.mjs
 *
 * GM promote saga/world OK + idempotent; player/stranger DENY; missing consequence 404.
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
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

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-05-outcome-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 20100 + Math.floor(Math.random() * 1000);
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
  const playerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const gmCookie = await signIn(baseURL, 'gm@cut05.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@cut05.test', playerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut05.test', strangerPassword);

  const createdDef = await httpJson(baseURL, '/api/v1/saga-definitions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { title: 'CUT-05 User Saga', blurb: 'Outcome promote' },
  });
  assert(
    createdDef.res.status === 201 || createdDef.res.status === 200,
    `saga create ${createdDef.res.status} ${createdDef.text}`,
  );
  const sagaId =
    createdDef.json?.saga?.sagaId ??
    createdDef.json?.sagaId ??
    createdDef.json?.definition?.id;
  assert(typeof sagaId === 'string', `sagaId got ${JSON.stringify(createdDef.json)}`);
  let expectedRevision =
    typeof createdDef.json?.saga?.revision === 'number' ? createdDef.json.saga.revision : 0;

  const editor = await httpJson(baseURL, `/api/v1/saga-definitions/${encodeURIComponent(sagaId)}/editor`, {
    cookie: gmCookie,
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
  });
  assert(editor.res.status === 200, `editor ${editor.res.status} ${editor.text}`);
  if (typeof editor.json?.revision === 'number') expectedRevision = editor.json.revision;
  else if (typeof editor.json?.draftRevision === 'number') {
    expectedRevision = editor.json.draftRevision;
  } else if (typeof editor.json?.saga?.revision === 'number') {
    expectedRevision = editor.json.saga.revision;
  }

  const published = await httpJson(
    baseURL,
    `/api/v1/saga-definitions/${encodeURIComponent(sagaId)}/publish`,
    {
      method: 'POST',
      cookie: gmCookie,
      headers: { Origin: baseURL },
      body: { expectedRevision },
    },
  );
  assert(
    published.res.status === 200 || published.res.status === 201,
    `publish ${published.res.status} ${published.text}`,
  );
  const versionId =
    published.json?.publish?.versionId ??
    published.json?.saga?.versionId ??
    published.json?.versionId ??
    published.json?.version?.id ??
    published.json?.publishedVersionId;
  assert(typeof versionId === 'string', `versionId ${JSON.stringify(published.json)}`);

  const createdProject = await httpJson(baseURL, '/api/v1/saga-definitions/create-project', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { sagaId, versionId, name: 'CUT-05 Gruppe' },
  });
  assert(
    createdProject.res.status === 201 || createdProject.res.status === 200,
    `project ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId =
    createdProject.json?.project?.id ??
    createdProject.json?.id ??
    createdProject.json?.projectId;
  assert(typeof projectId === 'string', `projectId ${JSON.stringify(createdProject.json)}`);

  // Join code for player — read from DB (create-project may omit code in JSON).
  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  const projRow = pdb
    .prepare(`SELECT code, world_id AS worldId FROM projects WHERE id = ?`)
    .get(projectId);
  assert(projRow?.code, 'project code');
  pdb
    .prepare(`UPDATE projects SET adventure_runtime = ? WHERE id = ?`)
    .run(
      JSON.stringify({
        clocks: [],
        consequences: [
          { id: 'cons-shared', summary: 'Shared consequence', visibility: 'shared' },
          { id: 'cons-gm', summary: 'GM only consequence', visibility: 'gm_only' },
        ],
        openDeadlines: [],
        flags: [],
      }),
      projectId,
    );
  pdb.close();

  const joinPlayer = await httpJson(baseURL, '/api/v1/projects/join', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { code: projRow.code },
  });
  assert(joinPlayer.res.status === 200, `player join ${joinPlayer.res.status} ${joinPlayer.text}`);

  const createdSession = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'Abend CUT-05' },
  });
  assert(
    createdSession.res.status === 201,
    `session ${createdSession.res.status} ${createdSession.text}`,
  );
  const sessionId = createdSession.json?.session?.sessionId;
  assert(typeof sessionId === 'string', 'sessionId');

  const promotePath = (sid, cid, target) =>
    `/api/v1/sessions/${encodeURIComponent(sid)}/outcomes/${encodeURIComponent(cid)}/promote/${target}`;

  const playerDeny = await httpJson(baseURL, promotePath(sessionId, 'cons-shared', 'saga'), {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(
    playerDeny.res.status === 403 || playerDeny.res.status === 404,
    `player DENY ${playerDeny.res.status}`,
  );

  const strangerDeny = await httpJson(baseURL, promotePath(sessionId, 'cons-shared', 'saga'), {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(
    strangerDeny.res.status === 403 || strangerDeny.res.status === 404,
    `stranger DENY ${strangerDeny.res.status}`,
  );

  const missing = await httpJson(baseURL, promotePath(sessionId, 'missing-cons', 'saga'), {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(missing.res.status === 404 || missing.res.status === 400, `missing ${missing.res.status}`);

  const promo = await httpJson(baseURL, promotePath(sessionId, 'cons-shared', 'saga'), {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(promo.res.status === 200, `promote saga ${promo.res.status} ${promo.text}`);
  assert(promo.json?.ok === true, 'ok true');
  assert(promo.json?.idempotent !== true, 'first not idempotent');
  assert(promo.json?.targetKind === 'saga_fact', 'saga_fact');

  const again = await httpJson(baseURL, promotePath(sessionId, 'cons-shared', 'saga'), {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(again.res.status === 200, `idempotent ${again.res.status}`);
  assert(again.json?.idempotent === true, 'idempotent true');

  const worldPromo = await httpJson(baseURL, promotePath(sessionId, 'cons-gm', 'world'), {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(worldPromo.res.status === 200, `promote world ${worldPromo.res.status} ${worldPromo.text}`);
  assert(worldPromo.json?.ok === true, 'world ok');
  assert(worldPromo.json?.targetKind === 'world_fact', 'world_fact');

  const worldAgain = await httpJson(baseURL, promotePath(sessionId, 'cons-gm', 'world'), {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(worldAgain.json?.idempotent === true, 'world idempotent');

  // Restart — promotions durable
  await host.stop();
  const host2 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port + 1),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: `http://127.0.0.1:${port + 1}`,
    SAGATREE_AUTH_TRUSTED_ORIGINS: `http://127.0.0.1:${port + 1}`,
  });
  assert(!('error' in host2), 'host2');
  await host2.start();
  const verify = new DatabaseSync(hostDbPath);
  const ledger = verify
    .prepare(
      `SELECT COUNT(*) AS c FROM session_outcome_promotions WHERE session_id = ?`,
    )
    .get(sessionId);
  assert(ledger.c >= 2, `ledger rows ${ledger.c}`);
  verify.close();
  await host2.stop();

  console.log('PASS: cut-05-outcome-promotion.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
