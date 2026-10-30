#!/usr/bin/env node
/**
 * mig-414-edge-main.self-test — host isolated-contract for Edge main (#830).
 * Location: scripts/mig-414-edge-main.self-test.mjs
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signHs256(payload, secret, alg = 'HS256') {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const [dispatcher, app, allow] = await Promise.all([
  import(pathToFileURL(join(root, 'server/src/http/edge-main-dispatcher.ts')).href),
  import(pathToFileURL(join(root, 'server/src/application/edge-main/index.ts')).href),
  import(
    pathToFileURL(
      join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
    ).href
  ),
]);

const {
  EDGE_MAIN_DISPATCHER_STATUS,
  EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED,
  EDGE_MAIN_WORKER_MEMORY_LIMIT_MB,
  EDGE_MAIN_WORKER_TIMEOUT_MS,
  HOST_EDGE_DISPATCHER_ALLOWLIST,
  describeEdgeMainLegacyDefects,
  dispatchEdgeMainRequest,
  evaluatePostDispatcherWorkerAuth,
  isHostEdgeDispatcherAllowed,
  isJwtVerificationEnabled,
  resolveEdgeMainServiceName,
  toEdgeMainWorkerPathname,
} = dispatcher;
const { createEdgeMainUseCases } = app;
const { EDGE_DISPATCHER_ALLOWLIST, isEdgeDispatcherAllowed } = allow;

assert(EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(EDGE_MAIN_DISPATCHER_STATUS.publicActivationAuthorized === false, 'status flag');
assert(EDGE_MAIN_DISPATCHER_STATUS.dispatcherAllowed === false, 'dispatcherAllowed false');
assert(EDGE_MAIN_WORKER_MEMORY_LIMIT_MB === 512, '512MiB');
assert(EDGE_MAIN_WORKER_TIMEOUT_MS === 300_000, '300s timeout');
assert(
  JSON.stringify([...HOST_EDGE_DISPATCHER_ALLOWLIST]) ===
    JSON.stringify([...EDGE_DISPATCHER_ALLOWLIST]),
  'host allowlist mirrors Edge allowlist',
);

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/functions\/v1\/main|edge-main-dispatcher/i.test(createApp), 'no create-app cutover mount');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(/edge-main-dispatcher/.test(routeRegistry), 'route-registry re-exports dispatcher');
assert(!/app\.(get|post|all)\(\s*['"`]\/functions\/v1/i.test(createApp), 'no /functions/v1 mount');

const UNMOUNTED = [
  'ai-gm',
  'bestiary',
  'characters',
  'dm-tools',
  'export',
  'items',
  'lorekeeper',
  'marketplace',
  'media',
  'npcs',
  'quests',
  'rulesets',
  'sessions',
  'spellbook',
  'world',
];
assert(UNMOUNTED.length === 15, '15 unmounted workers');

const SECRET = 'mig-414-test-secret';
const env = {
  get(key) {
    if (key === 'JWT_SECRET') return SECRET;
    if (key === 'VERIFY_JWT') return undefined;
    return undefined;
  },
};

// Fall 1: unmounted + main + _shared + unknown + traversal → 404 before JWT
for (const method of ['GET', 'POST', 'OPTIONS']) {
  for (const name of [...UNMOUNTED, 'main', '_shared', 'unknown', '../etc/passwd', 'x/../y']) {
    for (const pathname of [`/${name}`, `/functions/v1/${name}`, `/functions/v1/${name}/suffix`]) {
      const result = await dispatchEdgeMainRequest({
        method,
        pathname,
        authorization: null,
        env,
      });
      assert(result.ok === false && result.status === 404, `${method} ${pathname} → 404`);
      assert(result.body.error === 'Not found', `${pathname} body`);
      assert(isHostEdgeDispatcherAllowed(name) === false, `host deny ${name}`);
      if (!name.includes('..')) {
        assert(isEdgeDispatcherAllowed(name) === false, `edge deny ${name}`);
      }
    }
  }
}

// Fall 2: both URL prefixes reach same allowlisted worker with intact suffix/query/method/body
const token = signHs256({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
const forwardBody = { ping: 'mig-414', n: 1 };
for (const name of HOST_EDGE_DISPATCHER_ALLOWLIST) {
  const a = await dispatchEdgeMainRequest({
    method: 'PUT',
    pathname: `/functions/v1/${name}/nested/path`,
    search: '?keep=1&x=y',
    body: forwardBody,
    authorization: `Bearer ${token}`,
    env,
  });
  const b = await dispatchEdgeMainRequest({
    method: 'PUT',
    pathname: `/${name}/nested/path`,
    search: '?keep=1&x=y',
    body: forwardBody,
    authorization: `Bearer ${token}`,
    env,
  });
  assert(a.ok && b.ok, `${name} both prefixes ok`);
  assert(a.serviceName === name && b.serviceName === name, `${name} service`);
  assert(
    a.workerPathname === `/functions/v1/${name}/nested/path` &&
      b.workerPathname === `/functions/v1/${name}/nested/path`,
    `${name} suffix preserved`,
  );
  assert(a.method === 'PUT' && b.method === 'PUT', `${name} method forwarded`);
  assert(a.search === '?keep=1&x=y' && b.search === '?keep=1&x=y', `${name} query forwarded`);
  assert(
    a.workerRequestPath === `/functions/v1/${name}/nested/path?keep=1&x=y` &&
      b.workerRequestPath === `/functions/v1/${name}/nested/path?keep=1&x=y`,
    `${name} workerRequestPath keeps query`,
  );
  assert(a.bodyForwarded === true && b.bodyForwarded === true, `${name} body forwarded`);
  assert(a.wouldCreateWorker === false && b.wouldCreateWorker === false, 'no worker create');
  assert(a.memoryLimitMb === 512 && a.workerTimeoutMs === 300_000, 'resource limits');
}

assert(resolveEdgeMainServiceName('/functions/v1/session-recap/x') === 'session-recap');
assert(resolveEdgeMainServiceName('/session-recap/x') === 'session-recap');
assert(toEdgeMainWorkerPathname('/session-recap/a', 'session-recap') === '/functions/v1/session-recap/a');
assert(resolveEdgeMainServiceName('/') === null);

// Fall 3: JWT gate
{
  const missing = await dispatchEdgeMainRequest({
    method: 'POST',
    pathname: '/functions/v1/session-recap',
    authorization: null,
    env,
  });
  assert(missing.status === 401 && /missing Authorization/.test(missing.body.error), 'missing bearer');

  const wrong = await dispatchEdgeMainRequest({
    method: 'POST',
    pathname: '/functions/v1/session-recap',
    authorization: `Bearer ${signHs256({ exp: Math.floor(Date.now() / 1000) + 60 }, 'other')}`,
    env,
  });
  assert(wrong.status === 401 && wrong.body.error === 'invalid jwt', 'wrong secret');

  const expired = await dispatchEdgeMainRequest({
    method: 'POST',
    pathname: '/functions/v1/session-recap',
    authorization: `Bearer ${signHs256({ exp: Math.floor(Date.now() / 1000) - 10 }, SECRET)}`,
    env,
  });
  assert(expired.status === 401 && expired.body.error === 'jwt expired', 'expired');

  const hs512Header = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
  const hs512Body = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 })).toString(
    'base64url',
  );
  const hs512 = `${hs512Header}.${hs512Body}.fakesig`;
  const unsupported = await dispatchEdgeMainRequest({
    method: 'POST',
    pathname: '/functions/v1/session-recap',
    authorization: `Bearer ${hs512}`,
    env,
  });
  assert(
    unsupported.status === 401 && unsupported.body.error === 'unsupported jwt algorithm',
    'HS512 denied',
  );

  const noSecret = await dispatchEdgeMainRequest({
    method: 'POST',
    pathname: '/functions/v1/session-recap',
    authorization: `Bearer ${token}`,
    env: { get: () => undefined },
  });
  assert(noSecret.status === 500 && /JWT_SECRET/.test(noSecret.body.error), 'missing JWT_SECRET → 500');

  assert(isJwtVerificationEnabled({ get: () => undefined }) === true, 'JWT default on');
  assert(isJwtVerificationEnabled({ get: (k) => (k === 'VERIFY_JWT' ? 'false' : undefined) }) === false);

  const optionsOpen = await dispatchEdgeMainRequest({
    method: 'OPTIONS',
    pathname: '/functions/v1/session-recap',
    authorization: null,
    env,
  });
  assert(optionsOpen.ok === true, 'OPTIONS forwards past JWT for allowlisted');
}

// Fall 4: JWT gate acceptance alone never grants end-user authorization
{
  const anonPayload = { role: 'anon', roleClaim: 'service_role' };
  const servicePayload = { role: 'service_role' };
  const anon = signHs256(anonPayload, SECRET);
  const service = signHs256(servicePayload, SECRET);
  for (const [jwt, payload] of [
    [anon, anonPayload],
    [service, servicePayload],
  ]) {
    const result = await dispatchEdgeMainRequest({
      method: 'POST',
      pathname: '/functions/v1/character-lore',
      authorization: `Bearer ${jwt}`,
      env,
    });
    assert(result.ok === true, 'dispatcher JWT ok');
    assert(result.wouldCreateWorker === false, 'worker auth still required / no create');
    const worker = evaluatePostDispatcherWorkerAuth({ jwtPayload: payload });
    assert(worker.ok === false && worker.status === 403, 'worker denies anon/service_role');
  }
  const missingSub = evaluatePostDispatcherWorkerAuth({
    jwtPayload: { role: 'authenticated' },
  });
  assert(missingSub.ok === false && missingSub.status === 401, 'worker requires sub');
  const owner = evaluatePostDispatcherWorkerAuth({
    jwtPayload: { role: 'authenticated', sub: 'user-owner-1' },
  });
  assert(owner.ok === true && owner.userId === 'user-owner-1', 'worker accepts end-user sub');
  for (const role of ['Service_Role', 'ANON', 'authenticated-admin', '']) {
    const bypass = evaluatePostDispatcherWorkerAuth({
      jwtPayload: { role, sub: 'user-owner-1' },
    });
    assert(bypass.ok === false && bypass.status === 403, `allowlist denies role=${role || '(empty)'}`);
  }
}

// Fall 5 + legacy regression: resource limits + raw 500 message
{
  assert(EDGE_MAIN_WORKER_MEMORY_LIMIT_MB === 512);
  assert(EDGE_MAIN_WORKER_TIMEOUT_MS === 5 * 60 * 1000);
  const defects = describeEdgeMainLegacyDefects();
  assert(
    defects.some((d) => /not complete JWT claims/i.test(d) && /Raw exception/i.test(d)),
    'legacy defect recorded',
  );
}

// Use-case surface
{
  const uc = createEdgeMainUseCases({
    env: {
      get(key) {
        if (key === 'JWT_SECRET') return SECRET;
        return undefined;
      },
    },
  });
  assert(uc.publicActivationAuthorized === false);
  const denied = await uc.dispatch({ method: 'GET', pathname: '/sessions' });
  assert(denied.status === 404);
  const ok = await uc.dispatch({
    method: 'POST',
    pathname: '/functions/v1/session-media-token',
    authorization: `Bearer ${token}`,
  });
  assert(ok.ok && ok.wouldCreateWorker === false);
}

console.log('PASS: mig-414-edge-main.self-test');
