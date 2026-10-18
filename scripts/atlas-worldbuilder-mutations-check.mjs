#!/usr/bin/env node
/**
 * atlas-worldbuilder-mutations-check — rename/reparent/duplicate/archive (#716).
 * Location: scripts/atlas-worldbuilder-mutations-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-mutations-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-mutations.md', ['#716', 'rename_world_node']);
mustInclude('supabase/migrations/104_atlas_worldbuilder_mutations.sql', [
  'rename_world_node',
  'reparent_world_node',
  'duplicate_world_node',
  'archive_world_node_subtree',
  'delete_world_node',
  'preview_world_node_consequences',
  'confirmation required',
  'invalid parent kind edge',
  'cycle',
  'current_user_can_edit_world_profile',
]);
mustInclude('src/domains/world/hierarchy/mutations.ts', [
  'planRenameStatus',
  'planReparent',
  'wouldCreateReparentCycle',
  'buildMutationConsequences',
]);
mustInclude('src/infrastructure/world/world-place-service.ts', [
  'renameNode',
  'reparentNode',
  'duplicateNode',
  'archiveNodeSubtree',
  'deleteNode',
  'previewNodeConsequences',
  'assertSupabaseJwtSession',
]);

const svc = readFileSync(join(root, 'src/infrastructure/world/world-place-service.ts'), 'utf8');
if (/['"`]service_role['"`]/.test(svc) || /\bservice_role\s*:/.test(svc)) {
  fail('world-place-service must not use service_role credentials');
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'world-mutations-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/hierarchy/mutations.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);

const renamed = mod.planRenameStatus('placeholder', 'Nordreich');
if (!renamed.ok || renamed.status !== 'draft') fail('placeholder rename must → draft');

const bad = mod.planReparent({
  childKind: 'place',
  childId: 'a',
  newParentId: 'b',
  newParentKind: 'building',
  childDescendantIds: [],
});
if (bad.ok) fail('place under building must fail');

const cycle = mod.planReparent({
  childKind: 'building',
  childId: 'parent',
  newParentId: 'child',
  newParentKind: 'place',
  childDescendantIds: ['child'],
});
if (cycle.ok) fail('cycle must fail');

const ok = mod.planReparent({
  childKind: 'building',
  childId: 'b1',
  newParentId: 'p1',
  newParentKind: 'place',
  childDescendantIds: [],
});
if (!ok.ok || !ok.requiresRelocate) fail('valid reparent must require relocate');

const cons = mod.buildMutationConsequences({ childCount: 2, sagaBindingCount: 1 });
if (!cons.requiresConfirm) fail('consequences must require confirm');

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-mutations-check.mjs')) {
  fail('test-gate must invoke atlas-worldbuilder-mutations-check.mjs');
}

console.log('atlas-worldbuilder-mutations-check: OK');
