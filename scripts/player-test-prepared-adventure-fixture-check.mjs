#!/usr/bin/env node
/**
 * player-test-prepared-adventure-fixture-check — contract for #302 / Epic #210.
 * Location: scripts/player-test-prepared-adventure-fixture-check.mjs
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
  'src/domains/session/contracts/prepared-adventure-fixture.ts',
  [
    'PLAYER_TEST_PREPARED_ADVENTURE_FIXTURE_ID',
    'PREPARED_ADVENTURE_FIXTURE_SCHEMA_VERSION',
    'listPreparedAdventurePregens',
    'listPreparedAdventureNpcSpawnPlan',
    'assertPreparedAdventureFixtureIntegrity',
    'VOICE_VIDEO_EXTERNAL_NOTE',
    'builtin.fantasy.healing-potion',
    'core:npc.bandit',
    'core:npc.citizen',
    'builtin:fantasy-basic',
  ],
  'prepared adventure contract',
);

mustNotInclude(
  'src/domains/session/contracts/prepared-adventure-fixture.ts',
  ['supabase', "from 'react'", 'from "react"', 'as any', '@ts-ignore', '@ts-expect-error', 'eslint-disable'],
  'pure prepared-adventure domain',
);

mustInclude(
  'src/App.tsx',
  ['session-join', 'SessionJoin'],
  'SessionJoin mounted in App',
);

mustInclude(
  'src/infrastructure/project/project-service.ts',
  ['worldProfileId: payload.world_profile_id', 'createHostProject', 'updateProjectWorldProfile'],
  'project create writes world_profile_id (CUT-20 host)',
);

mustInclude(
  'src/app/project/SagaCreateForm.tsx',
  ['world_profile_id', 'Weltprofil', 'useWorldProfiles', 'data-saga-create-world'],
  'Saga create world profile select',
);

mustInclude(
  'src/app/session/PreparedAdventureFixturePanel.tsx',
  [
    'Player-Test-Abenteuer vorbereiten',
    'spawnNpcCreatureInstance',
    'Als Charakter übernehmen',
    'data-prepared-adventure-fixture',
  ],
  'prepare fixture panel',
);

mustInclude(
  'src/app/dashboard/Dashboard.tsx',
  ['session-join', 'Session hosten'],
  'Dashboard session CTA',
);

mustInclude(
  '.qa/design/player-test-prepared-adventure-fixture.md',
  ['Discord', 'Meet', 'Voice'],
  'design Voice/Video note',
);

mustInclude(
  '.qa/acceptance/player-test-prepared-adventure-fixture.md',
  ['Discord', 'Meet'],
  'acceptance Voice/Video note',
);

const touchedAppFiles = [
  'src/app/session/PreparedAdventureFixturePanel.tsx',
  'src/app/session/SessionJoin.tsx',
  'src/app/project/ProjectJoin.tsx',
  'src/app/project/SagaResourceScreen.tsx',
  'src/app/dashboard/Dashboard.tsx',
];
for (const file of touchedAppFiles) {
  mustNotInclude(file, ['as any', '@ts-ignore', '@ts-expect-error', 'eslint-disable'], `no escape hatches in ${file}`);
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-prepared-adventure-fixture-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'prepared-adventure.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/prepared-adventure-fixture.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(domainOut).href);

mod.assertPreparedAdventureFixtureIntegrity();

const pregens = mod.listPreparedAdventurePregens();
if (pregens.length < 3 || pregens.length > 4) {
  throw new Error(`pregen count must be 3–4, got ${pregens.length}`);
}
if (!pregens.every((p) => p.starterItemDefinitionIds.includes('builtin.fantasy.healing-potion'))) {
  throw new Error('every pregen must include healing potion');
}

const npcs = mod.listPreparedAdventureNpcSpawnPlan();
if (npcs.length < 3 || npcs.length > 5) {
  throw new Error(`NPC plan count must be 3–5, got ${npcs.length}`);
}
const defCounts = new Map();
for (const entry of npcs) {
  defCounts.set(entry.definitionId, (defCounts.get(entry.definitionId) ?? 0) + 1);
}
if (![...defCounts.values()].some((c) => c >= 2)) {
  throw new Error('NPC plan must duplicate at least one definitionId');
}

const fixture = mod.getPreparedAdventureFixture();
const kinds = new Set(fixture.beats.map((b) => b.kind));
for (const required of ['exploration', 'social', 'combat', 'damage-healing', 'drive-momentum']) {
  if (!kinds.has(required)) throw new Error(`missing beat kind ${required}`);
}

const note = mod.VOICE_VIDEO_EXTERNAL_NOTE;
if (!note.includes('Discord') || !note.includes('Meet')) {
  throw new Error('VOICE_VIDEO_EXTERNAL_NOTE must mention Discord and Meet');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('player-test-prepared-adventure-fixture-check.mjs')) {
  throw new Error('test-gate must invoke player-test-prepared-adventure-fixture-check.mjs');
}

console.log('player-test-prepared-adventure-fixture-check: PASS');
