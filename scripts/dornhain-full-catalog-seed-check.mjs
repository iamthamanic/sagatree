#!/usr/bin/env node
/**
 * dornhain-full-catalog-seed-check — #618 Phase 3 Dornhain bindings + Welt UI.
 * Location: scripts/dornhain-full-catalog-seed-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Dornhain full catalog seed check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

const migrationPath = 'supabase/migrations/076_dornhain_full_catalog_seed.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);

const migration = read(migrationPath);
requireMatch(migration, /seed_dornhain_catalog_bindings/, 'seed function');
requireMatch(migration, /asset_kind, asset_id, reveal/, 'bindings insert');
requireMatch(migration, /'character'/, 'character bindings');
requireMatch(migration, /'npc'/, 'npc bindings');
requireMatch(migration, /'item'/, 'item bindings');
requireMatch(migration, /'quest'/, 'quest bindings');
requireMatch(migration, /'map'/, 'map bindings');
requireMatch(migration, /'location'/, 'location bindings');
requireMatch(migration, /'lore'/, 'lore bindings');
requireMatch(migration, /'gm_only'/, 'gm_only reveal mix');
requireMatch(migration, /'party'/, 'party reveal mix');
requireMatch(migration, /world_maps/, 'world map seed');
requireMatch(migration, /ensure_native_starter_project/, 'ensure hook');
requireMatch(migration, /immutable/, 'native immutable metadata');

mustInclude(
  'scripts/apply-migrations.sh',
  ['076_dornhain_full_catalog_seed.sql'],
  'apply-migrations',
);

mustInclude(
  'src/app/project/SagaWorldMapPanel.tsx',
  ['data-saga-world-map', 'WorldAtlasWorkbench'],
  'Welt Karte → Unified Atlas',
);

mustInclude(
  'src/app/project/SagaResourceScreen.tsx',
  ['SagaWorldMapPanel'],
  'world section wiring',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('dornhain-full-catalog-seed-check.mjs')) {
  fail('test-gate must invoke dornhain-full-catalog-seed-check.mjs');
}

console.log('Dornhain full catalog seed check passed.');
