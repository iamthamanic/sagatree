#!/usr/bin/env node
/**
 * mig-424-world-quarantine.self-test — preserve 404; isolate fixtures (#840).
 * Location: scripts/mig-424-world-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const {
  WORLD_EDGE_MAP_IS_DURABLE,
  WORLD_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  addQuarantineEvent,
  addQuarantineFaction,
  addQuarantineLocation,
  advanceQuarantineTime,
  bodyFieldsAreNotAuthority,
  createQuarantineWorld,
  createWorldEdgeQuarantineStore,
  describeWorldEdgeLegacyDefects,
  discoverQuarantineLocation,
  getQuarantineEvents,
  getQuarantineWorld,
  getQuarantineWorldByProject,
  randomQuarantineWeather,
  updateQuarantineFactionRelationship,
  updateQuarantineWorld,
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

assert(WORLD_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(WORLD_EDGE_MAP_IS_DURABLE === false, 'Map not durable');
assert(isEdgeDispatcherAllowed('world') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('world'), 'not in allowlist');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/functions\/v1\/world/i.test(createApp), 'create-app has no Edge functions/v1/world mount');
assert(
  !/app\.(get|post|put|delete|all)\(\s*['"`]\/worlds/i.test(createApp),
  'create-app has no bare /worlds Edge mount',
);
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(
  !/functions\/v1\/world|(?:^|[^a-z])\/worlds(?:\/|['"`])/im.test(routeRegistry),
  'route-registry has no Edge /worlds mount',
);

// Fall 1: world routes remain dispatcher/host 404 (settings + clock writes included)
await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/world',
    '/worlds',
    '/worlds/w1',
    '/worlds/project/p1',
    '/worlds/w1/locations',
    '/worlds/w1/locations/l1/discover',
    '/worlds/w1/events',
    '/worlds/w1/factions',
    '/worlds/w1/factions/f1/relationship',
    '/worlds/w1/time/advance',
    '/worlds/w1/weather',
    '/worlds/w1/weather/random',
    '/functions/v1/world',
    '/functions/v1/world/health',
    '/functions/v1/world/worlds',
    '/functions/v1/world/worlds/w1/time/advance',
    '/functions/v1/world/worlds/w1/weather',
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

const now = '2026-01-01T00:00:00.000Z';

// Fall 2: create defaults, discovery, event filter, faction relationship, 30-day rollover
{
  const store = createWorldEdgeQuarantineStore();
  const w = createQuarantineWorld(store, { projectId: 'p1', name: 'Aether' }, now, 'world-1');
  assert(w.settings.ruleset === 'dnd5e' && w.settings.technology === 'medieval', 'settings defaults');
  assert(w.settings.magic === 'medium' && w.settings.tone === 'serious', 'magic/tone defaults');
  assert(w.settings.startingLevel === 1 && w.settings.maxLevel === 20, 'level defaults');
  assert(w.time.hour === 8 && w.time.calendar === 'Gregorian' && w.time.day === 1, 'time defaults');
  assert(w.weather.current === 'clear' && w.weather.temperature === 20, 'weather defaults');
  assert(getQuarantineWorldByProject(store, 'p1')?.id === 'world-1', 'lookup by project');

  const other = createWorldEdgeQuarantineStore();
  assert(other.worlds.size === 0, 'cross-store Map empty');

  const loc = addQuarantineLocation(
    store,
    'world-1',
    {
      name: 'Gate',
      type: 'town',
      connections: [],
      npcs: [],
      items: [],
    },
    now,
    'loc-1',
  );
  assert(loc.discovered === false, 'discovered default false');
  discoverQuarantineLocation(store, 'world-1', 'loc-1', now);
  assert(getQuarantineWorld(store, 'world-1').locations[0].discovered === true, 'discover flips');

  addQuarantineEvent(
    store,
    'world-1',
    {
      name: 'Raid',
      type: 'plot',
      timestamp: now,
      participants: [],
      consequences: [],
    },
    now,
    'ev-plot',
  );
  addQuarantineEvent(
    store,
    'world-1',
    {
      name: 'Storm',
      type: 'random',
      timestamp: now,
      participants: [],
      consequences: [],
    },
    now,
    'ev-rand',
  );
  const plots = getQuarantineEvents(store, 'world-1', 'plot');
  assert(plots.length === 1 && plots[0].id === 'ev-plot', 'event type filter');

  addQuarantineFaction(
    store,
    'world-1',
    {
      name: 'Crown',
      type: 'kingdom',
      members: [],
      relationships: {},
      goals: [],
    },
    now,
    'fac-a',
  );
  addQuarantineFaction(
    store,
    'world-1',
    {
      name: 'Guild',
      type: 'guild',
      members: [],
      relationships: {},
      goals: [],
    },
    now,
    'fac-b',
  );
  const linked = updateQuarantineFactionRelationship(
    store,
    'world-1',
    'fac-a',
    'fac-b',
    'hostile',
    now,
  );
  assert(linked.relationships['fac-b'] === 'hostile', 'faction relationship');

  // 16h from hour 8 → day+1 hour 0; +29*24h from day 2 → day 31 → month rollover (30-day months)
  let t = advanceQuarantineTime(store, 'world-1', 16, now);
  assert(t.day === 2 && t.hour === 0 && t.current === 16, 'day advance from hours');
  t = advanceQuarantineTime(store, 'world-1', 29 * 24, now);
  assert(t.month === 2 && t.day === 1 && t.hour === 0, '30-day month rollover');
  // falsy hours → 1 (Edge `hours || 1`)
  t = advanceQuarantineTime(store, 'world-1', 0, now);
  assert(t.current === 16 + 29 * 24 + 1 && t.hour === 1, 'hours||1 default');
}

// Fall 3: replacements must bound hours; durable world ports stay separate
{
  const store = createWorldEdgeQuarantineStore();
  createQuarantineWorld(store, { projectId: 'p2', name: 'Bound' }, now, 'w-bound');
  // Legacy leaves nonfinite/huge unbounded — characterize that defect, do not "fix" here.
  const huge = advanceQuarantineTime(store, 'w-bound', 1e6, now);
  assert(Number.isFinite(huge.current) && huge.current === 1e6, 'legacy accepts huge hours');

  const authority = bodyFieldsAreNotAuthority();
  assert(authority.some((d) => /ownership|authority/i.test(d)), 'body not authority');

  const writeStore = readFileSync(
    join(root, 'server/src/modules/world/internal/world-write-store.ts'),
    'utf8',
  );
  assert(
    !/world-edge-quarantine|WorldEdgeQuarantine|createWorldEdgeQuarantineStore/.test(writeStore),
    'durable world write store does not call Edge world quarantine',
  );
  const atlas = readFileSync(join(root, 'server/src/modules/world/internal/world-atlas-store.ts'), 'utf8');
  assert(
    !/world-edge-quarantine|WorldEdgeQuarantine|createWorldEdgeQuarantineStore/.test(atlas),
    'atlas store does not call Edge world quarantine',
  );

  // Injected RNG: temperature floor(r*40)-10 with r→0.999 → 29
  let calls = 0;
  const rng = () => {
    calls += 1;
    return 0.999;
  };
  const wx = randomQuarantineWeather(store, 'w-bound', now, rng);
  assert(wx.temperature === 29, 'random weather temp upper pin');
  assert(calls >= 4, 'rng used for weather fields');
}

// Fall 4: legacy defects + shallow update without auth
{
  const store = createWorldEdgeQuarantineStore();
  createQuarantineWorld(store, { projectId: 'p3', name: 'Shallow' }, now, 'w-sh');
  const updated = updateQuarantineWorld(
    store,
    'w-sh',
    { name: 'Renamed', quests: ['q1'] },
    '2026-01-02T00:00:00.000Z',
  );
  assert(updated.name === 'Renamed' && updated.quests[0] === 'q1', 'shallow update allowed');
  assert(updated.updatedAt === '2026-01-02T00:00:00.000Z', 'updatedAt bumped');

  const defects = describeWorldEdgeLegacyDefects();
  assert(defects.some((d) => /authentication|ownership/i.test(d)), 'auth defect');
  assert(defects.some((d) => /30-day|Gregorian/i.test(d)), 'calendar defect');
  assert(defects.some((d) => /durable|Map/i.test(d)), 'durability defect');
  assert(defects.some((d) => /bounded|hours/i.test(d)), 'hours bound defect');
}

console.log('PASS mig-424-world-quarantine.self-test');
