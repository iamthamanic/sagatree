#!/usr/bin/env node
/**
 * cut-04b-session-lobby-ready.self-test — Host lobby ready multiplayer fan-out (#1162).
 * Location: scripts/cut-04b-session-lobby-ready.self-test.mjs
 *
 * Two actors observe ready via SSE; unauth/stranger DENY; client userId ignored.
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

/**
 * Open SSE stream and collect ready events until predicate or timeout.
 * @returns {{ events: Array<{userId:string,ready:boolean}>, close: () => Promise<void> }}
 */
async function openReadyStream(baseURL, sessionId, cookie) {
  const events = [];
  const abort = new AbortController();
  const res = await fetch(
    `${baseURL}/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready/stream`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Origin: baseURL,
        cookie,
      },
      signal: abort.signal,
    },
  );
  assert(res.ok && res.body, `stream open ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const pump = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const parts = pending.split('\n\n');
        pending = parts.pop() ?? '';
        for (const block of parts) {
          for (const line of block.split('\n')) {
            if (!line.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(line.slice(5).trim());
              if (parsed?.type === 'ready' && typeof parsed.userId === 'string') {
                events.push({ userId: parsed.userId, ready: parsed.ready === true });
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();

  return {
    events,
    close: async () => {
      abort.abort();
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      await pump.catch(() => undefined);
    },
  };
}

async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert(false, `timeout waiting for ${label}`);
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-04b-lobby-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

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

try {
  await host.start();
  assert(host.isReady(), 'host ready');

  const gmPassword = `Gm-${randomBytes(8).toString('hex')}!1`;
  const playerPassword = `Pl-${randomBytes(8).toString('hex')}!1`;
  const strangerPassword = `St-${randomBytes(8).toString('hex')}!1`;

  const gmCookie = await signIn(baseURL, 'gm@cut04b.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@cut04b.test', playerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut04b.test', strangerPassword);

  const gmWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(gmWho.res.status === 200, `gm whoami ${gmWho.res.status}`);
  const gmActorId = gmWho.json.actorId;
  assert(typeof gmActorId === 'string', 'gm actorId');

  const playerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: playerCookie,
  });
  assert(playerWho.res.status === 200, `player whoami ${playerWho.res.status}`);
  const playerActorId = playerWho.json.actorId;
  assert(typeof playerActorId === 'string', 'player actorId');

  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-04b Lobby', description: 'ready fan-out' },
  });
  assert(
    createdProject.res.status === 201,
    `project create ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  const projectCode = createdProject.json?.project?.code;
  assert(typeof projectId === 'string', 'project id');
  assert(typeof projectCode === 'string', 'project code');

  const joinPlayer = await httpJson(baseURL, '/api/v1/projects/join', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { code: projectCode },
  });
  assert(joinPlayer.res.status === 200, `player project join ${joinPlayer.res.status}`);

  const created = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'Lobby Abend' },
  });
  assert(created.res.status === 201, `create session ${created.res.status} ${created.text}`);
  const sessionId = created.json?.session?.sessionId;
  const sessionCode =
    created.json?.session?.joinCode ?? created.json?.session?.code ?? null;
  assert(typeof sessionId === 'string', 'sessionId');
  assert(typeof sessionCode === 'string' && sessionCode.length > 0, 'session join code');

  const joined = await httpJson(baseURL, '/api/v1/sessions/join', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { code: sessionCode },
  });
  assert(joined.res.status === 200, `session join ${joined.res.status} ${joined.text}`);

  // --- Authz negatives ---
  const unauthStream = await fetch(
    `${baseURL}/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready/stream`,
    { method: 'GET', headers: { Accept: 'text/event-stream', Origin: baseURL } },
  );
  assert(
    unauthStream.status === 401 || unauthStream.status === 403,
    `unauth stream DENY ${unauthStream.status}`,
  );
  await unauthStream.body?.cancel?.();

  const strangerStream = await fetch(
    `${baseURL}/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready/stream`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Origin: baseURL,
        cookie: strangerCookie,
      },
    },
  );
  assert(
    strangerStream.status === 403 || strangerStream.status === 404,
    `stranger stream DENY ${strangerStream.status}`,
  );
  await strangerStream.body?.cancel?.();

  const strangerPublish = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: { ready: true },
    },
  );
  assert(
    strangerPublish.res.status === 403 || strangerPublish.res.status === 404,
    `stranger publish DENY ${strangerPublish.res.status}`,
  );

  const unauthPublish = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { ready: true },
    },
  );
  assert(
    unauthPublish.res.status === 401 || unauthPublish.res.status === 403,
    `unauth publish DENY ${unauthPublish.res.status}`,
  );

  // --- Two-actor observe ---
  const gmStream = await openReadyStream(baseURL, sessionId, gmCookie);
  const playerStream = await openReadyStream(baseURL, sessionId, playerCookie);

  // Give streams a moment to register subscribers.
  await new Promise((r) => setTimeout(r, 50));

  const spoof = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      cookie: playerCookie,
      headers: { Origin: baseURL },
      body: { ready: true, userId: gmActorId },
    },
  );
  assert(spoof.res.status === 200, `player publish ${spoof.res.status} ${spoof.text}`);
  assert(spoof.json?.userId === playerActorId, 'server stamps player actorId (ignores spoof)');
  assert(spoof.json?.ready === true, 'ready true');

  await waitFor(
    () => gmStream.events.some((e) => e.userId === playerActorId && e.ready === true),
    3000,
    'GM observe player ready',
  );
  await waitFor(
    () => playerStream.events.some((e) => e.userId === playerActorId && e.ready === true),
    3000,
    'player observe own ready echo',
  );

  const gmReady = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      cookie: gmCookie,
      headers: { Origin: baseURL },
      body: { ready: true },
    },
  );
  assert(gmReady.res.status === 200, `gm publish ${gmReady.res.status}`);
  assert(gmReady.json?.userId === gmActorId, 'gm stamped');

  await waitFor(
    () => playerStream.events.some((e) => e.userId === gmActorId && e.ready === true),
    3000,
    'player observe GM ready',
  );

  const clear = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      cookie: playerCookie,
      headers: { Origin: baseURL },
      body: { ready: false },
    },
  );
  assert(clear.res.status === 200, `player clear ${clear.res.status}`);
  await waitFor(
    () => gmStream.events.some((e) => e.userId === playerActorId && e.ready === false),
    3000,
    'GM observe player not-ready',
  );

  await gmStream.close();
  await playerStream.close();

  const badPayload = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready`,
    {
      method: 'POST',
      cookie: gmCookie,
      headers: { Origin: baseURL },
      body: { ready: 'yes' },
    },
  );
  assert(badPayload.res.status === 422, `invalid ready ${badPayload.res.status}`);

  console.log('PASS: cut-04b-session-lobby-ready.self-test');
} finally {
  try {
    await host.stop();
  } catch {
    /* ignore */
  }
  rmSync(work, { recursive: true, force: true });
}
