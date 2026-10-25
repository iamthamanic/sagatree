#!/usr/bin/env node
/**
 * mig-403-bestiary-quarantine.self-test — preserve 404; isolate fixtures (#819).
 * Location: scripts/mig-403-bestiary-quarantine.self-test.mjs
 */
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

const npcUrl = pathToFileURL(join(root, 'server/src/modules/npc-creature/index.ts')).href;
const {
  BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED,
  applyMonsterDefaults,
  computeEncounterXp,
  filterMonsters,
  parseChallengeRating,
} = await import(npcUrl);

// --- Fall 1 / Test 1: dispatcher + host keep bestiary unmounted ---
assert(BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');

const allowlist = readFileSync(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
  'utf8',
);
assert(!allowlist.includes("'bestiary'"), 'bestiary not on EDGE_DISPATCHER_ALLOWLIST');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/bestiary/i.test(createApp), 'create-app has no bestiary route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/bestiary/i.test(routeRegistry), 'route-registry has no bestiary route');

// --- Fall 2 / Test 2: isolated create/list/search/encounter fixtures ---
const defaults = applyMonsterDefaults({});
assert(defaults.name === 'Unknown' && defaults.type === 'beast' && defaults.size === 'medium', 'defaults');
assert(defaults.challengeRating === 0 && defaults.hp === 10, 'default CR/hp');

assert(parseChallengeRating('0.25') === 0.25, 'CR parse');
assert(parseChallengeRating('nope') === null, 'CR invalid');

const listCatalog = [
  { id: 'goblin', name: 'Goblin', challengeRating: 0.25, xp: 50, type: 'humanoid', size: 'small' },
  { id: 'ogre', name: 'Ogre', challengeRating: 2, xp: 450, type: 'giant', size: 'large' },
  { id: 'wolf', name: 'Wolf', challengeRating: 0.25, xp: 50, type: 'beast', size: 'medium' },
];
assert(filterMonsters(listCatalog, { type: 'beast' }).length === 1, 'list by type');
assert(filterMonsters(listCatalog, { cr: 0.25 }).length === 2, 'list by CR');
assert(filterMonsters(listCatalog, { size: 'large' })[0]?.id === 'ogre', 'list by size');
assert(filterMonsters(listCatalog, { q: 'gob' })[0]?.id === 'goblin', 'search q');
assert(filterMonsters(listCatalog, { q: '' }).length === 3, 'empty q returns all');

const catalog = new Map([
  ['goblin', { id: 'goblin', name: 'Goblin', challengeRating: 0.25, xp: 50 }],
  ['ogre', { id: 'ogre', name: 'Ogre', challengeRating: 2, xp: 450 }],
]);

const known = computeEncounterXp({
  catalog,
  monsters: [
    { monsterId: 'goblin', count: 2 },
    { monsterId: 'ogre', count: 1 },
  ],
});
assert(known.totalXP === 50 * 2 + 450, `totalXP=${known.totalXP}`);
assert(known.requestedCount === 3 && known.multiplier === 2, 'multiplier for 3');
assert(known.adjustedXP === Math.floor(known.totalXP * 2), 'adjusted');

// Unknown monster skipped for XP/list contribution but count still multiplies
const mixed = computeEncounterXp({
  catalog,
  monsters: [
    { monsterId: 'goblin', count: 1 },
    { monsterId: 'missing', count: 2 },
  ],
});
assert(mixed.totalXP === 50, 'unknown skipped for XP');
assert(mixed.knownCount === 1 && mixed.requestedCount === 3, 'requested vs known mismatch');
assert(mixed.multiplier === 2, 'multiplier uses requested count');

// --- Fall 3 / Test 3: replacement must bound negatives — quarantine documents unbound legacy ---
const unbounded = computeEncounterXp({
  catalog,
  monsters: [{ monsterId: 'goblin', count: -5 }],
});
assert(unbounded.requestedCount === -5, 'legacy allows nonpositive requested count (unbounded defect)');
assert(
  BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED === false,
  'generator not authorized for public deployment',
);

// --- Fall 4 / Test 4: legacy defect characterization recorded ---
assert(
  mixed.knownCount !== mixed.requestedCount,
  'legacy XP vs multiplier count mismatch is fixture-proven',
);

console.log('PASS mig-403-bestiary-quarantine.self-test');
