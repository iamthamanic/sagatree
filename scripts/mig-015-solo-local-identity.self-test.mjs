#!/usr/bin/env node
/**
 * mig-015-solo-local-identity.self-test — persistent solo identity without privilege transfer.
 * Location: scripts/mig-015-solo-local-identity.self-test.mjs
 *
 * Covers: stable solo actor across restart, SOLO_REQUIRES_LOOPBACK, forged
 * local-identity headers denied, explicit account-link required for solo-owned
 * resources under remote sessions (no silent full access).
 */
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const soloUrl = pathToFileURL(join(root, 'server/src/auth/solo/index.ts')).href;

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

function wsProbe(port, host, { cookie, origin, extraHeaders = {} } = {}) {
  return new Promise((resolve) => {
    const key = randomBytes(16).toString('base64');
    const lines = [
      'GET /v1/session-ws HTTP/1.1',
      `Host: ${host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
    ];
    if (origin) lines.push(`Origin: ${origin}`);
    if (cookie) lines.push(`Cookie: ${cookie}`);
    for (const [name, value] of Object.entries(extraHeaders)) {
      lines.push(`${name}: ${value}`);
    }
    lines.push('', '');

    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(lines.join('\r\n'));
    });
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ status: 0, body: '', upgraded: false, error: 'timeout' });
    }, 5000);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const text = buf.toString('utf8');
      if (!text.includes('\r\n\r\n')) return;
      clearTimeout(timer);
      const headerEnd = text.indexOf('\r\n\r\n');
      const head = text.slice(0, headerEnd);
      const statusMatch = head.match(/^HTTP\/1\.\d\s+(\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      socket.destroy();
      resolve({ status, body: text.slice(headerEnd + 4), upgraded: status === 101, head });
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: 0, body: '', upgraded: false, error: String(err) });
    });
  });
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const solo = await import(soloUrl);

const work = mkdtempSync(join(tmpdir(), 'mig015-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19100 + Math.floor(Math.random() * 1000);

try {
  // --- Fall 1: durable solo identity across restart ---
  const solo1 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_HOST_MODE: 'solo',
  });
  assert(!('error' in solo1), `solo create: ${JSON.stringify(solo1)}`);
  await solo1.start();
  const identityPath = join(dataDir, solo.HOST_IDENTITY_FILENAME);
  assert(existsSync(identityPath), 'host-identity.json created');
  const actorId1 = JSON.parse(readFileSync(identityPath, 'utf8')).actorId;
  assert(solo.isSoloActorId(actorId1), `solo actor prefix: ${actorId1}`);

  const dbPath = join(dataDir, 'host.sqlite');
  const seedDb = new DatabaseSync(dbPath);
  seedDb.exec(`
    INSERT INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-solo', '${actorId1.replace(/'/g, "''")}', 'Solo World', '2026-10-23T00:00:00.000Z');
  `);
  seedDb.close();
  await solo1.stop();

  const solo2 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port + 1),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_HOST_MODE: 'solo',
  });
  assert(!('error' in solo2), 'solo restart create');
  await solo2.start();
  const actorId2 = JSON.parse(readFileSync(identityPath, 'utf8')).actorId;
  assert(actorId1 === actorId2, 'solo identity stable across restart');
  await solo2.stop();

  // --- GATE-02 common-7: solo cannot bind publicly ---
  const publicSolo = createHost({
    SAGATREE_DATA_DIR: join(work, 'public-solo'),
    SAGATREE_PORT: String(port + 2),
    SAGATREE_HOST: '0.0.0.0',
    SAGATREE_HOST_MODE: 'solo',
    SAGATREE_ALLOW_REMOTE_BIND: '1',
    SAGATREE_BETTER_AUTH_SECRET: generateAuthSecret(),
  });
  assert('error' in publicSolo, 'solo+0.0.0.0 must fail closed');
  assert(
    publicSolo.error === solo.SOLO_REQUIRES_LOOPBACK || /SOLO_REQUIRES_LOOPBACK/.test(publicSolo.error),
    `expected SOLO_REQUIRES_LOOPBACK, got: ${publicSolo.error}`,
  );

  // --- Fall 2 + 3: remote host — forged solo claims denied; link required ---
  const remoteDir = join(work, 'remote');
  mkdirSync(remoteDir);
  // Carry solo identity + world ownership into the remote-mode data dir.
  writeFileSync(
    join(remoteDir, solo.HOST_IDENTITY_FILENAME),
    `${JSON.stringify({ actorId: actorId1 }, null, 2)}\n`,
    'utf8',
  );

  const authSecret = generateAuthSecret();
  const remotePort = port + 10;
  const baseURL = `http://127.0.0.1:${remotePort}`;
  const remote = createHost({
    SAGATREE_DATA_DIR: remoteDir,
    SAGATREE_PORT: String(remotePort),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_HOST_MODE: 'remote',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL,
  });
  assert(!('error' in remote), `remote create: ${JSON.stringify(remote)}`);
  await remote.start();

  const remoteDb = new DatabaseSync(join(remoteDir, 'host.sqlite'));
  remoteDb.exec(`
    INSERT INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-solo', '${actorId1.replace(/'/g, "''")}', 'Solo World', '2026-10-23T00:00:00.000Z');
  `);
  remoteDb.close();

  // Forged local identity header — no cookie — must not authorize.
  const forgedWhoami = await httpJson(baseURL, '/api/whoami', {
    headers: {
      Origin: baseURL,
      'Sec-Fetch-Site': 'same-origin',
      'x-solo-user': 'local-owner',
    },
  });
  assert(forgedWhoami.res.status === 401 || forgedWhoami.res.status === 403, 'forged whoami denied');
  assert(
    forgedWhoami.json?.error === 'SOLO_IDENTITY_FORBIDDEN' ||
      forgedWhoami.json?.error === 'UNAUTHENTICATED' ||
      forgedWhoami.json?.error === 'AUTH_NOT_CONFIGURED',
    `forged whoami code: ${forgedWhoami.json?.error}`,
  );
  // Prefer the explicit forged code when headers are present (identity layer runs first).
  assert(forgedWhoami.json?.error === 'SOLO_IDENTITY_FORBIDDEN', 'forged header → SOLO_IDENTITY_FORBIDDEN');

  const forgedBody = await httpJson(baseURL, '/api/world-touch', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { worldId: 'world-solo', localIdentity: 'local-owner', role: 'gm' },
  });
  assert(forgedBody.res.status === 401 || forgedBody.res.status === 403, 'forged body denied');
  assert(forgedBody.json?.error === 'SOLO_IDENTITY_FORBIDDEN', 'forged body code');
  assert(forgedBody.json?.mutated !== true, 'no mutation from forged body');

  const wsForged = await wsProbe(remotePort, `127.0.0.1:${remotePort}`, {
    origin: baseURL,
    extraHeaders: { 'x-solo-user': 'local-owner' },
  });
  assert(wsForged.upgraded === false, 'ws forged solo denied');
  assert(wsForged.status === 401 || wsForged.status === 403, `ws forged status: ${wsForged.status}`);

  // Real remote account — still no silent ownership of solo world.
  const email = 'remote@example.test';
  const password = `Pw-${randomBytes(12).toString('base64url')}`;
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name: 'Remote User' },
  });
  assert(signUp.res.status < 400, `sign-up ${signUp.res.status} ${signUp.text}`);
  let cookie = signUp.cookie;
  if (!cookie) {
    const signIn = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email, password },
    });
    cookie = signIn.cookie;
  }
  assert(cookie.includes('='), 'remote session cookie');

  const whoami = await httpJson(baseURL, '/api/whoami', {
    headers: { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' },
    cookie,
  });
  assert(whoami.res.status === 200, `whoami ${whoami.res.status}`);
  const remoteActorId = whoami.json.actorId;
  assert(typeof remoteActorId === 'string' && remoteActorId.length > 0, 'remote actorId');
  assert(remoteActorId !== actorId1, 'remote actor is not solo identity');

  const touchBeforeLink = await httpJson(baseURL, '/api/world-touch', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
    body: { worldId: 'world-solo', role: 'gm', ownerUserId: actorId1 },
  });
  assert(touchBeforeLink.res.status === 403, `unlink deny status ${touchBeforeLink.res.status}`);
  assert(touchBeforeLink.json?.error === 'ACCOUNT_LINK_REQUIRED', `unlink code: ${touchBeforeLink.json?.error}`);
  assert(touchBeforeLink.json?.mutated === false, 'no silent full access');
  assert(!existsSync(join(remoteDir, 'world-touch.jsonl')), 'no world-touch file before link');

  // Mismatched / foreign solo id cannot link.
  const badLink = await httpJson(baseURL, '/api/solo/link-account', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
    body: { soloActorId: 'solo-foreign-other-host', confirm: true },
  });
  assert(badLink.res.status === 403, `mismatch link status ${badLink.res.status}`);
  assert(badLink.json?.error === 'ACCOUNT_LINK_MISMATCH', `mismatch code: ${badLink.json?.error}`);
  assert(badLink.json?.linked === false, 'mismatch not linked');

  const noConfirm = await httpJson(baseURL, '/api/solo/link-account', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
    body: { soloActorId: actorId1, confirm: false },
  });
  assert(noConfirm.res.status === 400, 'confirm required');
  assert(noConfirm.json?.error === 'INVALID_LINK_REQUEST', 'confirm code');

  const goodLink = await httpJson(baseURL, '/api/solo/link-account', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
    body: { soloActorId: actorId1, confirm: true },
  });
  assert(goodLink.res.status === 200, `link status ${goodLink.res.status} ${goodLink.text}`);
  assert(goodLink.json?.linked === true, 'linked true');
  assert(existsSync(join(remoteDir, solo.SOLO_ACCOUNT_LINKS_FILENAME)), 'link store written');

  // Second remote account cannot steal the same solo link (one remote per solo id).
  const email2 = 'other@example.test';
  const password2 = `Pw-${randomBytes(12).toString('base64url')}`;
  const signUp2 = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email: email2, password: password2, name: 'Other Remote' },
  });
  assert(signUp2.res.status < 400, `sign-up2 ${signUp2.res.status}`);
  let cookie2 = signUp2.cookie;
  if (!cookie2) {
    const signIn2 = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email: email2, password: password2 },
    });
    cookie2 = signIn2.cookie;
  }
  const takenLink = await httpJson(baseURL, '/api/solo/link-account', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie: cookie2,
    body: { soloActorId: actorId1, confirm: true },
  });
  assert(takenLink.res.status === 403, `taken link status ${takenLink.res.status}`);
  assert(takenLink.json?.error === 'ACCOUNT_LINK_TAKEN', `taken code: ${takenLink.json?.error}`);
  assert(takenLink.json?.linked === false, 'taken not linked');

  const touchAfterLink = await httpJson(baseURL, '/api/world-touch', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
    body: { worldId: 'world-solo' },
  });
  assert(touchAfterLink.res.status === 200, `after link ${touchAfterLink.res.status} ${touchAfterLink.text}`);
  assert(touchAfterLink.json?.mutated === true, 'mutation after explicit link');
  assert(existsSync(join(remoteDir, 'world-touch.jsonl')), 'world-touch after link');

  // Host identity file unchanged by link (no foreign identity adoption).
  const stillSame = JSON.parse(readFileSync(join(remoteDir, solo.HOST_IDENTITY_FILENAME), 'utf8')).actorId;
  assert(stillSame === actorId1, 'host identity not rewritten by link');

  // --- P1: remote /v1/ping must not mutate under solo identity without auth ---
  const pingPath = join(remoteDir, 'ping-log.jsonl');
  const pingBefore = existsSync(pingPath) ? readFileSync(pingPath, 'utf8') : '';
  const unauthPing = await httpJson(baseURL, '/v1/ping', {
    method: 'POST',
    headers: { Origin: baseURL },
  });
  assert(
    unauthPing.res.status === 401 || unauthPing.res.status === 403,
    `unauth remote ping denied: ${unauthPing.res.status}`,
  );
  assert(unauthPing.json?.mutated !== true, 'unauth ping must not report mutation');
  const pingAfterUnauth = existsSync(pingPath) ? readFileSync(pingPath, 'utf8') : '';
  assert(pingAfterUnauth === pingBefore, 'ping-log unchanged without session');

  const forgedPing = await httpJson(baseURL, '/v1/ping', {
    method: 'POST',
    headers: { Origin: baseURL, 'x-solo-user': 'local-owner' },
  });
  assert(
    forgedPing.res.status === 401 || forgedPing.res.status === 403,
    `forged solo ping denied: ${forgedPing.res.status}`,
  );
  assert(forgedPing.json?.error === 'SOLO_IDENTITY_FORBIDDEN', `forged ping code: ${forgedPing.json?.error}`);
  const pingAfterForged = existsSync(pingPath) ? readFileSync(pingPath, 'utf8') : '';
  assert(pingAfterForged === pingBefore, 'ping-log unchanged with forged solo header');

  const authPing = await httpJson(baseURL, '/v1/ping', {
    method: 'POST',
    headers: { Origin: baseURL },
    cookie,
  });
  assert(authPing.res.status === 200, `auth remote ping ${authPing.res.status} ${authPing.text}`);
  assert(existsSync(pingPath), 'ping-log written after authenticated ping');

  // --- P2: account-link store is atomic (temp+rename); readable after write ---
  const linkPath = join(remoteDir, solo.SOLO_ACCOUNT_LINKS_FILENAME);
  assert(existsSync(linkPath), 'link store exists');
  const linkRaw = readFileSync(linkPath, 'utf8');
  const linkParsed = JSON.parse(linkRaw);
  assert(linkParsed.version === 1 && Array.isArray(linkParsed.links), 'link store well-formed');
  assert(linkParsed.links.some((l) => l.soloActorId === actorId1), 'link entry present');
  // No leftover temp files from atomic writer.
  const { readdirSync } = await import('node:fs');
  const leftovers = readdirSync(remoteDir).filter((name) => name.includes('.tmp'));
  assert(leftovers.length === 0, `no tmp leftovers: ${leftovers.join(',')}`);

  await remote.stop();

  console.log('PASS: mig-015 solo local identity without privilege transfer');
} finally {
  rmSync(work, { recursive: true, force: true });
}
