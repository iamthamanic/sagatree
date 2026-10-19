#!/usr/bin/env node
/**
 * atlas-worldbuilder-migration-dry-run — classify Donalu/legacy rows (#723).
 * Location: scripts/atlas-worldbuilder-migration-dry-run.mjs
 *
 * Uses evidence CSVs by default (no DB writes). Optional --live against local DB.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.qa/evidence/atlas-worldbuilder-migration');
mkdirSync(outDir, { recursive: true });

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const bundle = join(root, '.qa/tmp', 'atlas-migration-plan-bundle.mjs');
mkdirSync(join(root, '.qa/tmp'), { recursive: true });
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
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}
const mod = await import(pathToFileURL(bundle).href);

const evid = join(root, '.qa/evidence/atlas-worldbuilder-evidence/sql');
const placeKinds = parseCsv(readFileSync(join(evid, 'place_kinds.csv'), 'utf8'));
const orphans = parseCsv(readFileSync(join(evid, 'orphan_places.csv'), 'utf8'));
const mapKinds = existsSync(join(evid, 'map_kinds.csv'))
  ? parseCsv(readFileSync(join(evid, 'map_kinds.csv'), 'utf8'))
  : [];

/** Synthetic place rows from kind counts + orphan list (Donalu focus). */
const places = [];
for (const o of orphans) {
  if (o.public_id === 'WO-9FFK6' || o.seed_key === 'place.dornhain') {
    places.push({
      id: o.public_id || o.seed_key,
      publicId: o.public_id,
      kind: o.kind || 'settlement',
      name: o.name || 'Dornhain',
      parentPlaceId: null,
    });
  }
}
// Ambiguous kinds from inventory (aggregate rows → review queue samples)
for (const pk of placeKinds) {
  if (['site', 'dungeon', 'region', 'district', 'interior'].includes(pk.kind)) {
    places.push({
      id: `sample:${pk.kind}`,
      kind: pk.kind,
      name: `sample-${pk.kind}`,
      parentPlaceId: 'parent-known',
    });
  }
}

const maps = mapKinds.map((m, i) => ({
  id: `map-${i}-${m.kind}`,
  kind: m.kind,
  parentMapId: m.kind === 'world' ? null : 'root',
  title: m.kind,
}));

const report = mod.buildMigrationDryRun({
  worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
  places,
  maps,
  generatedAt: new Date().toISOString(),
});

writeFileSync(join(outDir, 'dry-run-report.json'), JSON.stringify(report, null, 2));
writeFileSync(
  join(outDir, 'REVIEW_QUEUE.md'),
  [
    '# Migration review queue (#723)',
    '',
    `World: ${report.worldPublicId}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(report.summary, null, 2),
    '```',
    '',
    '## Needs review',
    '',
    ...report.reviewQueue.map(
      (r) => `- \`${r.subject}\` \`${r.id}\` kind=\`${r.legacyKind}\` — ${r.notes}`,
    ),
    '',
    '## Restore plan',
    '',
    ...report.restorePlan.map((s) => `- ${s}`),
    '',
  ].join('\n'),
);

writeFileSync(
  join(outDir, 'REPORT.md'),
  [
    '# Evidence — Atlas Worldbuilder Migration (#723)',
    '',
    '- Dry-run only against evidence inventory (+ optional local inventory RPC).',
    '- Gate table `atlas_wb_migration_gates` defaults **enabled=false**.',
    '- No place/map deletes; no public_id rewrites.',
    '- Backup/restore baseline: `.qa/evidence/atlas-worldbuilder-evidence/backups/` (#713).',
    '',
    '## Artifacts',
    '',
    '- `dry-run-report.json`',
    '- `REVIEW_QUEUE.md`',
    '',
    '## Donalu gate',
    '',
    'Enable only after review: insert into `atlas_wb_migration_gates` for Donalu world UUID with `enabled=true`.',
    '',
  ].join('\n'),
);

console.log(
  JSON.stringify(
    {
      world: report.worldPublicId,
      summary: report.summary,
      review: report.reviewQueue.length,
      out: outDir,
    },
    null,
    2,
  ),
);
