#!/usr/bin/env node
/**
 * cut-02-npc-controller.self-test — Host HTTP assign/clear controller (#1137).
 * Location: scripts/cut-02-npc-controller.self-test.mjs
 *
 * Happy assign + clear; non-GM denied; non-member controller denied; unauth denied.
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

const work = mkdtempSync(join(tmpdir(), 'cut-02-npc-ctrl-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19700 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

const npcDraft = {
  name: 'CUT-02 Controller NPC',
  description: 'Full sheet for assignment',
  kind: 'creature',
  category: 'tier',
  sheetMode: 'full',
  level: 3,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['cut-02'],
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
  const gmCookie = await signIn(baseURL, 'gm@cut02.test', gmPassword);
  const playerCookie = await signIn(baseURL, 'player@cut02.test', playerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut02.test', strangerPassword);

  const gmWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: gmCookie,
  });
  assert(gmWho.res.status === 200, `gm whoami ${gmWho.res.status}`);
  const gmActorId = gmWho.json.actorId;
  assert(typeof gmActorId === 'string' && gmActorId.length > 0, 'gm actorId');

  const playerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: playerCookie,
  });
  assert(playerWho.res.status === 200, `player whoami ${playerWho.res.status}`);
  const playerActorId = playerWho.json.actorId;
  assert(typeof playerActorId === 'string' && playerActorId.length > 0, 'player actorId');

  const createdProject = await httpJson(baseURL, '/api/v1/projects', {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { name: 'CUT-02 Kampagne', description: 'Controller assignment' },
  });
  assert(
    createdProject.res.status === 201,
    `project create ${createdProject.res.status} ${createdProject.text}`,
  );
  const projectId = createdProject.json?.project?.id;
  const joinCode = createdProject.json?.project?.code;
  assert(typeof projectId === 'string', 'project id');
  assert(typeof joinCode === 'string' && joinCode.length >= 4, 'project code');

  const joinPlayer = await httpJson(baseURL, '/api/v1/projects/join', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { code: joinCode },
  });
  assert(joinPlayer.res.status === 200, `player join ${joinPlayer.res.status} ${joinPlayer.text}`);

  const membersList = await httpJson(
    baseURL,
    `/api/v1/projects/${encodeURIComponent(projectId)}/members`,
    { cookie: gmCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(
    membersList.res.status === 200,
    `members list ${membersList.res.status} ${membersList.text}`,
  );
  const memberUserIds = (membersList.json?.members ?? []).map((m) => m.userId);
  assert(memberUserIds.includes(gmActorId), 'members include GM');
  assert(memberUserIds.includes(playerActorId), 'members include player');

  const strangerMembers = await httpJson(
    baseURL,
    `/api/v1/projects/${encodeURIComponent(projectId)}/members`,
    { cookie: strangerCookie, headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' } },
  );
  assert(
    strangerMembers.res.status === 403,
    `stranger members DENY ${strangerMembers.res.status}`,
  );

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

  const controllerPath = `/api/v1/library/npc-creatures/${encodeURIComponent(definitionId)}/controller`;

  const unauthGet = await httpJson(
    baseURL,
    `${controllerPath}?projectId=${encodeURIComponent(projectId)}`,
    { headers: { Origin: baseURL } },
  );
  assert(unauthGet.res.status === 401, `unauth GET ${unauthGet.res.status}`);

  const unauthPost = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: playerActorId },
  });
  assert(unauthPost.res.status === 401, `unauth POST ${unauthPost.res.status}`);

  const emptyGet = await httpJson(
    baseURL,
    `${controllerPath}?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL } },
  );
  assert(emptyGet.res.status === 200, `empty GET ${emptyGet.res.status} ${emptyGet.text}`);
  assert(emptyGet.json?.assignment === null, 'no assignment yet');

  const assign = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: playerActorId },
  });
  assert(assign.res.status === 200, `assign ${assign.res.status} ${assign.text}`);
  assert(assign.json?.assignment?.controllerUserId === playerActorId, 'assigned controller');
  assert(assign.json.assignment.projectId === projectId, 'assign projectId');
  assert(assign.json.assignment.definitionId === definitionId, 'assign definitionId');
  assert(assign.json.assignment.assignedBy === gmActorId, 'assignedBy is GM');

  const loaded = await httpJson(
    baseURL,
    `${controllerPath}?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL } },
  );
  assert(loaded.res.status === 200, `load ${loaded.res.status}`);
  assert(loaded.json?.assignment?.controllerUserId === playerActorId, 'loaded controller');

  const playerLoad = await httpJson(
    baseURL,
    `${controllerPath}?projectId=${encodeURIComponent(projectId)}`,
    { cookie: playerCookie, headers: { Origin: baseURL } },
  );
  assert(playerLoad.res.status === 200, `player load ${playerLoad.res.status}`);
  assert(playerLoad.json?.assignment?.controllerUserId === playerActorId, 'player sees assignment');

  const idempotent = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: playerActorId },
  });
  assert(idempotent.res.status === 200, `idempotent assign ${idempotent.res.status}`);
  assert(idempotent.json?.assignment?.controllerUserId === playerActorId, 'idempotent value');

  const playerAssign = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: playerActorId },
  });
  assert(
    playerAssign.res.status === 403,
    `non-GM DENY ${playerAssign.res.status} ${playerAssign.text}`,
  );

  const strangerAssign = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: playerActorId },
  });
  assert(
    strangerAssign.res.status === 403,
    `stranger DENY ${strangerAssign.res.status} ${strangerAssign.text}`,
  );

  const strangerWho = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie: strangerCookie,
  });
  assert(strangerWho.res.status === 200, 'stranger whoami');
  const strangerActorId = strangerWho.json.actorId;

  const nonMemberController = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: strangerActorId },
  });
  assert(
    nonMemberController.res.status === 422 || nonMemberController.res.status === 403,
    `non-member controller DENY ${nonMemberController.res.status} ${nonMemberController.text}`,
  );

  const clear = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: null },
  });
  assert(clear.res.status === 200, `clear ${clear.res.status} ${clear.text}`);
  assert(clear.json?.assignment?.controllerUserId === null, 'cleared controller');

  const afterClear = await httpJson(
    baseURL,
    `${controllerPath}?projectId=${encodeURIComponent(projectId)}`,
    { cookie: gmCookie, headers: { Origin: baseURL } },
  );
  assert(afterClear.res.status === 200, `after clear GET ${afterClear.res.status}`);
  assert(afterClear.json?.assignment?.controllerUserId === null, 'persisted clear');

  const clearAgain = await httpJson(baseURL, controllerPath, {
    method: 'POST',
    cookie: gmCookie,
    headers: { Origin: baseURL },
    body: { projectId, controllerUserId: null },
  });
  assert(clearAgain.res.status === 200, `clear idempotent ${clearAgain.res.status}`);

  console.log('PASS: cut-02-npc-controller.self-test');
  await host.stop();
} finally {
  rmSync(work, { recursive: true, force: true });
}
