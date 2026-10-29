#!/usr/bin/env node
/**
 * mig-422-sessions-quarantine.self-test — preserve 404; isolate fixtures (#838).
 * Location: scripts/mig-422-sessions-quarantine.self-test.mjs
 */
import { createServer } from 'node:http';
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const {
  SESSIONS_EDGE_MAP_IS_DURABLE,
  SESSIONS_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  bodyFieldsAreNotAuthority,
  createQuarantineSavePoint,
  createQuarantineSession,
  createSessionsEdgeQuarantineStore,
  describeSessionsEdgeLegacyDefects,
  endQuarantineSession,
  getQuarantineChatHistory,
  getQuarantineSessionLogs,
  loadQuarantineSavePoint,
  pauseQuarantineSession,
  sendQuarantineChat,
  startQuarantineSession,
} = await import(modUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);
const { createRouteHandler } = await import(
  pathToFileURL(join(root, 'server/src/http/route-registry.ts')).href
);

function stubDeps(extra = {}) {
  return {
    health: { execute: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }) },
    ops: {
      getHealth: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }),
      acceptMutations: () => true,
    },
    permissions: { authorize: () => ({ allow: true, reason: 'test' }) },
    identity: {
      resolveSoloActor: () => ({ kind: 'solo-local', actorId: 'test' }),
      resolveRemoteSession: async () => ({ ok: false, code: 'AUTH_NOT_CONFIGURED' }),
      linkSoloToRemoteAccount: () => ({ ok: false, code: 'INVALID_LINK_REQUEST' }),
    },
    transport: {
      applyCommand: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
      getSnapshot: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
    },
    recordPing: () => ({ ok: true }),
    authHandlerRef: { current: null },
    tryAuthorizedProjectTouch: () => ({ ok: false, status: 403, error: 'test' }),
    tryAuthorizedWorldTouch: () => ({ ok: false, status: 403, error: 'test' }),
    ...extra,
  };
}

async function withHandler(deps, fn) {
  const handler = createRouteHandler(deps);
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res));
  });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve).on('error', reject);
  });
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

