#!/usr/bin/env node
/**
 * saga-permission-grants-check — #617 catalog, grants RPCs, Settings Rechte, Lore.
 * Location: scripts/saga-permission-grants-check.mjs
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
  console.error(`Saga permission grants check failed: ${message}`);
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

const migrationPath = 'archive/supabase-legacy/supabase/migrations/075_saga_permission_grants.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);

const migration = read(migrationPath);
requireMatch(migration, /bundle\.saga\.gm/, 'GM bundle');
requireMatch(migration, /bundle\.saga\.player/, 'player bundle');
requireMatch(migration, /saga\.members\.set_bundle/, 'set_bundle key');
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.has_saga_permission/, 'has_saga_permission');
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.set_saga_member_bundle/, 'set_saga_member_bundle');
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.set_saga_binding_reveal/, 'set_saga_binding_reveal');
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.get_saga_lore_timeline/, 'get_saga_lore_timeline');
requireMatch(migration, /reveal IN \('gm_only', 'party', 'unlisted'\)/, 'reveal check');
requireMatch(migration, /SECURITY DEFINER/i, 'SECURITY DEFINER');
requireMatch(migration, /cannot revoke last saga\.members\.set_bundle/, 'governance invariant');

mustInclude(
  'scripts/apply-migrations.sh',
  ['075_saga_permission_grants.sql'],
  'apply-migrations list',
);

mustInclude(
  'src/domains/saga/permissions/catalog.ts',
  [
    'SAGA_PERMISSION_KEYS',
    'bundle.saga.gm',
    'bundle.saga.player',
    'hasSagaPermission',
    'canListBindingReveal',
  ],
  'permission catalog',
);

mustInclude(
  'src/infrastructure/project/saga-permission-service.ts',
  [
    'fetchHostMySagaPermissions',
    'setHostSagaMemberBundle',
    'setHostSagaBindingReveal',
    'fetchHostSagaLoreTimeline',
    'listHostSagaBindings',
    'isHostLibraryEnabled',
  ],
  'permission service (CUT-20 host HTTP)',
);

mustInclude(
  'src/app/project/SagaPermissionSettings.tsx',
  ['data-saga-rechte', 'setMemberBundle', 'bundle.saga.gm', 'Gamemaster'],
  'Settings Rechte UI',
);

mustInclude(
  'src/app/project/SagaResourceScreen.tsx',
  ['SagaPermissionSettings', 'sagaPublicId={id}'],
  'settings + catalog wiring',
);

mustInclude(
  'src/app/project/SagaLoreTimelinePanel.tsx',
  ['getLoreTimeline', 'data-saga-lore'],
  'Lore panel',
);

mustInclude(
  'src/app/project/SagaBindingRevealControl.tsx',
  ['setBindingReveal', 'gm_only', 'party', 'unlisted'],
  'reveal control',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-permission-grants-check.mjs')) {
  fail('test-gate must invoke saga-permission-grants-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-permission-grants-check');
mkdirSync(cacheDir, { recursive: true });
const catalogOut = join(cacheDir, 'catalog.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/saga/permissions/catalog.ts')],
  outfile: catalogOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(catalogOut).href);
const gm = mod.keysForBundle('bundle.saga.gm');
const player = mod.keysForBundle('bundle.saga.player');
if (gm.length < 30) fail('GM bundle too small');
if (!mod.hasSagaPermission(gm, 'saga.members.set_bundle')) {
  fail('GM must have set_bundle');
}
if (mod.hasSagaPermission(player, 'saga.secrets.reveal')) {
  fail('player must not have secrets.reveal');
}
if (mod.hasSagaPermission(player, 'saga.members.set_bundle')) {
  fail('player must not have set_bundle');
}
if (
  !mod.canListBindingReveal({
    reveal: 'party',
    grants: player,
    assetKind: 'npc',
  })
) {
  fail('player should list party npc');
}
if (
  mod.canListBindingReveal({
    reveal: 'gm_only',
    grants: player,
    assetKind: 'npc',
  })
) {
  fail('player must not list gm_only npc');
}

console.log('Saga permission grants check passed.');
