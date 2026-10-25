#!/usr/bin/env node
/**
 * mig-415-marketplace-quarantine.self-test — preserve 404; isolate fixtures (#831).
 * Location: scripts/mig-415-marketplace-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/marketplace/index.ts')).href;
const {
  MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS,
  MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED,
  SEED_TEMPLATES,
  createMarketplaceStore,
  createTemplate,
  downloadTemplate,
  getTemplate,
  listTemplates,
  rateTemplate,
  searchTemplates,
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

// --- Fall 1: dispatcher + host keep marketplace unmounted ---
assert(MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('marketplace') === false, 'allowlist deny');
assert(
  !EDGE_DISPATCHER_ALLOWLIST.includes('marketplace'),
  'marketplace absent from allowlist values',
);
const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/marketplace/i.test(createApp), 'create-app has no marketplace route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/marketplace/i.test(routeRegistry), 'route-registry has no marketplace route');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/marketplace',
    '/marketplace/templates',
    '/marketplace/search',
    '/marketplace/templates/x/download',
    '/marketplace/templates/x/rate',
    '/functions/v1/marketplace',
    '/functions/v1/marketplace/templates',
    '/functions/v1/marketplace/search',
  ]) {
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ rating: 5 }) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// --- Fall 2: seed catalog, list/filter/search/create/download ---
assert(SEED_TEMPLATES.length === 4, 'full seed catalog');
const store = createMarketplaceStore();
const listed = listTemplates(store);
assert(listed.length === 4, 'seeded list');
assert(listed[0].downloads >= listed[1].downloads, 'sorted by downloads desc');
assert(listTemplates(store, 'ruleset').every((t) => t.type === 'ruleset'), 'type filter');
assert(listTemplates(store, undefined, 'dnd').some((t) => t.id === 'dnd5e-srd'), 'tag filter');
assert(getTemplate(store, 'missing') === null, 'missing template');
assert(getTemplate(store, 'hero-template')?.name === 'Hero Template', 'get by id');

const created = createTemplate(store, { name: '', type: undefined }, 'new-1', '2026-01-01T00:00:00.000Z');
assert(created.name === 'Untitled' && created.type === 'ruleset' && created.author === 'Anonymous', 'defaults');
assert(created.downloads === 0 && created.rating === 0, 'zero counters');

const before = getTemplate(store, 'hero-template').downloads;
downloadTemplate(store, 'hero-template');
assert(getTemplate(store, 'hero-template').downloads === before + 1, 'download increments');
assert(downloadTemplate(store, 'nope') === null, 'download missing');

const search = searchTemplates(store, 'village');
assert(search.some((t) => t.id === 'village-template'), 'search name/desc/tags');

// --- Fall 3: durable marketplace_items are separate ---
assert(MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS === false, 'Map ≠ durable items');
const quarantineSrc = readFileSync(
  join(root, 'server/src/modules/marketplace/internal/marketplace-quarantine.ts'),
  'utf8',
);
assert(
  !/from ['"].*open-database|TABLE_OWNERSHIP|increment_marketplace_downloads|createClient/.test(
    quarantineSrc,
  ),
  'quarantine does not wire durable marketplace persistence/RPC',
);

// --- Fall 4: legacy rate uses downloads as sample count; no auth ---
const rated = rateTemplate(store, 'pf2e-core', 1);
assert(rated !== null, 'rate exists');
// downloads=5000, rating was 4.8 → (4.8*5000 + 1) / 5001
const expected = (4.8 * 5000 + 1) / 5001;
assert(Math.abs(rated.rating - expected) < 1e-9, `legacy rate formula, got ${rated.rating}`);
assert(MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no auth activation');

console.log('PASS mig-415-marketplace-quarantine.self-test');
