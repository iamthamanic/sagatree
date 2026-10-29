#!/usr/bin/env node
/**
 * mig-418-quests-quarantine.self-test — preserve 404; isolate fixtures (#834).
 * Location: scripts/mig-418-quests-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/saga/index.ts')).href;
const {
  QUESTS_MAP_GRANTS_REWARDS,
  QUESTS_PUBLIC_ACTIVATION_AUTHORIZED,
  applyQuestDefaults,
  completeObjective,
  createSeededRng,
  describeQuestsLegacyDefects,
  filterQuests,
  generateQuest,
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

assert(QUESTS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('quests') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('quests'), 'not in allowlist');
const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/\/quests|functions\/v1\/quests/i.test(createApp), 'create-app has no quests mount');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/\/quests|functions\/v1\/quests/.test(routeRegistry), 'route-registry has no quests mount');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/quests',
    '/quests/generate',
    '/quests/x',
    '/quests/x/complete/y',
    '/functions/v1/quests',
    '/functions/v1/quests/generate',
    '/functions/v1/quests/x/complete/y',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'OPTIONS']) {
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

const now = '2026-01-01T00:00:00.000Z';
const defaults = applyQuestDefaults({}, 'q1', now);
assert(defaults.name === 'Unknown Quest' && defaults.type === 'side', 'defaults');
assert(defaults.status === 'available' && defaults.projectId === '', 'empty projectId default');
assert(defaults.objectives.length === 0 && defaults.rewards.length === 0, 'empty arrays');

const withObjs = applyQuestDefaults(
  {
    projectId: 'p1',
    objectives: [
      { id: 'obj-0', description: 'A', completed: false },
      { id: 'obj-1', description: 'B', completed: false },
    ],
    rewards: [{ type: 'xp', amount: 50 }],
  },
  'q2',
  now,
);
const miss = completeObjective(withObjs, 'missing', '2026-01-01T01:00:00.000Z');
assert(miss === withObjs || miss.updatedAt === withObjs.updatedAt, 'missing objective no-op identity');
assert(miss.status === 'available' && miss.objectives.every((o) => !o.completed), 'missing no-op state');

const one = completeObjective(withObjs, 'obj-0', '2026-01-01T02:00:00.000Z');
assert(one.objectives[0].completed === true && one.objectives[1].completed === false, 'partial complete');
assert(one.status === 'available', 'not completed until all');
const all = completeObjective(one, 'obj-1', '2026-01-01T03:00:00.000Z');
assert(all.status === 'completed' && all.objectives.every((o) => o.completed), 'final completes quest');
assert(QUESTS_MAP_GRANTS_REWARDS === false, 'completion does not grant rewards');
assert(all.rewards[0].amount === 50, 'reward payload unchanged (not granted)');

const listed = filterQuests([defaults, withObjs], { projectId: 'p1' });
assert(listed.length === 1 && listed[0].id === 'q2', 'projectId filter');

const gen = generateQuest('side', 3, 'g1', now, createSeededRng(1));
assert(gen.projectId === '', 'generated empty projectId');
assert(gen.rewards.some((r) => r.type === 'xp' && r.amount === 300), 'xp = level*100');
assert(gen.rewards.some((r) => r.type === 'gold' && r.amount === 30), 'gold = level*10');
assert(gen.objectives.every((o) => String(o.id).startsWith('obj-')), 'obj-index ids');

const unknown = generateQuest('constructor', 1, 'g2', now, createSeededRng(2));
assert(unknown.type === 'side', 'unknown type falls back to side (successor must validate)');
const neg = generateQuest('side', -2, 'g3', now, createSeededRng(3));
assert(neg.rewards.some((r) => r.type === 'xp' && r.amount === -200), 'legacy allows negative level math');
assert(
  QUESTS_PUBLIC_ACTIVATION_AUTHORIZED === false,
  'invalid level/type must not ship without successor validation',
);

const defects = describeQuestsLegacyDefects();
assert(defects.some((d) => /reward|XP/i.test(d)), 'reward defect listed');
assert(defects.some((d) => /projectId/i.test(d)), 'projectId defect listed');

console.log('PASS mig-418-quests-quarantine.self-test');
