#!/usr/bin/env node
/**
 * adventure-runtime-world-state-check — #374 Adventure Runtime / World State.
 * Location: scripts/adventure-runtime-world-state-check.mjs
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
  'src/domains/session/contracts/adventure-runtime-state.ts',
  [
    'applyAdventureRuntimeCommand',
    'assertAdventureRuntimeAccess',
    'parseAdventureRuntimeCommand',
    'projectAdventureRuntimeForAudience',
    'definitionRef',
    'ADVENTURE_RUNTIME_SCHEMA_VERSION',
  ],
  'adventure domain',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ["| 'adventure'", "'adventure'"],
  'event kind adventure',
);

mustInclude(
  'src/domains/session/contracts/generic-gm-actions.ts',
  ["kind: 'adventure'", "kind === 'adventure'", "op: 'set_flag'"],
  'gm action wiring',
);

mustInclude(
  'src/app/session/AdventureRuntimeControls.tsx',
  [
    'data-adventure-runtime-controls="v1"',
    'min-h-11',
    'data-adventure-runtime-set-flag',
    'data-adventure-runtime-hydrate',
  ],
  'controls UI',
);

mustInclude(
  'src/app/session/GamemasterLiveScreen.tsx',
  ['AdventureRuntimeControls', 'data-gm-generic-action-slot="world"'],
  'GM world tab',
);

mustInclude(
  'archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql',
  [
    'sagadrive_resolve_adventure_command',
    'adventure_runtime',
    "'adventure'",
    'sagadrive_project_shared_adventure',
  ],
  'SQL authority',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('adventure-runtime-world-state-check.mjs')) {
  throw new Error('test-gate must invoke adventure-runtime-world-state-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/adventure-runtime-world-state-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'adv.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/adventure-runtime-state.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const empty = mod.emptyAdventureRuntimeState();
const setFlag = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({
    op: 'set_flag',
    key: 'relic_recovered',
    value: true,
    visibility: 'shared',
  }),
  previous: empty,
});
if (!setFlag.ok || setFlag.state.flags.relic_recovered?.value !== true) {
  throw new Error('set_flag failed');
}

const gmOnly = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({
    op: 'set_flag',
    key: 'secret_plan',
    value: 'x',
    visibility: 'gm_only',
  }),
  previous: setFlag.state,
});
const playerView = mod.projectAdventureRuntimeForAudience(gmOnly.state, 'player');
if (playerView.flags.secret_plan) {
  throw new Error('gm_only flag must not project to player');
}
if (!playerView.flags.relic_recovered) {
  throw new Error('shared flag must project to player');
}

const clock = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({
    op: 'tick_clock',
    clockId: 'danger',
    clockDelta: 2,
  }),
  previous: gmOnly.state,
});
if (!clock.ok || clock.state.clocks.danger.value !== 2) {
  throw new Error('tick_clock failed');
}

const cons = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({
    op: 'add_consequence',
    summary: 'Dorf warnt vor Banditen',
    visibility: 'public',
  }),
  previous: clock.state,
});
if (!cons.ok || cons.state.consequences.length !== 1) {
  throw new Error('add_consequence failed');
}

const withRef = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({
    op: 'set_definition_ref',
    definitionRef: 'package:dornhain',
  }),
  previous: cons.state,
});
if (!withRef.ok || withRef.state.definitionRef !== 'package:dornhain') {
  throw new Error('definitionRef failed');
}

// Hydrate from project durable snapshot
const hydrated = mod.applyAdventureRuntimeCommand({
  command: mod.parseAdventureRuntimeCommand({ op: 'hydrate_from_project' }),
  previous: empty,
  projectState: withRef.state,
});
if (!hydrated.ok || hydrated.state.definitionRef !== 'package:dornhain') {
  throw new Error('hydrate_from_project failed');
}

try {
  mod.assertAdventureRuntimeAccess(
    { role: 'viewer', capabilities: [], characterId: null },
    mod.parseAdventureRuntimeCommand({ op: 'set_flag', key: 'x', value: true }),
  );
  throw new Error('viewer must fail');
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('Spielleiter')) {
    throw err;
  }
}

// Palette back-compat: key/value without op
const legacy = mod.parseAdventureRuntimeCommand({ key: 'legacy_flag', value: 1 });
if (legacy.op !== 'set_flag' || legacy.key !== 'legacy_flag') {
  throw new Error('legacy parse failed');
}

console.log('adventure-runtime-world-state-check: PASS');
