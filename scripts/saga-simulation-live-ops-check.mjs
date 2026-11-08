#!/usr/bin/env node
/**
 * saga-simulation-live-ops-check — #577 ops, hook, GM panel, patch builder.
 * Location: scripts/saga-simulation-live-ops-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Saga simulation live ops check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'archive/supabase-legacy/supabase/migrations/065_saga_simulation_ops.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);
const migration = read(migrationPath);
requireMatch(migration, /apply_simulation_batch/i, 'apply_simulation_batch');
requireMatch(migration, /advance_time/i, 'advance_time');
requireMatch(migration, /set_party_location/i, 'set_party_location');
requireMatch(migration, /simulationPatch/i, 'simulationPatch');
requireMatch(migration, /sagadrive_ensure_adventure_v2/i, 'ensure v2');
requireMatch(migration, /days muss zwischen 1 und 30/i, 'days bounds');

const domain = read('src/domains/session/contracts/adventure-runtime-state.ts');
requireMatch(domain, /apply_simulation_batch/i, 'domain op');
requireMatch(domain, /readAdventureRuntimeV2/i, 'read v2');

const hook = read('src/app/session/hooks/useSagaSimulation.ts');
requireMatch(hook, /export function useSagaSimulation/i, 'hook export');
requireMatch(hook, /previewAdvance/i, 'previewAdvance');
requireMatch(hook, /commitPreview/i, 'commitPreview');
requireMatch(hook, /pendingPreview/i, 'pendingPreview');
requireMatch(hook, /useState|useRef/i, 'allowed hooks');
if (/\buseCallback\b|\buseMemo\b/.test(hook)) fail('hook must not use useCallback/useMemo');

const panel = read('src/app/session/SagaSimulationGmPanel.tsx');
requireMatch(panel, /data-saga-simulation-gm-panel/i, 'panel marker');
requireMatch(panel, /data-saga-simulation-commit/i, 'commit CTA');
requireMatch(panel, /data-au-surface="journey"/i, 'AU surface');
requireMatch(panel, /min-h-11/i, 'Fitts targets');

const live = read('src/app/session/GamemasterLiveScreen.tsx');
requireMatch(live, /SagaSimulationGmPanel/i, 'mounted in live');

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('065_saga_simulation_ops.sql')) fail('apply-migrations must list 065');

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-simulation-live-ops-check.mjs')) {
  fail('test-gate must invoke saga-simulation-live-ops-check.mjs');
}

const touched = [hook, panel, domain, read('src/domains/saga/simulation/build-simulation-patch.ts')];
for (const content of touched) {
  if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(content)) {
    fail('type escape hatch');
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-simulation-live-ops-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'sim.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/saga/simulation/index.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);
const result = mod.advanceTime({
  state: mod.miniSagaV1State(),
  definition: mod.MINI_SAGA_SIMULATION,
  days: 2,
  seed: 11,
});
const preview = mod.buildSimulationPreview({
  days: 2,
  result,
  batchId: 'test-batch',
});
if (!preview.patch.time || preview.patch.time.day !== 2) fail('patch day');
if (!Array.isArray(preview.appendConsequences)) fail('appendConsequences');
const cmdModOut = join(cacheDir, 'cmd.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/adventure-runtime-state.ts')],
  outfile: cmdModOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const cmd = await import(pathToFileURL(cmdModOut).href);
const parsed = cmd.parseAdventureRuntimeCommand({
  op: 'apply_simulation_batch',
  days: 2,
  batchId: 'b1',
  simulationPatch: preview.patch,
  appendConsequences: preview.appendConsequences,
});
if (parsed.op !== 'apply_simulation_batch') fail('parse op');
if (!parsed.simulationPatch) fail('parse patch');

console.log('Saga simulation live ops check passed.');
