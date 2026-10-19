#!/usr/bin/env node
/**
 * atlas-worldbuilder-migration-dry-run — world-scoped Donalu inventory (#753 / #723).
 * Location: scripts/atlas-worldbuilder-migration-dry-run.mjs
 *
 * Requires --world=WO-9FFK6|uuid. Loads Donalu-only evidence rows (read-only).
 * Never merges all-world orphan_places or synthetic sample:* IDs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evid = join(root, '.qa/evidence/atlas-worldbuilder-evidence/sql');
const outDir = join(root, '.qa/evidence/atlas-followup-real-donalu-inventory');
const legacyOutDir = join(root, '.qa/evidence/atlas-worldbuilder-migration');

function fail(msg) {
  console.error(`atlas-worldbuilder-migration-dry-run failed: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  let world = null;
  for (const arg of argv) {
    if (arg.startsWith('--world=')) {
      world = arg.slice('--world='.length).trim();
    }
  }
  return { world };
}

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isWorldPublicId(value) {
  return /^WO-[A-Z0-9]+$/i.test(value);
}

const { world: worldArg } = parseArgs(process.argv.slice(2));
if (!worldArg) {
  fail('missing required --world=WO-9FFK6|<world_profile_uuid>');
}
if (!isWorldPublicId(worldArg) && !isUuid(worldArg)) {
  fail(`invalid --world=${worldArg} (expected WO-* or UUID)`);
}

const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
mkdirSync(join(root, '.qa/tmp'), { recursive: true });
const bundle = join(root, '.qa/tmp', 'atlas-world-scoped-inventory-bundle.mjs');
const build = spawnSync(
  esbuild,
  [
    'src/domains/world/hierarchy/world-scoped-inventory.ts',
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

const scope = isUuid(worldArg)
  ? { worldProfileId: worldArg }
  : { worldPublicId: worldArg.toUpperCase() };

const isDonaluPublic =
  scope.worldPublicId === mod.DONALU_WORLD_PUBLIC_ID ||
  worldArg.toUpperCase() === mod.DONALU_WORLD_PUBLIC_ID;

if (!isDonaluPublic && !scope.worldProfileId) {
  fail(`evidence dry-run currently supports Donalu ${mod.DONALU_WORLD_PUBLIC_ID} (or UUID)`);
}

const worldPublicId = scope.worldPublicId ?? mod.DONALU_WORLD_PUBLIC_ID;

const donaluPlaces = parseCsv(readFileSync(join(evid, 'donalu_places.csv'), 'utf8'));
const donaluMaps = parseCsv(readFileSync(join(evid, 'donalu_maps.csv'), 'utf8'));
const sagaSa = parseCsv(readFileSync(join(evid, 'saga_sa.csv'), 'utf8'));
const sagaLocations = parseCsv(readFileSync(join(evid, 'saga_locations.csv'), 'utf8'));

const seedToId = new Map();
for (const row of donaluPlaces) {
  seedToId.set(row.seed_key, row.place_uuid);
}

const places = donaluPlaces.map((row) => ({
  id: row.place_uuid,
  kind: row.kind,
  name: row.name,
  parentPlaceId: row.parent_seed ? (seedToId.get(row.parent_seed) ?? null) : null,
  worldPublicId,
  seedKey: row.seed_key,
  status: row.status || null,
}));

const worldMapId =
  donaluMaps.find((m) => m.kind === 'world')?.map_uuid ?? null;
const settlementMapId =
  donaluMaps.find((m) => m.kind === 'settlement')?.map_uuid ?? null;
const maps = donaluMaps.map((row) => {
  let parentMapId = null;
  if (row.has_parent === 't') {
    if (row.kind === 'settlement') parentMapId = worldMapId;
    else if (row.title.includes('Taverne')) parentMapId = settlementMapId;
    else parentMapId = worldMapId;
  }
  return {
    id: row.map_uuid,
    kind: row.kind,
    title: row.title,
    parentMapId,
    worldPublicId,
  };
});

/** Primary-map / usage edges from #713 Donalu seed inventory (UUID-backed). */
const LINK_SPECS = [
  { placeSeed: 'place.dornhain', mapTitle: 'Dornhain Übersicht (Unified)', usage: 'overview' },
  { placeSeed: 'place.dornhain', mapTitle: 'Dornhain (Stadt)', usage: 'footprint' },
  { placeSeed: 'loc.tavern', mapTitle: 'Dornhain (Stadt)', usage: 'footprint' },
  { placeSeed: 'loc.tavern', mapTitle: 'Taverne Zum Flüstern (Innenraum)', usage: 'interior' },
  { placeSeed: 'loc.market', mapTitle: 'Dornhain (Stadt)', usage: 'footprint' },
  { placeSeed: 'loc.woods', mapTitle: 'Dornhain Übersicht (Unified)', usage: 'overview' },
  { placeSeed: 'loc.crypt', mapTitle: 'Dornhain Übersicht (Unified)', usage: 'entrance' },
  { placeSeed: 'loc.crypt', mapTitle: 'Krypta unter dem Hügel (Dungeon)', usage: 'dungeon' },
  { placeSeed: 'loc.bandit-camp', mapTitle: 'Dornhain Übersicht (Unified)', usage: 'overview' },
];

const mapByTitle = new Map(donaluMaps.map((m) => [m.title, m.map_uuid]));
const links = [];
for (const spec of LINK_SPECS) {
  const placeId = seedToId.get(spec.placeSeed);
  const mapId = mapByTitle.get(spec.mapTitle);
  if (!placeId || !mapId) continue;
  links.push({
    placeId,
    mapId,
    usage: spec.usage,
    worldPublicId,
  });
}

