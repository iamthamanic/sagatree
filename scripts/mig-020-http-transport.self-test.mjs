#!/usr/bin/env node
/**
 * mig-020-http-transport.self-test — Hono typed command/query transport.
 * Location: scripts/mig-020-http-transport.self-test.mjs
 *
 * Covers: validate→authorize→execute order, 401/403/409/422 mapping,
 * idempotent retry without double mutation, role-scoped projection,
 * zero partial state on denies. Regression: MIG-014 whoami still works.
 */
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const transportUrl = pathToFileURL(join(root, 'server/src/application/transport/index.ts')).href;

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
    assert(signInRes.res.status < 400, `sign-in ${email}: ${signInRes.status} ${signInRes.text}`);
    cookie = signInRes.cookie;
  }
  assert(cookie && cookie.includes('='), `cookie for ${email}`);
  return cookie;
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const { TRANSPORT_PIPELINE } = await import(transportUrl);

const work = mkdtempSync(join(tmpdir(), 'mig020-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19200 + Math.floor(Math.random() * 1000);
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
  const gmCookie = await signIn(baseURL, 'gm@mig020.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@mig020.test', playerPassword);

  const gmWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(gmWho.res.status === 200, `gm whoami ${gmWho.res.status}`);
  const gmActorId = gmWho.json.actorId;

  const playerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: playerCookie,
  });
  assert(playerWho.res.status === 200, `player whoami ${playerWho.res.status}`);
  const playerActorId = playerWho.json.actorId;
  assert(playerActorId !== gmActorId, 'distinct actors');

  const hostDbPath = join(dataDir, 'host.sqlite');
  assert(existsSync(hostDbPath), 'host.sqlite');
  const pdb = new DatabaseSync(hostDbPath);
  pdb.exec(`
    INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-mig020', '${gmActorId.replace(/'/g, "''")}', 'W', '2026-10-23T00:00:00.000Z');
    INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('proj-mig020', 'world-mig020', '${gmActorId.replace(/'/g, "''")}', 'P', '2026-10-23T00:00:00.000Z');
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES
      ('proj-mig020', '${gmActorId.replace(/'/g, "''")}', 'gm', 1, '2026-10-23T00:00:00.000Z'),
      ('proj-mig020', '${playerActorId.replace(/'/g, "''")}', 'player', 1, '2026-10-23T00:00:00.000Z');
  `);
  pdb.close();

  const sessionId = 'sess-mig020';
  const cmdPath = `/api/v1/sessions/${sessionId}/commands`;
  const snapPath = `/api/v1/sessions/${sessionId}/snapshot?projectId=proj-mig020`;

  // --- Fall 2a: 401 unauthenticated ---
  const unauth = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 0,
      idempotencyKey: 'k-unauth',
    },
  });
  assert(unauth.res.status === 401, `401 expected: ${unauth.res.status}`);
  assert(unauth.json?.error === 'UNAUTHENTICATED' || unauth.json?.error === 'ORIGIN_DENIED', `401 code: ${unauth.text}`);

  // --- Fall 2b: 422 validation ---
  const invalid = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: { projectId: 'proj-mig020', expectedRevision: 'nope', idempotencyKey: 'k-bad' },
  });
  assert(invalid.res.status === 422, `422 expected: ${invalid.res.status} ${invalid.text}`);
  assert(invalid.json?.error === 'INVALID_PAYLOAD', 'INVALID_PAYLOAD');

  // P1: snapshot read must not create session→project from client IDs
  const snapBefore = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapBefore.res.status === 403, `snap-before must not invent session: ${snapBefore.res.status}`);
  assert(snapBefore.json?.error === 'FORBIDDEN', 'session-not-found → FORBIDDEN');

  // --- Fall 1: happy path command (validate → authorize → execute) ---
  const cmd1 = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 0,
      idempotencyKey: 'k-happy-1',
      note: 'gm-secret-note',
    },
  });
  assert(cmd1.res.status === 200, `cmd1 ${cmd1.res.status} ${cmd1.text}`);
  assert(cmd1.json?.ok === true, 'cmd1 ok');
  assert(cmd1.json?.idempotentReplay === false, 'not replay');
  assert(cmd1.json?.projection?.revision === 1, 'revision 1');
  assert(cmd1.json?.projection?.value === 1, 'value 1');
  assert(cmd1.json?.projection?.gmNotes === 'gm-secret-note', 'gm notes');
  assert(cmd1.json?.projection?.role === 'gm', 'gm role');
  assert(
    JSON.stringify(cmd1.json.pipeline) === JSON.stringify([...TRANSPORT_PIPELINE]),
    'command pipeline order',
  );

  const snap0 = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snap0.res.status === 200, `snap0 ${snap0.res.status}`);
  assert(snap0.json?.projection?.revision === 1, 'snapshot after create');
  assert(Array.isArray(snap0.json?.pipeline), 'pipeline present');
  assert(
    JSON.stringify(snap0.json.pipeline) === JSON.stringify([...TRANSPORT_PIPELINE]),
    `pipeline order: ${JSON.stringify(snap0.json.pipeline)}`,
  );

  // --- Fall 3: idempotent retry (lost response) — same result, no double mutation ---
  const cmd1Retry = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 0,
      idempotencyKey: 'k-happy-1',
      note: 'gm-secret-note',
    },
  });
  assert(cmd1Retry.res.status === 200, `retry ${cmd1Retry.res.status}`);
  assert(cmd1Retry.json?.idempotentReplay === true, 'idempotent replay');
  assert(cmd1Retry.json?.projection?.revision === 1, 'retry still revision 1');
  assert(cmd1Retry.json?.projection?.value === 1, 'retry value unchanged');

  // P2: refreshed expectedRevision alone must still replay (not in fingerprint)
  const cmd1RetryFreshRev = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 1,
      idempotencyKey: 'k-happy-1',
      note: 'gm-secret-note',
    },
  });
  assert(cmd1RetryFreshRev.res.status === 200, `fresh-rev retry ${cmd1RetryFreshRev.res.status}`);
  assert(cmd1RetryFreshRev.json?.idempotentReplay === true, 'fresh-rev is replay');
  assert(cmd1RetryFreshRev.json?.projection?.revision === 1, 'fresh-rev no second mutation');

  const snapAfterRetry = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapAfterRetry.json?.projection?.revision === 1, 'no double mutation after retry');
  assert(snapAfterRetry.json?.projection?.value === 1, 'value still 1');

  // Idempotency conflict on different payload
  const conflict = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 0,
      idempotencyKey: 'k-happy-1',
      note: 'different-note',
    },
  });
  assert(conflict.res.status === 409, `idempotency conflict: ${conflict.res.status}`);
  assert(conflict.json?.error === 'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_CONFLICT');

  // --- Fall 2c: 409 stale revision ---
  const stale = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 0,
      idempotencyKey: 'k-stale',
    },
  });
  assert(stale.res.status === 409, `stale: ${stale.res.status}`);
  assert(stale.json?.error === 'STALE_REVISION', 'STALE_REVISION');
  const snapStale = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapStale.json?.projection?.revision === 1, 'stale leave revision untouched');

  // --- Fall 2d: 403 player cannot GM-command ---
  const denied = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: playerCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 1,
      idempotencyKey: 'k-player-forge',
      role: 'gm',
      ownerUserId: gmActorId,
    },
  });
  assert(denied.res.status === 403, `403 player: ${denied.res.status} ${denied.text}`);
  assert(denied.json?.error === 'FORBIDDEN', 'FORBIDDEN');
  const snapDenied = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapDenied.json?.projection?.revision === 1, '403 no partial state');

  // Role-scoped snapshot: player sees no gmNotes
  const playerSnap = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: playerCookie,
  });
  assert(playerSnap.res.status === 200, `player snap ${playerSnap.res.status}`);
  assert(playerSnap.json?.projection?.role === 'player', 'player role');
  assert(playerSnap.json?.projection?.gmNotes === undefined, 'no gmNotes for player');
  assert(playerSnap.json?.projection?.revision === 1, 'player sees revision');

  // Advance with correct revision
  const cmd2 = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gmCookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 1,
      idempotencyKey: 'k-happy-2',
    },
  });
  assert(cmd2.res.status === 200 && cmd2.json?.projection?.revision === 2, 'cmd2 advances');

  // --- P1: GM handover — session-scoped key rejects other actor (no double mutate) ---
  const gm2Password = `Pw-${randomBytes(12).toString('base64url')}`;
  const gm2Cookie = await signIn(baseURL, 'gm2@mig020.test', gm2Password);
  const gm2Who = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gm2Cookie,
  });
  const gm2ActorId = gm2Who.json.actorId;
  const pdb2 = new DatabaseSync(hostDbPath);
  pdb2.exec(`
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('proj-mig020', '${gm2ActorId.replace(/'/g, "''")}', 'gm', 1, '2026-10-23T00:00:00.000Z');
    UPDATE projects SET gm_user_id = '${gm2ActorId.replace(/'/g, "''")}' WHERE id = 'proj-mig020';
  `);
  pdb2.close();

  const handover = await httpJson(baseURL, cmdPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: gm2Cookie,
    body: {
      projectId: 'proj-mig020',
      expectedRevision: 2,
      idempotencyKey: 'k-happy-2',
    },
  });
  assert(handover.res.status === 409, `handover conflict: ${handover.res.status} ${handover.text}`);
  assert(handover.json?.error === 'IDEMPOTENCY_CONFLICT', 'actor mismatch → IDEMPOTENCY_CONFLICT');
  const snapHandover = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapHandover.json?.projection?.revision === 2, 'handover must not mutate');

  // --- P1: cross-project snapshot squat denied without mutation ---
  const pdb3 = new DatabaseSync(hostDbPath);
  pdb3.exec(`
    INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-other', '${playerActorId.replace(/'/g, "''")}', 'Other', '2026-10-23T00:00:00.000Z');
    INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('proj-other', 'world-other', '${playerActorId.replace(/'/g, "''")}', 'OtherP', '2026-10-23T00:00:00.000Z');
    INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at)
    VALUES ('proj-other', '${playerActorId.replace(/'/g, "''")}', 'gm', 1, '2026-10-23T00:00:00.000Z');
  `);
  pdb3.close();

  const squatSnap = await httpJson(
    baseURL,
    `/api/v1/sessions/${sessionId}/snapshot?projectId=proj-other`,
    {
      headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
      cookie: playerCookie,
    },
  );
  assert(squatSnap.res.status === 409, `squat snap denied: ${squatSnap.res.status}`);
  assert(squatSnap.json?.error === 'SESSION_MISMATCH', 'SESSION_MISMATCH on cross-project read');

  const squatUnknown = await httpJson(
    baseURL,
    `/api/v1/sessions/sess-never-created/snapshot?projectId=proj-other`,
    {
      headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
      cookie: playerCookie,
    },
  );
  assert(squatUnknown.res.status === 403, `unknown session not invented: ${squatUnknown.res.status}`);

  const snapStillOwner = await httpJson(baseURL, snapPath, {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(snapStillOwner.res.status === 200, 'owner snap still works');
  assert(snapStillOwner.json?.projection?.revision === 2, 'owner association unchanged');

  // Health still works through Hono
  const health = await httpJson(baseURL, '/health');
  assert(health.res.status === 200 && health.json?.ready === true, 'health via Hono');

  // Typed-strict boy scout: no `as any` / @ts-ignore in touched transport/api files
  const { readFileSync } = await import('node:fs');
  for (const rel of [
    'server/src/application/transport/index.ts',
    'server/src/api/create-app.ts',
    'server/src/api/errors.ts',
    'server/src/api/index.ts',
    'server/src/http/route-registry.ts',
  ]) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert(!/\bas any\b/.test(src), `${rel}: no as any`);
    assert(!/@ts-ignore|@ts-expect-error|as unknown as/.test(src), `${rel}: no type escapes`);
  }

  await host.stop();
  console.log('PASS mig-020-http-transport.self-test');
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
