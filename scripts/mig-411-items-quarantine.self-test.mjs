#!/usr/bin/env node
/**
 * mig-411-items-quarantine.self-test — preserve 404; isolate fixtures (#827).
 * Location: scripts/mig-411-items-quarantine.self-test.mjs
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const modUrl = pathToFileURL(join(root, 'server/src/modules/inventory/index.ts')).href;
const {
  ITEMS_MAP_IS_DURABLE_INVENTORY,
  ITEMS_PUBLIC_ACTIVATION_AUTHORIZED,
  SEED_ITEMS,
  applyItemDefaults,
  createSeededRng,
  filterItems,
  generateItem,
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

// --- Fall 1: 404 for list/create/generate ---
assert(ITEMS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('items') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('items'), 'not in allowlist');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/items',
    '/items/generate',
    '/functions/v1/items',
    '/functions/v1/items/generate',
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

// --- Fall 2: defaults, filters, generate ranges, invalid nested ---
const defaults = applyItemDefaults({}, 'x');
assert(defaults.name === 'Unknown' && defaults.type === 'other' && defaults.rarity === 'common', 'defaults');
assert(defaults.weight === 0 && defaults.value === 0 && defaults.source === 'custom', 'numeric/source defaults');
assert(JSON.stringify(defaults.properties) === '{}', 'empty properties');

const falsy = applyItemDefaults({ name: '', weight: 0, properties: { nested: { bad: true } } }, 'y');
assert(falsy.name === 'Unknown', 'falsy name');
assert(falsy.properties.nested?.bad === true, 'invalid nested accepted without schema');

assert(filterItems(SEED_ITEMS, { type: 'weapon' }).every((i) => i.type === 'weapon'), 'type filter');
assert(filterItems(SEED_ITEMS, { rarity: 'uncommon' }).every((i) => i.rarity === 'uncommon'), 'rarity filter');

const rng = createSeededRng(1);
const gen = generateItem(rng, 'g1');
assert(gen.weight >= 0 && gen.weight < 50, 'weight range');
assert(gen.value >= 0 && gen.value < 50000, 'value range');
assert(gen.name.startsWith('Magic '), 'generated name');

// --- Fall 3: durable inventory definitions are separate ---
assert(ITEMS_MAP_IS_DURABLE_INVENTORY === false, 'Map ≠ durable inventory');
assert(
  !existsSync(join(root, 'server/src/modules/inventory/internal/item-definitions-store.ts')),
  'no durable definitions store under quarantine path',
);
const ownership = readFileSync(join(root, 'server/src/persistence/table-ownership.ts'), 'utf8');
assert(
  !/inventory_item_definitions/.test(ownership),
  'inventory_item_definitions not yet owned by Map catalog (migrated independently)',
);

// --- Fall 4: no auth / no schema / not durable ---
assert(ITEMS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no auth activation');

console.log('PASS mig-411-items-quarantine.self-test');
