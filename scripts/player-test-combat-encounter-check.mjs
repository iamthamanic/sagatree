#!/usr/bin/env node
/**
 * player-test-combat-encounter-check — contract for #300 / Epic #210 Phase 5.
 * Location: scripts/player-test-combat-encounter-check.mjs
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

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'archive/supabase-legacy/supabase/migrations/044_session_combat_encounter.sql',
  [
    'sagadrive_resolve_combat_command',
    'sagadrive_resolve_damage_command',
    'sagadrive_resolve_condition_command',
    'sagadrive_strip_forged_encounter_keys',
    'sagadrive_sync_npc_instance_from_participant',
    "'{encounter}'",
    'apply_session_runtime_command',
    'spendAction',
    'nextTurn',
  ],
  'combat encounter migration',
);

mustInclude(
  'src/domains/session/contracts/combat-encounter.ts',
  [
    'FORGED_ENCOUNTER_KEYS',
    'stripForgedEncounterKeys',
    'readEncounterState',
    'parseCombatCommandInput',
    'applyDamageToParticipant',
    'advanceEncounterTurn',
    'spendActionSlot',
    'resolvePcInitiativeBonus',
  ],
  'combat encounter contract',
);

mustNotInclude(
  'src/domains/session/contracts/combat-encounter.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure combat-encounter domain',
);

mustInclude(
  'src/app/session/hooks/useCombatEncounter.ts',
  ["kind: 'combat'", "kind: 'damage'", "kind: 'condition'", 'runCombat'],
  'combat encounter hook',
);

mustInclude(
  'src/app/session/CombatEncounterGmPanel.tsx',
  ['data-combat-encounter-gm="v1"', 'data-combat-start', 'data-combat-next-turn', 'data-combat-damage'],
  'combat GM panel',
);

mustInclude(
  'src/app/session/GamemasterPanel.tsx',
  ['CombatEncounterGmPanel', 'data-gm-tab-combat', 'useCombatEncounter'],
  'GM panel combat tab',
);

mustInclude(
  'src/domains/session/contracts/player-panel.ts',
  ['readEncounterState', 'findPcParticipantByCharacterId', 'encounterIsMyTurn'],
  'player panel encounter projection',
);

mustInclude(
  'src/app/session/PlayerPanel.tsx',
  ['encounterRound', 'encounterIsMyTurn', 'Dein Zug'],
  'player panel combat status',
);

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-combat-encounter-check');
mkdirSync(cacheDir, { recursive: true });

const out = join(cacheDir, 'combat-encounter.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/combat-encounter.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(out).href);

const {
  stripForgedEncounterKeys,
  FORGED_ENCOUNTER_KEYS,
  sortParticipantsByInitiative,
  applyDamageToParticipant,
  applyConditionToParticipant,
  spendActionSlot,
  advanceEncounterTurn,
  resolveInitiativeTotal,
  resolvePcInitiativeBonus,
  parseCombatCommandInput,
  emptyEncounterState,
  freshActionEconomy,
  buildParticipantId,
} = mod;

if (!Array.isArray(FORGED_ENCOUNTER_KEYS) || !FORGED_ENCOUNTER_KEYS.includes('initiative')) {
  throw new Error('FORGED_ENCOUNTER_KEYS must include initiative');
}

const forged = stripForgedEncounterKeys({
  action: 'start',
  initiative: 99,
  hpCurrent: 1,
  participants: [{ kind: 'pc', refId: 'abc' }],
});
if ('initiative' in forged || 'hpCurrent' in forged) {
  throw new Error('stripForgedEncounterKeys failed');
}

const start = parseCombatCommandInput({
  action: 'start',
  participants: [
    { kind: 'pc', refId: 'char-1', name: 'Aria' },
    { kind: 'npc', instanceId: 'npc-1', name: 'Wolf' },
  ],
});
if (start.action !== 'start' || start.participants.length !== 2) {
  throw new Error('parseCombatCommandInput start failed');
}

const bonus = resolvePcInitiativeBonus({
  perception: 3,
  awarenessRank: 2,
  level: 5,
  appliedExperienceBonus: (rank, level) => Math.min(rank + 1, level <= 4 ? 1 : 2),
});
if (bonus !== 3 + 2 + 2) {
  throw new Error(`unexpected initiative bonus ${bonus}`);
}
if (resolveInitiativeTotal(15, 5) !== 20) {
  throw new Error('resolveInitiativeTotal failed');
}

const p1 = {
  id: buildParticipantId('pc', 'c1'),
  kind: 'pc',
  refId: 'c1',
  name: 'A',
  initiative: 10,
  initiativeBonus: 2,
  hpCurrent: 20,
  hpMax: 20,
  conditions: [],
  actions: freshActionEconomy(),
};
const p2 = {
  ...p1,
  id: buildParticipantId('npc', 'n1'),
  kind: 'npc',
  refId: 'n1',
  name: 'B',
  initiative: 18,
};
const sorted = sortParticipantsByInitiative([p1, p2]);
if (sorted[0].id !== p2.id) {
  throw new Error('initiative sort failed');
}

const damaged = applyDamageToParticipant(p1, 25, 'damage');
if (damaged.hpCurrent !== 0 || !damaged.conditions.includes('bewusstlos')) {
  throw new Error('damage to 0 should set bewusstlos');
}
const healed = applyDamageToParticipant(damaged, 5, 'heal');
if (healed.hpCurrent !== 5 || healed.conditions.includes('bewusstlos')) {
  throw new Error('heal from 0 should clear bewusstlos');
}

const conditioned = applyConditionToParticipant(p1, 'add', 'verwundet');
if (!conditioned.conditions.includes('verwundet')) {
  throw new Error('add condition failed');
}

const spent = spendActionSlot(p1, 'main');
if (!spent.ok || spent.participant.actions.main !== 0) {
  throw new Error('spendActionSlot failed');
}
const overspend = spendActionSlot(spent.participant, 'main');
if (overspend.ok) {
  throw new Error('overspend should fail');
}

let state = {
  ...emptyEncounterState(),
  status: 'active',
  round: 1,
  currentTurnIndex: 0,
  participants: [p1, { ...p2, actions: freshActionEconomy() }],
};
state = advanceEncounterTurn(state);
if (state.currentTurnIndex !== 1 || state.round !== 1) {
  throw new Error('advance turn mid-round failed');
}
state = advanceEncounterTurn(state);
if (state.currentTurnIndex !== 0 || state.round !== 2) {
  throw new Error('advance turn new round failed');
}

console.log('player-test-combat-encounter-check: OK');
