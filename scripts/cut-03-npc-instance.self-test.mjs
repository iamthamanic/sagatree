#!/usr/bin/env node
/**
 * cut-03-npc-instance.self-test — Host HTTP NPC instance lifecycle (#1138).
 * Location: scripts/cut-03-npc-instance.self-test.mjs
 *
 * List/spawn/update/remove; temp-controller clear; non-GM / stranger denied.
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

const work = mkdtempSync(join(tmpdir(), 'cut-03-npc-inst-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

const npcDraft = {
  name: 'CUT-03 Instance NPC',
  description: 'Persistent spawn target',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'compact',
  level: 2,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['cut-03'],
};

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
  const gmCookie = await signIn(baseURL, 'gm@cut03.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@cut03.test', playerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut03.test', strangerPassword);

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
  assert(playerWho.res.status === 200, 'player whoami');
  const playerActorId = playerWho.json.actorId;

  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-03 Kampagne', description: 'Instance lifecycle' },
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

  const createdNpc = await httpJson(baseURL, '/api/v1/library/npc-creatures', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { scope: 'personal', draft: npcDraft },
  });
  assert(
    createdNpc.res.status === 201,
    `npc create ${createdNpc.res.status} ${createdNpc.text}`,
  );
  const definitionId = createdNpc.json?.definition?.id;
  assert(typeof definitionId === 'string', 'definition id');

  const emptyList = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(emptyList.res.status === 200, `empty list ${emptyList.res.status}`);
  assert(Array.isArray(emptyList.json?.instances) && emptyList.json.instances.length === 0, 'empty');

  const strangerList = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances?projectId=${encodeURIComponent(projectId)}`,
    { cookie: strangerCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(strangerList.res.status === 403, `stranger list DENY ${strangerList.res.status}`);

  const snapshot = {
    name: npcDraft.name,
    kind: 'creature',
    category: 'tier',
    sheetMode: 'compact',
    level: 2,
    combatProfile: 'balanced',
    combatRole: 'standard',
    tags: ['cut-03'],
    maxHealth: 12,
    capturedAt: new Date().toISOString(),
  };
  const runtime = {
    currentHp: 12,
    conditions: [],
    temporaryControllerUserId: null,
    encounterNotes: '',
  };

  const spawn = await httpJson(baseURL, '/api/v1/library/npc-instances', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {
      projectId,
      definitionId,
      instanceKind: 'persistent',
      displayName: 'CUT-03 Boss',
      sequenceNumber: 1,
      snapshot,
      runtime,
      sessionId: null,
    },
  });
  assert(spawn.res.status === 201, `spawn ${spawn.res.status} ${spawn.text}`);
  const instanceId = spawn.json?.instance?.id;
  assert(typeof instanceId === 'string', 'instance id');
  assert(spawn.json.instance.displayName === 'CUT-03 Boss', 'display name');
  assert(spawn.json.instance.createdBy === gmActorId, 'createdBy');

  const listed = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(listed.res.status === 200, 'list after spawn');
  assert(listed.json.instances.some((row) => row.id === instanceId), 'listed instance');

  const playerSpawn = await httpJson(baseURL, '/api/v1/library/npc-instances', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: {
      projectId,
      definitionId,
      instanceKind: 'persistent',
      displayName: 'Player spawn',
      sequenceNumber: 2,
      snapshot,
      runtime,
      sessionId: null,
    },
  });
  assert(playerSpawn.res.status === 403, `player spawn DENY ${playerSpawn.res.status}`);

  const updated = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}/runtime`,
    {
      method: 'PATCH',
      cookie: gmCookie,
      headers: { Origin: baseURL },
      body: {
        runtime: {
          currentHp: 7,
          conditions: ['bleeding'],
          temporaryControllerUserId: playerActorId,
          encounterNotes: 'round 2',
        },
      },
    },
  );
  assert(updated.res.status === 200, `update ${updated.res.status} ${updated.text}`);
  assert(updated.json.instance.runtime.currentHp === 7, 'hp updated');
  assert(
    updated.json.instance.runtime.temporaryControllerUserId === playerActorId,
    'temp controller',
  );
  assert(
    JSON.stringify(updated.json.instance.snapshot) === JSON.stringify(spawn.json.instance.snapshot),
    'snapshot frozen',
  );

  const playerUpdate = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}/runtime`,
    {
      method: 'PATCH',
      cookie: playerCookie,
      headers: { Origin: baseURL },
      body: { runtime: { currentHp: 1, conditions: [], temporaryControllerUserId: null, encounterNotes: '' } },
    },
  );
  assert(playerUpdate.res.status === 403, `player update DENY ${playerUpdate.res.status}`);

  // Session for temp-clear path (generic instance)
  const sessionCreate = await httpJson(baseURL, '/api/v1/sessions', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, name: 'CUT-03 Session' },
  });
  assert(
    sessionCreate.res.status === 201 || sessionCreate.res.status === 200,
    `session ${sessionCreate.res.status} ${sessionCreate.text}`,
  );
  const sessionId =
    sessionCreate.json?.session?.sessionId ??
    sessionCreate.json?.session?.id ??
    sessionCreate.json?.sessionId ??
    sessionCreate.json?.id;
  assert(typeof sessionId === 'string', `session id ${sessionCreate.text}`);

  const genericSpawn = await httpJson(baseURL, '/api/v1/library/npc-instances', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: {
      projectId,
      definitionId,
      instanceKind: 'generic',
      displayName: 'Temp Mob',
      sequenceNumber: 2,
      snapshot,
      runtime: {
        currentHp: 5,
        conditions: [],
        temporaryControllerUserId: playerActorId,
        encounterNotes: '',
      },
      sessionId,
    },
  });
  assert(
    genericSpawn.res.status === 201,
    `generic spawn ${genericSpawn.res.status} ${genericSpawn.text}`,
  );
  const genericId = genericSpawn.json.instance.id;

  const clearTemp = await httpJson(
    baseURL,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/npc-temp-controllers/clear`,
    { method: 'POST', cookie: gmCookie, headers: { Origin: baseURL }, body: {} },
  );
  assert(clearTemp.res.status === 200, `clear temp ${clearTemp.res.status} ${clearTemp.text}`);
  assert(clearTemp.json.cleared >= 1, 'cleared count');

  const afterClearList = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  const genericAfter = afterClearList.json.instances.find((row) => row.id === genericId);
  assert(genericAfter, 'generic still present');
  assert(
    genericAfter.runtime.temporaryControllerUserId === null,
    'temp controller cleared',
  );

  const remove = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}`,
    { method: 'DELETE', cookie: gmCookie, headers: { Origin: baseURL } },
  );
  assert(remove.res.status === 200, `remove ${remove.res.status}`);

  const afterRemove = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(
    !afterRemove.json.instances.some((row) => row.id === instanceId),
    'persistent removed',
  );

  const removeAgain = await httpJson(
    baseURL,
    `/api/v1/library/npc-instances/${encodeURIComponent(instanceId)}`,
    { method: 'DELETE', cookie: gmCookie, headers: { Origin: baseURL } },
  );
  assert(
    removeAgain.res.status === 404,
    `remove missing ${removeAgain.res.status}`,
  );

  console.log('PASS: cut-03-npc-instance.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
