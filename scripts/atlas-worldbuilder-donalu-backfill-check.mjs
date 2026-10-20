#!/usr/bin/env node
/**
 * atlas-worldbuilder-donalu-backfill-check — staging apply contracts (#754).
 * Location: scripts/atlas-worldbuilder-donalu-backfill-check.mjs
 *
 * Static + evidence proof. Does not write to production DB.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-donalu-backfill-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-followup-donalu-backfill.md', [
  '#754',
  'STAGING_APPLY',
  'PRODUCTION_APPLY_APPROVED',
  'atlas_wb_migration_apply',
]);

mustInclude('supabase/migrations/108_atlas_worldbuilder_migration_apply.sql', [
  'atlas_wb_migration_apply',
  'atlas_wb_migration_identity_snapshot',
  'atlas_wb_migration_rollback_batch',
  'atlas_wb_migration_apply_batches',
  'STAGING_APPLY',
  'PRODUCTION_APPLY_APPROVED',
  'mig.ph.continent.',
  'migration gate disabled',
]);

mustInclude('scripts/atlas-worldbuilder-migration-apply.mjs', [
  '--target=staging',
  '--allow-production',
  'refusing production without --allow-production',
  'atlas_wb_migration_apply',
  'ROLLBACK_BATCH',
  'WO-9FFK6',
]);

mustInclude('.qa/evidence/atlas-followup-donalu-backfill/backfill-report.json', [
  'WO-9FFK6',
  'continent>country>settlement',
  '"productionMigrated": false',
  '"sagaBindingsUnchanged": true',
  '"rollbackProven": true',
  '"idempotentSecondApplyCreatedPlaces": 0',
]);

mustInclude('.qa/evidence/atlas-followup-donalu-backfill/PRODUCTION_GATE.md', [
  'NOT migrated',
  '--allow-production',
]);

mustInclude('.qa/evidence/atlas-followup-donalu-backfill/REPORT.md', [
  'Idempotent',
  'Rollback proven',
  'Production migrated: **no**',
]);

const report = JSON.parse(
  readFileSync(join(root, '.qa/evidence/atlas-followup-donalu-backfill/backfill-report.json'), 'utf8'),
);
if (report.productionMigrated !== false) fail('evidence must not claim production migrated');
if (report.summary?.idempotentSecondApplyCreatedPlaces !== 0) {
  fail('idempotent re-apply must create 0 places');
}
if (!report.summary?.rollbackProven) fail('rollback must be proven in evidence');
if ((report.summary?.invalidParentEdges || []).length > 0) {
  fail('invalid parent edges in evidence');
}
if ((report.summary?.duplicatePrimaryMaps || []).length > 0) {
  fail('duplicate primary maps in evidence');
}
if ((report.summary?.addedPlaceIds || []).length < 2) {
  fail('expected at least continent+country additive places');
}

// Refuse path: script must hard-fail production without flag (static).
const applySrc = readFileSync(join(root, 'scripts/atlas-worldbuilder-migration-apply.mjs'), 'utf8');
if (!applySrc.includes("args.target === 'production' && !args.allowProduction")) {
  fail('production refusal guard missing');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-donalu-backfill-check.mjs')) {
  fail('test-gate must invoke donalu backfill check');
}

console.log('atlas-worldbuilder-donalu-backfill-check: OK');
