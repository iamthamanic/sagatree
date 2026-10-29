#!/usr/bin/env node
/**
 * mig-419-rulesets-quarantine.self-test — preserve 404; isolate fixtures (#835).
 * Location: scripts/mig-419-rulesets-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/rulesets/index.ts')).href;
const {
  OPEN5E_API_BASE,
  RULESETS_MAP_IS_HOST_CATALOG_POLICY,
  RULESETS_PUBLIC_ACTIVATION_AUTHORIZED,
  applyRulesetCreateDefaults,
  createSeededRulesetCatalog,
  describeRulesetsLegacyDefects,
  enrichRulesetWithOpen5e,
  fetchOpen5eSpells,
  getRuleset,
  mapOpen5eItem,
  mapOpen5eMonster,
  mapOpen5eSpell,
  putRuleset,
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

assert(RULESETS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(RULESETS_MAP_IS_HOST_CATALOG_POLICY === false, 'Map is not host catalog policy');
assert(isEdgeDispatcherAllowed('rulesets') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('rulesets'), 'not in allowlist');
const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/\/rulesets|functions\/v1\/rulesets/i.test(createApp), 'create-app has no rulesets mount');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(
  !/\/rulesets|functions\/v1\/rulesets/.test(routeRegistry),
  'route-registry has no rulesets mount',
);

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/rulesets',
    '/rulesets/dnd5e-srd',
    '/rulesets/dnd5e-srd/spells',
    '/rulesets/dnd5e-srd/monsters',
    '/rulesets/dnd5e-srd/items',
    '/rulesets/dnd5e-srd/skills',
    '/rulesets/dnd5e-srd/conditions',
    '/rulesets/dnd5e-srd/classes',
    '/rulesets/dnd5e-srd/races',
    '/functions/v1/rulesets',
    '/functions/v1/rulesets/dnd5e-srd',
    '/functions/v1/rulesets/dnd5e-srd/spells',
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

const catalog = createSeededRulesetCatalog();
assert(catalog.has('dnd5e-srd') && catalog.has('pathfinder2e'), 'seeded catalog');

let networkCalls = 0;
const trackingFetch = async () => {
  networkCalls += 1;
  throw new Error('network should not run');
};

const plain = await getRuleset(catalog, 'dnd5e-srd', false, trackingFetch);
assert(plain && plain.id === 'dnd5e-srd', 'non-enrich get');
assert(networkCalls === 0, 'ordinary catalog read does not network');

const created = applyRulesetCreateDefaults({}, 1_700_000_000_000);
assert(created.id === 'custom-1700000000000', 'default custom id');
assert(created.name === 'Custom Ruleset' && created.version === '1.0', 'defaults');
assert(created.source === 'custom' && created.isOfficial === false && created.isCustom === true, 'flags');
assert(created.abilities.length === 6 && created.dice.length === 7, 'ability/dice defaults');
assert(Object.keys(created.skills).length === 0 && created.conditions.length === 0, 'empty maps');

const overwriteA = putRuleset(catalog, applyRulesetCreateDefaults({ id: 'overwrite-me', name: 'A' }, 1));
const overwriteB = putRuleset(catalog, applyRulesetCreateDefaults({ id: 'overwrite-me', name: 'B' }, 2));
assert(overwriteA.name === 'A' && overwriteB.name === 'B', 'create names');
assert(catalog.get('overwrite-me').name === 'B', 'caller id overwrites Map entry');

const spell = mapOpen5eSpell({
  slug: 'fireball',
  name: 'Fireball',
  level: '3',
  school: 'evocation',
  casting_time: '1 action',
  range: '150 feet',
  components: 'V, S, M',
  duration: 'Instantaneous',
  desc: 'A bright streak…',
  higher_level: 'When you cast…',
  dnd_class: 'Sorcerer, Wizard',
});
assert(spell.id === 'fireball' && spell.level === 3, 'spell map id/level');
assert(spell.components.join('|') === 'V|S|M', 'spell components split');
assert(spell.classes.join('|') === 'sorcerer|wizard', 'spell classes lowercased');
assert(spell.source === 'Open5e' && spell.higherLevels === 'When you cast…', 'spell source/higher');

const monster = mapOpen5eMonster({
  slug: 'goblin',
  name: 'Goblin',
  type: 'humanoid',
  size: 'Small',
  cr: '1/4',
  hit_points: 7,
  armor_class: 15,
  speed: '30 ft.',
  strength: 8,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 8,
});
// Legacy: parseFloat('1/4') stops at '/' → 1 (no true fraction CR parsing).
assert(monster.challengeRating === 1, 'monster CR parseFloat fractional → 1');
assert(mapOpen5eMonster({ cr: '2' }).challengeRating === 2, 'monster CR numeric string');
assert(mapOpen5eMonster({ cr: 'not-a-number' }).challengeRating === 0, 'monster CR NaN → 0');
assert(monster.hp === 7 && monster.ac === 15 && monster.actions.length === 0, 'monster fields');

const item = mapOpen5eItem({ slug: 'longsword', name: 'Longsword', cost: '15 gp', desc: 'A sword' });
assert(item.type === 'weapon' && item.rarity === 'common' && item.weight === 0, 'item defaults');
assert(item.cost === '15 gp' && item.source === 'Open5e', 'item cost/source');

const urls = [];
const enrichFetch = async (url) => {
  urls.push(url);
  if (url.includes('/spells/')) {
    return {
      json: async () => ({
        results: [
          {
            slug: 'mage-hand',
            name: 'Mage Hand',
            level: '0',
            school: 'conjuration',
            casting_time: '1 action',
            range: '30 feet',
            components: 'V, S',
            duration: '1 minute',
            desc: 'A spectral hand',
            dnd_class: 'Wizard',
          },
        ],
      }),
    };
  }
  if (url.includes('/monsters/')) {
    return { json: async () => ({ results: [{ slug: 'rat', name: 'Rat', cr: '0', hit_points: 1, armor_class: 10 }] }) };
  }
  if (url.includes('/weapons/')) {
    return { json: async () => ({ results: [{ slug: 'dagger', name: 'Dagger', cost: '2 gp' }] }) };
  }
  throw new Error(`unexpected url ${url}`);
};

const enriched = await enrichRulesetWithOpen5e(catalog, 'dnd5e-srd', enrichFetch);
assert(enriched && enriched.spells.some((s) => s.id === 'mage-hand'), 'enrich merges spells');
assert(enriched.monsters.some((m) => m.id === 'rat'), 'enrich merges monsters');
assert(enriched.items.some((i) => i.id === 'dagger'), 'enrich merges items');
assert(urls.every((u) => u.startsWith(OPEN5E_API_BASE) && u.includes('limit=500')), 'Open5e URLs');
assert(urls.length === 3, 'three enrich fetches');

const pf = await enrichRulesetWithOpen5e(catalog, 'pathfinder2e', enrichFetch);
assert(pf && pf.id === 'pathfinder2e' && urls.length === 3, 'non-srd enrich skips network');

const failFetch = async () => {
  throw new Error('boom');
};
assert((await fetchOpen5eSpells(failFetch)).length === 0, 'fetch throw → empty');
const badJsonFetch = async () => ({ json: async () => 'not-json-object' });
assert((await fetchOpen5eSpells(badJsonFetch)).length === 0, 'bad JSON → empty');
const noResultsFetch = async () => ({ json: async () => ({ count: 1 }) });
assert((await fetchOpen5eSpells(noResultsFetch)).length === 0, 'missing results → empty');

const defects = describeRulesetsLegacyDefects();
assert(defects.some((d) => /auth|owner/i.test(d)), 'auth defect listed');
assert(defects.some((d) => /overwrite/i.test(d)), 'overwrite defect listed');
assert(defects.some((d) => /timeout|pagination|limit=500/i.test(d)), 'open5e defect listed');
assert(
  RULESETS_PUBLIC_ACTIVATION_AUTHORIZED === false,
  'limit=500 pagination assumptions must not ship without successor validation',
);

console.log('PASS mig-419-rulesets-quarantine.self-test');
