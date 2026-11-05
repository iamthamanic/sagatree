#!/usr/bin/env node
/**
 * cut-04-session-delete.self-test — Host HTTP GM session deletion (#1139).
 * Location: scripts/cut-04-session-delete.self-test.mjs
 *
 * GM delete OK; player/stranger DENY; missing/idempotent P0002; cascade + npc SET NULL.
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

const work = mkdtempSync(join(tmpdir(), 'cut-04-sess-del-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19900 + Math.floor(Math.random() * 1000);
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
  const gmCookie = await signIn(baseURL, 'gm@cut04.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@cut04.test', playerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut04.test', strangerPassword);

  const gmWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(gmWho.res.status === 200, `gm whoami ${gmWho.res.status}`);
  const gmActorId = gmWho.json.actorId;

  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-04 Kampagne', description: 'Session delete' },
  });
  assert(
    createdProject.res.status === 201,
    `project create ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  const joinCode = createdProject.json?.project?.code;
  assert(typeof projectId === 'string', 'project id');

  const joinPlayer = await httpJson(baseURL, '/api/v1/projects/join', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { code: joinCode },
  });
  assert(joinPlayer.res.status === 200, `player join ${joinPlayer.res.status}`);

  const created = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'Abend CUT-04' },
  });
  assert(created.res.status === 201, `create session ${created.res.status} ${created.text}`);
  const sessionId = created.json?.session?.sessionId;
  assert(typeof sessionId === 'string', 'sessionId');

  // Seed invite + npc instance bound to session for cascade / SET NULL checks.
  const invite = await httpJson(baseURL, `/api/v1/sessions/${encodeURIComponent(sessionId)}/invites`, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {},
  });
  assert(invite.res.status === 201 || invite.res.status === 200, `invite ${invite.res.status} ${invite.text}`);

  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  const now = new Date().toISOString();
  pdb
    .prepare(
      `INSERT INTO npc_creature_instances (
         id, project_id, session_id, definition_id, display_name, instance_kind,
         sequence_number, snapshot, runtime, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'persistent', 1, '{}', '{}', ?, ?, ?)`,
    )
    .run(
      'npc-inst-cut04',
      projectId,
      sessionId,
      'def-cut04-placeholder',
      'Bound NPC',
      gmActorId,
      now,
      now,
    );
  const beforeRuntime = pdb
    .prepare(`SELECT COUNT(*) AS c FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  assert(beforeRuntime.c === 1, 'runtime seeded');
  const beforeInvite = pdb
    .prepare(`SELECT COUNT(*) AS c FROM session_invites WHERE session_id = ?`)
    .get(sessionId);
  assert(beforeInvite.c >= 1, 'invite present');
  pdb.close();

  const unauth = await httpJson(baseURL, `/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { Origin: baseURL },
  });
  assert(unauth.res.status === 401 || unauth.res.status === 403, `unauth DENY ${unauth.res.status}`);

  const playerDelete = await httpJson(baseURL, `/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    cookie: playerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    playerDelete.res.status === 403 || playerDelete.res.status === 404,
    `player DENY ${playerDelete.res.status}`,
  );

  const strangerDelete = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'DELETE',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
    },
  );
  assert(
    strangerDelete.res.status === 403 || strangerDelete.res.status === 404,
    `stranger DENY ${strangerDelete.res.status}`,
  );

  const missing = await httpJson(baseURL, '/api/v1/sessions/no-such-session-cut04', {
    method: 'DELETE',
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(
    missing.res.status === 404 || missing.res.status === 403,
    `missing ${missing.res.status}`,
  );

  const deleted = await httpJson(baseURL, `/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(deleted.res.status === 200, `gm delete ${deleted.res.status} ${deleted.text}`);
  assert(deleted.json?.ok === true, 'ok true');
  assert(deleted.json?.sessionId === sessionId, 'sessionId echo');

  const again = await httpJson(baseURL, `/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    cookie: gmCookie,
    headers: { Origin: baseURL },
  });
  assert(
    again.res.status === 404 || again.res.status === 403,
    `idempotent missing ${again.res.status}`,
  );

  const verify = new DatabaseSync(hostDbPath);
  const gone = verify.prepare(`SELECT COUNT(*) AS c FROM play_sessions WHERE session_id = ?`).get(sessionId);
  assert(gone.c === 0, 'play_sessions removed');
  const invitesGone = verify
    .prepare(`SELECT COUNT(*) AS c FROM session_invites WHERE session_id = ?`)
    .get(sessionId);
  assert(invitesGone.c === 0, 'invites cascaded');
  const playersGone = verify
    .prepare(`SELECT COUNT(*) AS c FROM session_players WHERE session_id = ?`)
    .get(sessionId);
  assert(playersGone.c === 0, 'players cascaded');
  const runtimeGone = verify
    .prepare(`SELECT COUNT(*) AS c FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  assert(runtimeGone.c === 0, 'runtime removed');
  const eventsGone = verify
    .prepare(`SELECT COUNT(*) AS c FROM session_events WHERE session_id = ?`)
    .get(sessionId);
  assert(eventsGone.c === 0, 'events removed');
  const npc = verify
    .prepare(`SELECT session_id AS sid FROM npc_creature_instances WHERE id = ?`)
    .get('npc-inst-cut04');
  assert(npc && npc.sid == null, 'npc session_id SET NULL');
  verify.close();

  // Restart host — orphans must stay gone.
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
  assert(!('error' in host2), `host2 create: ${JSON.stringify(host2)}`);
  await host2.start();
  assert(host2.isReady(), 'ready2');
  const afterRestart = new DatabaseSync(hostDbPath);
  const stillGone = afterRestart
    .prepare(`SELECT COUNT(*) AS c FROM play_sessions WHERE session_id = ?`)
    .get(sessionId);
  assert(stillGone.c === 0, 'still deleted after restart');
  afterRestart.close();
  await host2.stop();

  console.log('PASS: cut-04-session-delete.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
