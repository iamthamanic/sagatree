#!/usr/bin/env node
/**
 * mig-406-characters-quarantine.self-test — preserve 404; isolate fixtures (#822).
 * Location: scripts/mig-406-characters-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const {
  CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED,
  addExperienceLegacyUnsafe,
  applyCharacterUpdate,
  createCharacterRecord,
  describeNonAdvancingXpLoopDefect,
  getXpThreshold,
  resolveLevelUpTargetId,
} = await import(modUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);

// --- Fall 1: dispatcher + host keep characters unmounted ---
assert(CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');
assert(isEdgeDispatcherAllowed('characters') === false, 'isEdgeDispatcherAllowed(characters) false');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('characters'), 'characters absent from allowlist values');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/\bcharacters\b/i.test(createApp), 'create-app has no characters route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/\bcharacters\b/i.test(routeRegistry), 'route-registry has no characters route');

// Cross-owner body / import still unmounted (no host consumer to invoke)
assert(
  CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false,
  'cross-owner body and import remain behind 404',
);

// --- Fall 2: PUT ownerId overwrite + level-up body.characterId ---
const base = createCharacterRecord({
  id: 'c1',
  ownerId: 'owner-a',
  name: 'Hero',
  nowIso: '2026-01-01T00:00:00.000Z',
});
const overwritten = applyCharacterUpdate(
  base,
  { ownerId: 'attacker', name: 'Stolen' },
  'c1',
  '2026-01-02T00:00:00.000Z',
);
assert(overwritten.ownerId === 'attacker', 'PUT shallow spread overwrites ownerId');
assert(overwritten.id === 'c1', 'path id forced');
assert(overwritten.name === 'Stolen', 'other fields updated');

const pathId = 'path-char';
const bodyTarget = resolveLevelUpTargetId(pathId, { characterId: 'body-char' });
assert(bodyTarget === 'body-char', 'level-up uses body.characterId not path');
assert(bodyTarget !== pathId, 'path id ignored for level-up target');

// Neither becomes a successor authorization rule
assert(CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no successor auth from these fixtures');

// --- Fall 3 / 4: non-advancing loop identified; XP-at-threshold only with hard guard ---
const defect = describeNonAdvancingXpLoopDefect();
assert(defect.nextLevelAdvances === false && defect.nextThresholdAdvances === false, 'const never advance');
assert(defect.canLoopIndefinitelyAtThreshold === true, 'indefinite loop at threshold');

const legacySrc = readFileSync(join(root, 'supabase/functions/characters/index.ts'), 'utf8');
const addExpFn = legacySrc.slice(
  legacySrc.indexOf('async function addExperience'),
  legacySrc.indexOf('async function levelUp'),
);
assert(
  /const nextLevel = character\.level \+ 1/.test(addExpFn) &&
    /const nextThreshold = getXPThreshold\(nextLevel\)/.test(addExpFn) &&
    /while \(character\.experience >= nextThreshold && nextLevel <= 20\)/.test(addExpFn),
  'source check: non-advancing addExperience loop present in legacy worker',
);
const whileBody = addExpFn.slice(addExpFn.indexOf('while ('), addExpFn.indexOf('character.updatedAt'));
assert(
  !/nextLevel\s*\+\+|nextLevel\s*=|nextThreshold\s*=/.test(whileBody.replace(/^while[^{]*\{/, '')),
  'source check: loop body does not advance nextLevel/nextThreshold',
);

const atThreshold = createCharacterRecord({
  id: 'c2',
  ownerId: 'owner-a',
  name: 'Stuck',
  nowIso: '2026-01-01T00:00:00.000Z',
});
atThreshold.level = 1;
atThreshold.experience = 0;
const hangProbe = addExperienceLegacyUnsafe(atThreshold, getXpThreshold(2), { maxIterations: 50 });
assert(hangProbe.stoppedByGuard === true, 'XP-at-threshold stops only via hard iteration guard');
assert(hangProbe.leveledUp === true, 'entered level-up branch before guard');

// Below threshold must terminate without guard
const below = createCharacterRecord({
  id: 'c3',
  ownerId: 'owner-a',
  name: 'Safe',
  nowIso: '2026-01-01T00:00:00.000Z',
});
const safe = addExperienceLegacyUnsafe(below, 10, { maxIterations: 50 });
assert(safe.stoppedByGuard === false && safe.character.experience === 10, 'sub-threshold terminates');
assert(safe.character.level === 1 && safe.leveledUp === false, 'no level change below threshold');

// --- Fall 5: no auth; client ownerId; nested fields unvalidated (characterization) ---
const forged = createCharacterRecord({
  id: 'c4',
  ownerId: 'client-supplied-owner',
  name: 'Forged',
  nowIso: '2026-01-01T00:00:00.000Z',
});
assert(forged.ownerId === 'client-supplied-owner', 'client supplies ownerId without auth');

console.log('PASS mig-406-characters-quarantine.self-test');
