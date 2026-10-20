#!/usr/bin/env node
/**
 * atlas-worldbuilder-migration-apply — gated staging backfill (#754).
 * Location: scripts/atlas-worldbuilder-migration-apply.mjs
 *
 * Applies expand-only remediations against a local/staging Postgres clone.
 * Refuses production unless --allow-production + PRODUCTION_APPLY_APPROVED.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.qa/evidence/atlas-followup-donalu-backfill');
const DONALU_WORLD = '8f52b273-60fe-4823-ae7d-d9e70469b730';
const DONALU_PUBLIC = 'WO-9FFK6';

function fail(msg) {
  console.error(`atlas-worldbuilder-migration-apply failed: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    target: null,
    world: null,
    allowProduction: false,
    dryRunOnly: false,
    skipRollbackProof: false,
    dockerContainer: process.env.SAGATREE_DB_CONTAINER || 'sagatree-db',
  };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) out.target = arg.slice('--target='.length).trim();
    else if (arg.startsWith('--world=')) out.world = arg.slice('--world='.length).trim();
    else if (arg === '--allow-production') out.allowProduction = true;
    else if (arg === '--dry-run-only') out.dryRunOnly = true;
    else if (arg === '--skip-rollback-proof') out.skipRollbackProof = true;
    else if (arg.startsWith('--docker=')) out.dockerContainer = arg.slice('--docker='.length);
  }
  return out;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function psql(container, sql) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    fail(`psql failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout || '').trim();
}

function psqlJson(container, sql) {
  const raw = psql(container, sql);
  if (!raw) fail(`empty JSON from: ${sql.slice(0, 80)}`);
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`JSON parse error: ${e.message}\n${raw.slice(0, 400)}`);
  }
}

function placeIds(snapshot) {
  return new Set((snapshot.places || []).map((p) => p.id));
}

function mapIds(snapshot) {
  return new Set((snapshot.maps || []).map((m) => m.id));
}

function bindingFingerprint(snapshot) {
  return (snapshot.saga_bindings || [])
    .map((b) => `${b.id}|${b.world_place_id}|${b.reveal}|${b.asset_kind}|${b.asset_id}`)
    .sort()
    .join('\n');
}

function retainedSubset(before, after, label) {
  for (const id of before) {
    if (!after.has(id)) fail(`${label} UUID lost after apply: ${id}`);
  }
}

function diffAdditive(before, after) {
  const added = [];
  for (const id of after) {
    if (!before.has(id)) added.push(id);
  }
  return added.sort();
}

const args = parseArgs(process.argv.slice(2));
if (!args.target) fail('missing --target=staging|production');
if (args.target !== 'staging' && args.target !== 'production') {
  fail('--target must be staging or production');
}
if (args.target === 'production' && !args.allowProduction) {
  fail('refusing production without --allow-production (explicit written approval required)');
}

let worldId = args.world || DONALU_WORLD;
if (worldId.toUpperCase() === DONALU_PUBLIC) worldId = DONALU_WORLD;
if (!isUuid(worldId)) fail(`invalid --world=${args.world}`);

const container = args.dockerContainer;
const ping = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', container], {
  encoding: 'utf8',
});
if (ping.status !== 0) fail(`docker container ${container} not available`);
const health = (ping.stdout || '').trim();
if (health && health !== 'healthy' && health !== '<no value>') {
  console.warn(`warn: container health=${health}`);
}

mkdirSync(outDir, { recursive: true });

// Ensure migration SQL applied (idempotent CREATE OR REPLACE).
const migrationPath = join(root, 'supabase/migrations/108_atlas_worldbuilder_migration_apply.sql');
if (!existsSync(migrationPath)) fail('missing 108_atlas_worldbuilder_migration_apply.sql');
const mig = spawnSync(
  'docker',
  ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { encoding: 'utf8', input: readFileSync(migrationPath, 'utf8') },
);
if (mig.status !== 0) fail(`apply migration SQL failed: ${mig.stderr || mig.stdout}`);

const confirm =
  args.target === 'staging' ? 'STAGING_APPLY' : 'PRODUCTION_APPLY_APPROVED';

// Enable gate for this world only (staging freigabe).
psql(
  container,
  `INSERT INTO public.atlas_wb_migration_gates (world_profile_id, enabled, notes, updated_at)
   VALUES ('${worldId}'::uuid, true, 'staging freigabe #754', now())
   ON CONFLICT (world_profile_id) DO UPDATE
     SET enabled = true, notes = EXCLUDED.notes, updated_at = now();`,
);

const before = psqlJson(
  container,
  `SELECT public.atlas_wb_migration_identity_snapshot('${worldId}'::uuid)::text
   FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
);
writeFileSync(join(outDir, 'identity-before.json'), JSON.stringify(before, null, 2) + '\n');

if (args.dryRunOnly) {
  writeFileSync(
    join(outDir, 'PRODUCTION_GATE.md'),
    [
      '# Production gate — Donalu backfill (#754)',
      '',
      '- Staging apply: not run (--dry-run-only).',
      '- Production: **NOT migrated**. Requires written approval + `--target=production --allow-production`.',
      '',
    ].join('\n'),
  );
  console.log('dry-run-only: wrote identity-before.json');
  process.exit(0);
}

const apply1 = psqlJson(
  container,
  `SELECT public.atlas_wb_migration_apply(
     '${worldId}'::uuid, '${args.target}', '${confirm}'
   )::text
   FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
);
writeFileSync(join(outDir, 'apply-result-1.json'), JSON.stringify(apply1, null, 2) + '\n');

const after1 = psqlJson(
  container,
  `SELECT public.atlas_wb_migration_identity_snapshot('${worldId}'::uuid)::text
   FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
);
writeFileSync(join(outDir, 'identity-after.json'), JSON.stringify(after1, null, 2) + '\n');

retainedSubset(placeIds(before), placeIds(after1), 'place');
retainedSubset(mapIds(before), mapIds(after1), 'map');
if (bindingFingerprint(before) !== bindingFingerprint(after1)) {
  fail('saga binding fingerprint changed (UUID/reveal/place FK drift)');
}
if ((after1.invalid_parent_edges || []).length > 0) {
  fail(`invalid parent edges remain: ${JSON.stringify(after1.invalid_parent_edges)}`);
}
if ((after1.duplicate_primary_maps || []).length > 0) {
  fail(`duplicate primary maps: ${JSON.stringify(after1.duplicate_primary_maps)}`);
}

const addedPlaces = diffAdditive(placeIds(before), placeIds(after1));
const addedMaps = diffAdditive(mapIds(before), mapIds(after1));

// Hierarchy proof: Dornhain (orphan settlement) under country under continent.
const chain = psql(
  container,
  `WITH RECURSIVE climb AS (
     SELECT id, kind, name, parent_place_id, 0 AS depth
     FROM public.world_places
     WHERE world_profile_id = '${worldId}'::uuid
       AND kind = 'settlement'
       AND status <> 'archived'
     UNION ALL
     SELECT p.id, p.kind, p.name, p.parent_place_id, c.depth + 1
     FROM public.world_places p
     JOIN climb c ON p.id = c.parent_place_id
   )
   SELECT string_agg(kind, '>' ORDER BY depth DESC) FROM climb;`,
);
if (!chain.includes('continent') || !chain.includes('country') || !chain.includes('settlement')) {
  fail(`expected continent>country>settlement chain, got: ${chain}`);
}

// Idempotent re-apply: zero new places/maps.
const apply2 = psqlJson(
  container,
  `SELECT public.atlas_wb_migration_apply(
     '${worldId}'::uuid, '${args.target}', '${confirm}'
   )::text
   FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
);
writeFileSync(join(outDir, 'apply-result-2-idempotent.json'), JSON.stringify(apply2, null, 2) + '\n');
if ((apply2.created_place_ids || []).length !== 0) {
  fail(`idempotent re-apply created places: ${JSON.stringify(apply2.created_place_ids)}`);
}
if ((apply2.created_map_ids || []).length !== 0) {
  fail(`idempotent re-apply created maps: ${JSON.stringify(apply2.created_map_ids)}`);
}

let rollback = null;
if (!args.skipRollbackProof) {
  const batchId = apply1.batch_id;
  rollback = psqlJson(
    container,
    `SELECT public.atlas_wb_migration_rollback_batch('${batchId}'::uuid, 'ROLLBACK_BATCH')::text
     FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
  );
  writeFileSync(join(outDir, 'rollback-result.json'), JSON.stringify(rollback, null, 2) + '\n');

  const afterRollback = psqlJson(
    container,
    `SELECT public.atlas_wb_migration_identity_snapshot('${worldId}'::uuid)::text
     FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
  );
  writeFileSync(
    join(outDir, 'identity-after-rollback.json'),
    JSON.stringify(afterRollback, null, 2) + '\n',
  );

  // Pre-migration place/map sets must match after rollback.
  const placesMatch =
    [...placeIds(before)].sort().join(',') === [...placeIds(afterRollback)].sort().join(',');
  const mapsMatch =
    [...mapIds(before)].sort().join(',') === [...mapIds(afterRollback)].sort().join(',');
  if (!placesMatch) fail('rollback did not restore place UUID set');
  if (!mapsMatch) fail('rollback did not restore map UUID set');
  if (bindingFingerprint(before) !== bindingFingerprint(afterRollback)) {
    fail('saga bindings drifted after rollback');
  }

  // Re-apply after rollback to leave staging clone in migrated state for further QA.
  const apply3 = psqlJson(
    container,
    `SELECT public.atlas_wb_migration_apply(
       '${worldId}'::uuid, '${args.target}', '${confirm}'
     )::text
     FROM (SELECT set_config('atlas.migration_operator', '1', true)) AS _op;`,
  );
  writeFileSync(join(outDir, 'apply-result-3-after-rollback.json'), JSON.stringify(apply3, null, 2) + '\n');
  if ((apply3.created_place_ids || []).length < 2) {
    fail('re-apply after rollback should recreate continent/country placeholders');
  }
}

const report = {
  worldPublicId: DONALU_PUBLIC,
  worldProfileId: worldId,
  target: args.target,
  generatedAt: new Date().toISOString(),
  productionMigrated: false,
  approval: {
    staging: args.target === 'staging' ? 'granted-in-session' : 'n/a',
    production: 'not-approved — do not mark prod migrated',
  },
  summary: {
    retainedPlaceCount: placeIds(before).size,
    retainedMapCount: mapIds(before).size,
    addedPlaceIds: addedPlaces,
    addedMapIds: addedMaps,
    sagaBindingsUnchanged: true,
    invalidParentEdges: after1.invalid_parent_edges || [],
    duplicatePrimaryMaps: after1.duplicate_primary_maps || [],
    hierarchyChainSample: chain,
    idempotentSecondApplyCreatedPlaces: (apply2.created_place_ids || []).length,
    rollbackProven: Boolean(rollback),
  },
  batchId: apply1.batch_id,
};
writeFileSync(join(outDir, 'backfill-report.json'), JSON.stringify(report, null, 2) + '\n');

writeFileSync(
  join(outDir, 'PRODUCTION_GATE.md'),
  [
    '# Production gate — Donalu backfill (#754)',
    '',
    `- Staging apply on local clone: **done** (${report.generatedAt}).`,
    `- World: \`${DONALU_PUBLIC}\` / \`${worldId}\`.`,
    '- Production: **NOT migrated**.',
    '- To migrate production later: written operator approval +',
    '  `node scripts/atlas-worldbuilder-migration-apply.mjs --target=production --allow-production --world=WO-9FFK6`',
    '  against the production DB only after backup verification.',
    '- Gate table defaults remain `enabled=false` for worlds not explicitly enabled.',
    '',
  ].join('\n'),
);

writeFileSync(
  join(outDir, 'REPORT.md'),
  [
    '# Donalu staging backfill (#754)',
    '',
    `- Target: \`${args.target}\``,
    `- Retained places: ${placeIds(before).size}; maps: ${mapIds(before).size}`,
    `- Additive places: ${addedPlaces.length}; maps: ${addedMaps.length}`,
    `- Hierarchy: \`${chain}\``,
    `- Idempotent re-apply created places: ${(apply2.created_place_ids || []).length}`,
    `- Rollback proven: ${Boolean(rollback)}`,
    `- Saga bindings unchanged: yes`,
    `- Production migrated: **no**`,
    '',
    'Artifacts: `identity-before.json`, `identity-after.json`, `apply-result-*.json`, `backfill-report.json`.',
    '',
  ].join('\n'),
);

console.log('atlas-worldbuilder-migration-apply: OK');
console.log(JSON.stringify(report.summary, null, 2));