assert(SESSIONS_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(SESSIONS_EDGE_MAP_IS_DURABLE === false, 'Map not durable');
assert(isEdgeDispatcherAllowed('sessions') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('sessions'), 'not in allowlist');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
// Host may expose /api/v1/sessions/* (RPC runtime) — Edge worker paths must stay unmounted.
assert(!/functions\/v1\/sessions/i.test(createApp), 'create-app has no Edge functions/v1/sessions mount');
assert(
  !/app\.(get|post|put|delete|all)\(\s*['"`]\/sessions/i.test(createApp),
  'create-app has no bare /sessions Edge mount',
);
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(
  !/functions\/v1\/sessions|(?:^|[^/v1])\/sessions(?:\/|['"`])/m.test(routeRegistry),
  'route-registry has no Edge sessions mount',
);

// Fall 1: all sessions methods remain dispatcher/host 404
await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/sessions',
    '/sessions/x',
    '/sessions/x/start',
    '/sessions/x/pause',
    '/sessions/x/end',
    '/sessions/x/world-state',
    '/sessions/x/save',
    '/sessions/x/chat',
    '/sessions/import',
    '/functions/v1/sessions',
    '/functions/v1/sessions/x/world-state',
    '/functions/v1/sessions/import',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers:
          method === 'POST' || method === 'PUT' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' || method === 'PUT' ? JSON.stringify({}) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// Fall 2: isolated Map numbering / lifecycle / chat limits / save-load shapes
{
  const store = createSessionsEdgeQuarantineStore();
  const now = '2026-01-01T00:00:00.000Z';
  const a = createQuarantineSession(
    store,
    { projectId: 'p1', name: 'Ep1', worldState: { location: 'Town' } },
    now,
  );
  const b = createQuarantineSession(store, { projectId: 'p1', name: 'Ep2' }, now);
  assert(a.sessionNumber === 1 && b.sessionNumber === 2, 'per-project numbering');
  assert(a.status === 'scheduled' && a.worldState.location === 'Town', 'defaults');
  assert(a.worldState.time === 'Morning', 'default time Morning');
  assert(Array.isArray(a.worldState.activeQuests), 'empty quests array');

  const other = createSessionsEdgeQuarantineStore();
  assert(other.sessions.size === 0, 'another process/store loses Map records');

  let s = startQuarantineSession(store, a.id, '2026-01-01T01:00:00.000Z');
  assert(s.status === 'active' && s.startedAt, 'start → active');
  assert(getQuarantineSessionLogs(store, a.id).length === 1, 'start appends log');
  s = pauseQuarantineSession(store, a.id, '2026-01-01T02:00:00.000Z');
  assert(s.status === 'paused', 'pause');
  s = endQuarantineSession(store, a.id, '2026-01-01T03:00:00.000Z');
  assert(s.status === 'completed' && s.endedAt, 'end → completed');
  assert(getQuarantineSessionLogs(store, a.id).length === 2, 'end appends log');
  assert(getQuarantineSessionLogs(store, a.id, 0).length === 0, 'logs limit 0 → empty');
  assert(getQuarantineSessionLogs(store, a.id, -1).length === 0, 'logs limit <0 → empty');

  let threw = false;
  try {
    createQuarantineSession(store, { projectId: 'p1', name: 'Dup' }, now, a.id);
  } catch (e) {
    threw = e instanceof Error && e.message === 'Session already exists';
  }
  assert(threw, 'duplicate session id rejected');

  threw = false;
  try {
    sendQuarantineChat(
      store,
      'missing-sess',
      { userId: 'u1', message: 'x', type: 'player' },
      now,
    );
  } catch (e) {
    threw = e instanceof Error && e.message === 'Session not found';
  }
  assert(threw, 'chat on missing session rejected');

  const sharedWs = { activeQuests: ['q1'], inventory: ['sword'] };
  const c1 = createQuarantineSession(
    store,
    { projectId: 'p2', name: 'Share1', worldState: sharedWs },
    now,
  );
  const c2 = createQuarantineSession(
    store,
    { projectId: 'p2', name: 'Share2', worldState: sharedWs },
    now,
  );
  c1.worldState.activeQuests.push('q2');
  assert(c2.worldState.activeQuests.length === 1, 'worldState containers not shared');

  for (let i = 0; i < 105; i += 1) {
    sendQuarantineChat(
      store,
      a.id,
      { userId: 'u1', message: `m${i}`, type: 'player' },
      `2026-01-01T04:00:${String(i % 60).padStart(2, '0')}.000Z`,
    );
  }
  const hist = getQuarantineChatHistory(store, a.id, 100);
  assert(hist.length === 100, 'chat history default limit 100');
  assert(hist[0].message === 'm5' && hist[99].message === 'm104', 'slice last 100');
  assert(getQuarantineChatHistory(store, a.id, 0).length === 0, 'chat limit 0 → empty');

  // restore world for save fixture
  store.sessions.set(a.id, {
    ...store.sessions.get(a.id),
    worldState: { ...store.sessions.get(a.id).worldState, location: 'Dungeon' },
  });
  const save = createQuarantineSavePoint(
    store,
    a.id,
    {
      name: 'Boss door',
      playerStates: [
        {
          userId: 'u1',
          characterId: 'c1',
          characterName: 'Aria',
          hp: 10,
          maxHp: 12,
          spellSlots: {},
          conditions: [],
          inventory: [],
          experience: 0,
        },
      ],
    },
    '2026-01-01T05:00:00.000Z',
  );
  assert(save.worldState.location === 'Dungeon', 'save clones worldState');
  assert(save.playerStates[0].characterName === 'Aria', 'save playerStates shape');
  assert(
    store.sessions.get(a.id).updatedAt === '2026-01-01T03:00:00.000Z',
    'createSavePoint does not bump updatedAt (Edge parity)',
  );

  store.sessions.set(a.id, {
    ...store.sessions.get(a.id),
    worldState: { ...store.sessions.get(a.id).worldState, location: 'Elsewhere' },
  });
  const loaded = loadQuarantineSavePoint(
    store,
    a.id,
    save.id,
    '2026-01-01T06:00:00.000Z',
  );
  assert(loaded.worldState.location === 'Dungeon', 'load restores worldState');
  assert(store.sessions.get(a.id).worldState.location === 'Dungeon', 'session overwritten');
}

// Fall 3: body userId/type:dm/worldState are not authority; host RPCs must not call this worker
{
  const authority = bodyFieldsAreNotAuthority();
  assert(authority.some((d) => /userId/i.test(d)), 'userId not auth');
  assert(authority.some((d) => /dm/i.test(d)), 'type:dm not auth');
  assert(authority.some((d) => /worldState/i.test(d)), 'worldState not membership');

  const createPlay = readFileSync(
    join(root, 'server/src/application/session-lifecycle/create_play_session/index.ts'),
    'utf8',
  );
  const applyRuntime = readFileSync(
    join(root, 'server/src/application/session-runtime/apply_session_runtime_command/index.ts'),
    'utf8',
  );
  assert(
    !/sessions-edge-quarantine|SessionsEdgeQuarantine|createQuarantineSession/.test(createPlay),
    'create_play_session does not call Edge sessions quarantine',
  );
  assert(
    !/sessions-edge-quarantine|SessionsEdgeQuarantine|createQuarantineSession/.test(applyRuntime),
    'apply_session_runtime_command does not call Edge sessions quarantine',
  );
}

// Fall 4: legacy defects documented
{
  const defects = describeSessionsEdgeLegacyDefects();
  assert(defects.some((d) => /membership|GM|owner/i.test(d)), 'auth defect listed');
  assert(defects.some((d) => /durable|concurrent|Map/i.test(d)), 'durability defect listed');
}

console.log('PASS mig-422-sessions-quarantine.self-test');
