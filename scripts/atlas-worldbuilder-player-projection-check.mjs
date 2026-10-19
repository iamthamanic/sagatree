#!/usr/bin/env node
/**
 * atlas-worldbuilder-player-projection-check — saga-aware atlas projection (#717).
 * Location: scripts/atlas-worldbuilder-player-projection-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-player-projection-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-worldbuilder-player-projection.md', ['#717', 'fail-closed']);
mustInclude('supabase/migrations/105_atlas_worldbuilder_player_projection.sql', [
  'list_world_atlas_maps',
  'p_saga_public_id',
  'atlas_wb_party_revealed_map_ids',
  'Fail closed',
  'get_world_atlas_map',
  'current_user_can_read_world_atlas_object',
  'parentMapId',
]);
mustInclude('src/infrastructure/world/world-atlas-service.ts', [
  'p_saga_public_id',
  'p_player_view',
  'assertSupabaseJwtSession',
  'createSignedUrl',
]);

const svc = readFileSync(join(root, 'src/infrastructure/world/world-atlas-service.ts'), 'utf8');
if (/['"`]service_role['"`]/.test(svc)) fail('world-atlas-service must not use service_role');

// createSignedUrl must assert JWT (not anonymous signed URL minting)
const signedIdx = svc.indexOf('async createSignedUrl');
if (signedIdx < 0) fail('missing createSignedUrl');
const signedSlice = svc.slice(signedIdx, signedIdx + 280);
if (!signedSlice.includes('assertSupabaseJwtSession')) {
  fail('createSignedUrl must call assertSupabaseJwtSession');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-player-projection-check.mjs')) {
  fail('test-gate must invoke player-projection check');
}

console.log('atlas-worldbuilder-player-projection-check: OK');
