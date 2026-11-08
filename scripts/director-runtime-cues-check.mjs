#!/usr/bin/env node
/**
 * director-runtime-cues-check — #375 Director Runtime / Cues / Automatic Mode.
 * Location: scripts/director-runtime-cues-check.mjs
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
  'src/domains/session/director/director-runtime.ts',
  [
    'applyDirectorCueCommand',
    'mapSessionEventToCueTrigger',
    'assertDirectorCueAccess',
    'assertDirectorCannotMutateGameplay',
    'automaticMode',
    'defaultCueForTrigger',
  ],
  'director domain',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ["| 'cue'", "'cue'"],
  'event kind cue',
);

mustInclude(
  'src/app/session/hooks/useDirectorRuntime.ts',
  ['useDirectorRuntime', "kind: 'cue'", 'programRevision'],
  'director facade hook',
);

mustInclude(
  'src/domains/session/contracts/generic-gm-actions.ts',
  ["kind === 'cue'", "op: 'apply_cue'", 'manual: true'],
  'gm trigger-cue wiring',
);

mustInclude(
  'archive/supabase-legacy/supabase/migrations/051_session_director_runtime.sql',
  [
    'sagadrive_resolve_cue_command',
    "'cue'",
    'sagadrive_session_has_director',
    'automaticMode',
    "'life', 'adventure', 'cue'",
  ],
  'SQL director authority',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('director-runtime-cues-check.mjs')) {
  throw new Error('test-gate must invoke director-runtime-cues-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/director-runtime-cues-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'dir.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/director/director-runtime.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

if (mod.mapSessionEventToCueTrigger('scene') !== 'scene') {
  throw new Error('scene map failed');
}
if (mod.mapSessionEventToCueTrigger('unknown-xyz') !== null) {
  throw new Error('unknown must no-op');
}
if (mod.mapSessionEventToCueTrigger('life', { lifeStatus: 'dead' }) !== 'dead') {
  throw new Error('dead map failed');
}

let state = mod.emptyDirectorRuntimeState();
const autoOff = mod.applyDirectorCueCommand({
  command: { op: 'apply_cue', trigger: 'scene', manual: false, nowMs: 1000 },
  previous: state,
});
if (!autoOff.ok || autoOff.applied !== false || autoOff.reason !== 'automatic_mode_off') {
  throw new Error('auto off must skip');
}

state = mod.applyDirectorCueCommand({
  command: { op: 'set_automatic_mode', mode: 'on' },
  previous: state,
}).state;

const autoOn = mod.applyDirectorCueCommand({
  command: { op: 'apply_cue', trigger: 'combat_start', manual: false, nowMs: 2000 },
  previous: state,
});
if (!autoOn.ok || !autoOn.applied || autoOn.state.program.revision !== 1) {
  throw new Error('auto on must apply');
}
state = autoOn.state;

const cooldown = mod.applyDirectorCueCommand({
  command: { op: 'apply_cue', trigger: 'roll', manual: false, nowMs: 2500 },
  previous: state,
});
if (!cooldown.ok || cooldown.applied !== false || cooldown.reason !== 'cooldown') {
  throw new Error('cooldown must block thrash');
}

const manual = mod.applyDirectorCueCommand({
  command: {
    op: 'apply_cue',
    trigger: 'manual',
    manual: true,
    nowMs: 2600,
    layout: { kind: 'letterbox' },
  },
  previous: state,
});
if (!manual.ok || !manual.applied || manual.state.program.layout.kind !== 'letterbox') {
  throw new Error('manual override must win during cooldown');
}
if (!manual.state.lastManualOverrideAt) {
  throw new Error('manual override timestamp missing');
}

try {
  mod.assertDirectorCannotMutateGameplay('damage');
  throw new Error('must forbid gameplay');
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('Gameplay')) throw err;
}

try {
  mod.assertDirectorCueAccess({
    role: 'viewer',
    capabilities: [],
    characterId: null,
  });
  throw new Error('viewer without director must fail');
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('Cue')) throw err;
}

mod.assertDirectorCueAccess({
  role: 'viewer',
  capabilities: ['director'],
  characterId: null,
});

console.log('director-runtime-cues-check: PASS');
