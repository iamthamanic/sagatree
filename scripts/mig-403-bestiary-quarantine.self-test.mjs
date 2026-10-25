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
  calculateXp,
  computeEncounterXp,
  filterMonsters,
  parseChallengeRating,
  searchMonsters,
} = await import(npcUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);

// --- Fall 1 / Test 1: dispatcher + host keep bestiary unmounted ---
assert(BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');
assert(isEdgeDispatcherAllowed('bestiary') === false, 'isEdgeDispatcherAllowed(bestiary) false');
assert(
  !EDGE_DISPATCHER_ALLOWLIST.includes('bestiary'),
  'bestiary absent from EDGE_DISPATCHER_ALLOWLIST values',
);

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/bestiary/i.test(createApp), 'create-app has no bestiary route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/bestiary/i.test(routeRegistry), 'route-registry has no bestiary route');

// --- Fall 2 / Test 2: isolated create/list/search/encounter fixtures ---
const defaults = applyMonsterDefaults({});
assert(defaults.name === 'Unknown' && defaults.type === 'beast' && defaults.size === 'medium', 'defaults identity');
assert(defaults.challengeRating === 0 && defaults.hp === 10 && defaults.ac === 10, 'default CR/hp/ac');
assert(defaults.hitDice === '2d6' && defaults.speed.walk === 30, 'default hitDice/speed');
assert(
  defaults.strength === 10 &&
    defaults.dexterity === 10 &&
    defaults.constitution === 10 &&
    defaults.intelligence === 10 &&
    defaults.wisdom === 10 &&
    defaults.charisma === 10,
  'default abilities',
);
assert(defaults.senses[0] === 'passive Perception 10', 'default senses');
assert(Array.isArray(defaults.languages) && defaults.languages.length === 0, 'default languages');
assert(Array.isArray(defaults.actions) && defaults.actions.length === 0, 'default actions');
assert(defaults.source === 'custom' && defaults.challengeRatingText === '0', 'default source/CR text');
assert(defaults.xp === calculateXp(0) && defaults.xp === 10, 'default XP from table');

const cr2 = applyMonsterDefaults({ challengeRating: 2 });
assert(cr2.xp === 450, 'CR2 XP table = 450');
assert(cr2.challengeRatingText === '2', 'CR text from number');

const falsy = applyMonsterDefaults({ xp: 0, hp: 0, name: '', type: '', ac: 0 });
assert(falsy.name === 'Unknown' && falsy.type === 'beast' && falsy.hp === 10 && falsy.ac === 10, 'falsy || fallbacks');
assert(falsy.xp === 10, 'falsy xp falls back via calculateXp(0)');

assert(parseChallengeRating('0.25') === 0.25, 'CR parse');
assert(parseChallengeRating('nope') === null, 'CR invalid');

const listCatalog = [
  applyMonsterDefaults({
    id: 'goblin',
    name: 'Goblin',
    challengeRating: 0.25,
    xp: 50,
    type: 'humanoid',
    size: 'small',
  }),
  applyMonsterDefaults({
    id: 'ogre',
    name: 'Ogre',
    challengeRating: 2,
    xp: 450,
    type: 'giant',
    size: 'large',
    description: 'smelly cave brute',
  }),
  applyMonsterDefaults({
    id: 'wolf',
    name: 'Wolf',
    challengeRating: 0.25,
    xp: 50,
    type: 'beast',
    size: 'medium',
  }),
];
assert(filterMonsters(listCatalog, { type: 'beast' }).length === 1, 'list by type');
assert(filterMonsters(listCatalog, { type: 'BEAST' }).length === 1, 'list type case-insensitive');
assert(filterMonsters(listCatalog, { cr: 0.25 }).length === 2, 'list by CR');
assert(filterMonsters(listCatalog, { size: 'large' })[0]?.id === 'ogre', 'list by size');
assert(searchMonsters(listCatalog, 'gob')[0]?.id === 'goblin', 'search name');
assert(searchMonsters(listCatalog, 'giant')[0]?.id === 'ogre', 'search type field');
assert(searchMonsters(listCatalog, 'cave')[0]?.id === 'ogre', 'search description');
assert(searchMonsters(listCatalog, '').length === 3, 'empty q matches all via includes');

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
