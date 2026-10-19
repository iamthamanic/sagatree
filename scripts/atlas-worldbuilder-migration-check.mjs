#!/usr/bin/env node
/**
 * atlas-worldbuilder-migration-check — dry-run + gate (#723 / #753).
 * Location: scripts/atlas-worldbuilder-migration-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-migration-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-migration.md', ['#723', 'buildMigrationDryRun']);
mustInclude('src/domains/world/hierarchy/migration-plan.ts', [
  'buildMigrationDryRun',
  'review-queue',
  'DONALU_WORLD_PUBLIC_ID',
  'add-placeholder-ancestors',
]);
mustInclude('src/domains/world/hierarchy/world-scoped-inventory.ts', [
  'buildWorldScopedInventory',
  'buildScopedMigrationDryRun',
]);
mustInclude('supabase/migrations/107_atlas_worldbuilder_migration_gate.sql', [
  'atlas_wb_migration_gates',
  'DEFAULT false',
  'atlas_wb_migration_inventory',
]);
mustInclude('scripts/atlas-worldbuilder-migration-dry-run.mjs', [
  '--world=',
  'donalu_places.csv',
  'buildScopedMigrationDryRun',
]);
mustInclude('.qa/evidence/atlas-worldbuilder-migration/dry-run-report.json', [
  'WO-9FFK6',
  'reviewQueue',
  'restorePlan',
]);
mustInclude('.qa/evidence/atlas-worldbuilder-migration/REVIEW_QUEUE.md', [
  'Needs review',
  'Restore plan',
]);

const dryRunReport = JSON.parse(
  readFileSync(join(root, '.qa/evidence/atlas-worldbuilder-migration/dry-run-report.json'), 'utf8'),
);
if (JSON.stringify(dryRunReport).includes('sample:')) {
  fail('legacy dry-run evidence must not contain sample:* ids after #753');
}
if (dryRunReport.items?.some((item) => String(item.id).startsWith('WO-'))) {
  fail('place/map item ids must be UUIDs, not world public ids WO-*');
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-migration-check-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const build = spawnSync(
  esbuild,
  [
    'src/domains/world/hierarchy/migration-plan.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const report = mod.buildMigrationDryRun({
  worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
  places: [
    { id: 'a', kind: 'settlement', name: 'Dornhain', parentPlaceId: null },
    { id: 'b', kind: 'dungeon', name: 'Krypta', parentPlaceId: 'x' },
    { id: 'c', kind: 'building', name: 'Festung', parentPlaceId: 'y' },
  ],
  maps: [{ id: 'm1', kind: 'world', parentMapId: null, title: 'Welt' }],
});
if (report.summary.addPlaceholders < 1) fail('orphan settlement must request placeholders');
if (!report.reviewQueue.some((r) => r.legacyKind === 'dungeon')) {
  fail('dungeon must enter review queue');
}
if (report.reviewQueue.some((r) => r.legacyKind === 'building' && r.action === 'review-queue')) {
  fail('canonical building must not be review-queued');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-migration-check.mjs')) {
  fail('test-gate must invoke migration check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-migration-check: OK');