const sagas = sagaSa
  .filter((row) => row.world_public_id === worldPublicId)
  .map((row) => ({
    sagaPublicId: row.saga_public_id,
    sagaName: row.saga_name,
    worldPublicId: row.world_public_id,
    bindingCount: Number(row.binding_count) || 0,
    locationBindings: sagaLocations.map((loc) => ({
      assetId: loc.asset_id,
      label: loc.label,
      reveal: loc.reveal,
      placeSeed: loc.place_seed || null,
      placeId: loc.place_seed ? (seedToId.get(loc.place_seed) ?? null) : null,
    })),
  }));

const { inventory, migration } = mod.buildScopedMigrationDryRun({
  scope: { worldPublicId },
  places,
  maps,
  links,
  sagas,
  generatedAt: new Date().toISOString(),
});

function assertNoSample(obj) {
  const json = JSON.stringify(obj);
  if (json.includes('sample:')) {
    fail('report contains forbidden synthetic sample:* ids');
  }
}

assertNoSample(inventory);
assertNoSample(migration);

mkdirSync(outDir, { recursive: true });
mkdirSync(legacyOutDir, { recursive: true });

const reportPayload = {
  worldPublicId: inventory.worldPublicId,
  worldProfileId: inventory.worldProfileId,
  generatedAt: inventory.generatedAt,
  readOnly: true,
  scopeFilter: { worldPublicId },
  summary: inventory.summary,
  places: inventory.places,
  maps: inventory.maps,
  links: inventory.links,
  sagas: inventory.sagas,
  reviewQueue: inventory.reviewQueue,
  migrationSummary: migration.summary,
  migrationItems: migration.items,
  restorePlan: migration.restorePlan,
};

writeFileSync(join(outDir, 'donalu-inventory-report.json'), JSON.stringify(reportPayload, null, 2));
writeFileSync(join(legacyOutDir, 'dry-run-report.json'), JSON.stringify(migration, null, 2));

const reviewMd = [
  '# Donalu world-scoped review queue (#753)',
  '',
  `World: ${inventory.worldPublicId}`,
  `Generated: ${inventory.generatedAt}`,
  `Read-only: true`,
  '',
  '## Summary',
  '',
  '```json',
  JSON.stringify(inventory.summary, null, 2),
  '```',
  '',
  '## Needs review',
  '',
  'Ambiguous kinds — no auto-promote:',
  '',
  ...inventory.reviewQueue.map(
    (r) =>
      `- place \`${r.placeId}\` **${r.name}** kind=\`${r.originalKind}\` parent=\`${r.proposedParentId ?? 'null'}\` — ${r.notes}`,
  ),
  '',
  '## Places (UUID + parent chain + primary map)',
  '',
  ...inventory.places.map(
    (p) =>
      `- \`${p.id}\` ${p.name} kind=\`${p.kind}\` chain=[${p.parentChain.join(' → ') || '∅'}] primaryMap=\`${p.primaryMapId ?? 'none'}\``,
  ),
  '',
  '## Saga bindings',
  '',
  ...inventory.sagas.map(
    (s) =>
      `- \`${s.sagaPublicId}\` ${s.sagaName} bindings=${s.bindingCount ?? 0} locations=${(s.locationBindings ?? []).length}`,
  ),
  '',
  '## Restore plan',
  '',
  ...migration.restorePlan.map((s) => `- ${s}`),
  '',
].join('\n');

writeFileSync(join(outDir, 'REVIEW_QUEUE.md'), reviewMd);
writeFileSync(join(legacyOutDir, 'REVIEW_QUEUE.md'), reviewMd);

writeFileSync(
  join(outDir, 'REPORT.md'),
  [
    '# Evidence — Real Donalu inventory (#753)',
    '',
    `- Scope: \`--world=${worldPublicId}\` (evidence CSVs filtered to Donalu only).`,
    '- Source: `.qa/evidence/atlas-worldbuilder-evidence/sql/donalu_*.csv` + saga bindings.',
    '- No `sample:*` synthetic IDs. No multi-world orphan_places merge.',
    '- Read-only: no DB writes; migration gate remains default-off.',
    '',
    '## Artifacts',
    '',
    '- `donalu-inventory-report.json`',
    '- `REVIEW_QUEUE.md`',
    '',
    '## Proof points',
    '',
    `- placeCount=${inventory.summary.placeCount} (Donalu places only)`,
    `- orphanSettlementCount=${inventory.summary.orphanSettlementCount} (not 38)`,
    `- ambiguousReviewCount=${inventory.summary.ambiguousReviewCount}`,
    `- sagaCount=${inventory.summary.sagaCount}`,
    '',
  ].join('\n'),
);

writeFileSync(
  join(legacyOutDir, 'REPORT.md'),
  [
    '# Evidence — Atlas Worldbuilder Migration (scoped #753 refresh)',
    '',
    '- Dry-run uses world-scoped Donalu inventory (see atlas-followup-real-donalu-inventory).',
    '- Gate table `atlas_wb_migration_gates` defaults **enabled=false**.',
    '- No place/map deletes; no public_id rewrites.',
    '',
  ].join('\n'),
);

console.log(
  JSON.stringify(
    {
      world: inventory.worldPublicId,
      summary: inventory.summary,
      review: inventory.reviewQueue.length,
      out: outDir,
      readOnly: true,
    },
    null,
    2,
  ),
);
