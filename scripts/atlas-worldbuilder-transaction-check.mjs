#!/usr/bin/env node
/**
 * atlas-worldbuilder-transaction-check — create-with-maps domain + migration (#715).
 * Location: scripts/atlas-worldbuilder-transaction-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-transaction-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-transaction.md', ['#715', 'create_world_node_with_maps']);
mustInclude('supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql', [
  'create_world_node_with_maps',
  'world_node_create_idempotency',
  'usage = \'primary\'',
  'atlas_wb_create_primary_map',
  'atlas_wb_kind_rank',
  'atlas_wb_tip_satisfies',
  'invalid parent kind edge',
  'unlocated',
  'do NOT copy parent bounds',
  'current_user_can_edit_world_profile',
  "'country', 'place', 'room'",
  'placeholder',
]);
mustInclude('src/domains/world/hierarchy/create-plan.ts', [
  'planWorldNodeCreate',
  'Wird zusätzlich angelegt',
]);
mustInclude('src/infrastructure/world/world-place-service.ts', [
  'createNodeWithMaps',
  'create_world_node_with_maps',
  'assertSupabaseJwtSession',
]);
mustInclude('src/domains/world/places/world-place.types.ts', [
  "'country'",
  "'place'",
  "'room'",
  "'placeholder'",
  "'primary'",
]);

const svc = readFileSync(join(root, 'src/infrastructure/world/world-place-service.ts'), 'utf8');
if (/service_role/.test(svc)) fail('world-place-service must not reference service_role');

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'world-create-plan-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/hierarchy/create-plan.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const plan = mod.planWorldNodeCreate({
  childKind: 'room',
  childName: 'Höhlenkammer',
  existingTipKind: null,
});
if (!plan.ok) fail(`plan failed: ${plan.reason}`);
if (plan.steps.length !== 5) fail(`expected 5 steps, got ${plan.steps.length}`);
if (plan.steps.filter((s) => s.role === 'ancestor_placeholder').length !== 4) {
  fail('expected 4 ancestors');
}
if (!plan.previewLinesDe[0]?.includes('Wird zusätzlich angelegt')) {
  fail('missing DE preview');
}

const bad = mod.planWorldNodeCreate({
  childKind: 'place',
  childName: 'X',
  existingTipKind: 'building',
});
if (bad.ok) fail('place under building tip must fail');

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-transaction-check.mjs')) {
  fail('test-gate must invoke atlas-worldbuilder-transaction-check.mjs');
}

console.log('atlas-worldbuilder-transaction-check: OK');
