#!/usr/bin/env node
/**
 * session-death-lifecycle-check — #373 Downed / Stabilisierung / Tod.
 * Location: scripts/session-death-lifecycle-check.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'src/domains/session/contracts/session-death-lifecycle.ts',
  [
    'applyDeathLifecycleCommand',
    'assertDeathLifecycleAccess',
    'parseDeathLifecycleCommand',
    'applyDeathSaveGrade',
    'enterDownedFromZeroHp',
    'canPerformProhibitedGameplay',
    'lifeByCharacter',
  ],
  'death lifecycle domain',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ["| 'life'", "'life'"],
  'session event kind life',
);

mustInclude(
  'src/app/session/DeathLifecycleControls.tsx',
  [
    'data-death-lifecycle-controls="v1"',
    'min-h-11',
    'data-death-lifecycle-death-save',
    'data-death-lifecycle-stabilize',
    'data-death-lifecycle-mark-dead',
    'confirmDead',
  ],
  'death controls UI',
);

mustInclude(
  'src/app/session/CombatEncounterGmPanel.tsx',
  ['DeathLifecycleControls', 'data-death-lifecycle-slot'],
  'combat panel slot',
);

mustInclude(
  'src/app/session/PlayerPanel.tsx',
  ['data-death-lifecycle-player="v1"', 'lifeStatus'],
  'player life status',
);

mustInclude(
  'src/domains/session/contracts/player-panel.ts',
  ['readLifeByCharacter', 'canPerformProhibitedGameplay', 'lifeStatus'],
  'player panel life fields',
);

mustInclude(
  'archive/supabase-legacy/supabase/migrations/049_session_death_lifecycle.sql',
  [
    'sagadrive_resolve_life_command',
    'lifeByCharacter',
    "'life'",
    'death_save',
    'stabilize',
    'mark_dead',
  ],
  'SQL life authority',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('session-death-lifecycle-check.mjs')) {
  throw new Error('test-gate must invoke session-death-lifecycle-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/session-death-lifecycle-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'life.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-death-lifecycle.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const downed = mod.enterDownedFromZeroHp(null, 'Standard');
if (downed.status !== 'downed' || downed.dyingLevel !== 1) {
  throw new Error(`Standard drop expected downed@1, got ${downed.status}@${downed.dyingLevel}`);
}

const hero = mod.enterDownedFromZeroHp(null, 'Heroisch');
if (hero.status !== 'stable' || hero.dyingLevel !== 0) {
  throw new Error('Heroisch drop should be stable@0');
}

const hart = mod.enterDownedFromZeroHp(null, 'Hart');
if (hart.status !== 'downed' || hart.dyingLevel !== 2 || hart.wounds !== 1) {
  throw new Error('Hart drop expected downed@2 with 1 wound');
}

let life = downed;
life = mod.applyDeathSaveGrade(life, 'failure');
if (life.dyingLevel !== 2) throw new Error('failure should +1 dying');
life = mod.applyDeathSaveGrade(life, 'crit_failure');
if (life.status !== 'dead' || life.dyingLevel !== 3) {
  throw new Error('crit failure from 2 should kill');
}
if (mod.canPerformProhibitedGameplay(life) !== false) {
  throw new Error('dead must block gameplay');
}

const stab = mod.applyDeathLifecycleCommand({
  command: mod.parseDeathLifecycleCommand({
    op: 'stabilize',
    characterId: 'c1',
  }),
  previous: mod.enterDownedFromZeroHp(null, 'Standard'),
  sessionDifficulty: 'Standard',
});
if (!stab.ok || stab.life.status !== 'stable') {
  throw new Error('stabilize failed');
}

const mark = mod.applyDeathLifecycleCommand({
  command: mod.parseDeathLifecycleCommand({
    op: 'mark_dead',
    characterId: 'c1',
    confirmDead: true,
  }),
  previous: stab.life,
  sessionDifficulty: 'Standard',
});
if (!mark.ok || mark.life.status !== 'dead') {
  throw new Error('mark_dead failed');
}

try {
  mod.assertDeathLifecycleAccess(
    { role: 'player', capabilities: [], characterId: 'c1' },
    mod.parseDeathLifecycleCommand({ op: 'stabilize', characterId: 'c1' }),
  );
  throw new Error('player must not mutate life');
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('Spielleiter')) {
    throw err;
  }
}

const healed = mod.clearAliveFromHeal(stab.life, 'Standard');
if (healed.status !== 'alive') throw new Error('heal should clear downed/stable');

const deadStay = mod.clearAliveFromHeal(mark.life, 'Standard');
if (deadStay.status !== 'dead') throw new Error('heal must not revive dead without clear_alive');

console.log('session-death-lifecycle-check: PASS');
