#!/usr/bin/env node
/**
 * mig-413-lorekeeper-quarantine.self-test — preserve 404; isolate fixtures (#829).
 * Location: scripts/mig-413-lorekeeper-quarantine.self-test.mjs
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
  LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED,
  createLoreGraphStore,
  createRelationship,
  getNPCContext,
  getSessionContext,
  getWorldGraph,
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

const now = '2026-01-01T00:00:00.000Z';

function node(id, type, name) {
  return {
    id,
    type,
    name,
    properties: {},
    createdAt: now,
    updatedAt: now,
  };
}

// --- Fall 1: dispatcher + host keep lorekeeper unmounted ---
assert(LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');
assert(isEdgeDispatcherAllowed('lorekeeper') === false, 'isEdgeDispatcherAllowed(lorekeeper) false');
assert(
  !EDGE_DISPATCHER_ALLOWLIST.includes('lorekeeper'),
  'lorekeeper absent from EDGE_DISPATCHER_ALLOWLIST values',
);

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/lorekeeper/i.test(createApp), 'create-app has no lorekeeper route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/lorekeeper/i.test(routeRegistry), 'route-registry has no lorekeeper route');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/lorekeeper',
    '/lorekeeper/graph',
    '/lorekeeper/context',
    '/lorekeeper/npc',
    '/lorekeeper/consistency',
    '/functions/v1/lorekeeper',
    '/functions/v1/lorekeeper/graph',
    '/functions/v1/lorekeeper/context',
    '/functions/v1/lorekeeper/npc',
    '/functions/v1/lorekeeper/consistency',
  ]) {
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({}) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// --- Fall 2: BFS traversal + missing root + createRelationship endpoint existence ---
const store = createLoreGraphStore();
store.nodes.set('root', node('root', 'world', 'W'));
store.nodes.set('a', node('a', 'npc', 'A'));
store.nodes.set('b', node('b', 'location', 'B'));
store.nodes.set('orphan', node('orphan', 'event', 'O'));
store.graphs.set('proj-1', 'root');
createRelationship(store, { fromId: 'root', toId: 'a', type: 'contains' }, 'e1', now);
createRelationship(store, { fromId: 'a', toId: 'b', type: 'at' }, 'e2', now);

const g = getWorldGraph(store, 'proj-1');
assert(g.root?.id === 'root', 'root present');
assert(g.nodes.length === 3, `BFS connected size 3, got ${g.nodes.length}`);
assert(!g.nodes.some((n) => n.id === 'orphan'), 'orphan excluded from BFS');
assert(g.edges.length === 2, 'two edges in traversal');

const missing = getWorldGraph(store, 'nope');
assert(missing.root === null && missing.nodes.length === 0 && missing.edges.length === 0, 'missing root');

let threw = false;
try {
  createRelationship(store, { fromId: 'a', toId: 'missing', type: 'x' }, 'e3', now);
} catch (err) {
  threw = /not found/i.test(String(err?.message || err));
}
assert(threw, 'createRelationship requires both endpoints');

// --- Fall 3 + Fall 4: session-context all-node scan; NPC ignores sessionId ---
store.memories.set('m1', {
  id: 'm1',
  npcId: 'a',
  sessionId: 's1',
  type: 'fact',
  content: 'hi',
  importance: 1,
  timestamp: now,
});
store.memories.set('m2', {
  id: 'm2',
  npcId: 'a',
  sessionId: 's2',
  type: 'fact',
  content: 'other',
  importance: 1,
  timestamp: now,
});

const ctx = getSessionContext(store, 's1');
assert(ctx.npcs.length === 1, 'all npcs (legacy)');
assert(ctx.locations.length === 1, 'all locations (legacy)');
assert(ctx.events.length === 1, 'all events including orphan (legacy)');
assert(ctx.memories.length === 1 && ctx.memories[0].sessionId === 's1', 'memories filter sessionId');

const npcS1 = getNPCContext(store, 'a', 's1');
const npcS2 = getNPCContext(store, 'a', 's2');
assert(npcS1.npc?.id === 'a', 'npc found');
assert(npcS1.memories.length === 2, 'NPC memories ignore sessionId');
assert(npcS2.memories.length === 2, 'same memories for other sessionId');
assert(npcS1.relationships.length === 2, 'relationships for npc');

const quarantineSrc = readFileSync(
  join(root, 'server/src/modules/world/internal/lorekeeper-quarantine.ts'),
  'utf8',
);
assert(
  !/from ['"].*open-database|TABLE_OWNERSHIP|neo4j|createClient/.test(quarantineSrc),
  'quarantine does not wire durable/Neo4j/Supabase persistence',
);

console.log('PASS mig-413-lorekeeper-quarantine.self-test');
