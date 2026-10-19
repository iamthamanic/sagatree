#!/usr/bin/env node
/**
 * atlas-worldbuilder-real-donalu-inventory-check — world-scoped Donalu inventory (#753).
 * Location: scripts/atlas-worldbuilder-real-donalu-inventory-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-real-donalu-inventory-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${JSON.stringify(n)} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-followup-real-donalu-inventory.md', [
  '#753',
  'buildWorldScopedInventory',
  'sample:*',
]);
mustInclude('src/domains/world/hierarchy/world-scoped-inventory.ts', [
  'buildWorldScopedInventory',
  'countOrphanSettlementsForWorld',
  'filterInventoryByWorld',
  'SYNTHETIC_SAMPLE_ID_PREFIX',
  'readOnly',
]);
mustInclude('scripts/atlas-worldbuilder-migration-dry-run.mjs', [
  '--world=',
  'donalu_places.csv',
  'buildScopedMigrationDryRun',
  'sample:',
]);
mustInclude('.qa/evidence/atlas-followup-real-donalu-inventory/donalu-inventory-report.json', [
  'WO-9FFK6',
  'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
  'readOnly',
  'parentChain',
  'primaryMapId',
]);

const reportPath = join(
  root,
  '.qa/evidence/atlas-followup-real-donalu-inventory/donalu-inventory-report.json',
);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (JSON.stringify(report).includes('sample:')) {
  fail('evidence report must not contain sample:* ids');
}
if (report.summary?.orphanSettlementCount !== 1) {
  fail(
    `expected Donalu orphanSettlementCount=1, got ${report.summary?.orphanSettlementCount}`,
  );
}
if (report.summary?.placeCount !== 6) {
  fail(`expected Donalu placeCount=6, got ${report.summary?.placeCount}`);
}
if (!report.reviewQueue?.some((r) => r.originalKind === 'site')) {
  fail('site rows must appear in ambiguous review queue');
}
if (!report.reviewQueue?.some((r) => r.originalKind === 'dungeon')) {
  fail('dungeon rows must appear in ambiguous review queue');
}
if (!report.sagas?.some((s) => s.sagaPublicId === 'SA-E979J')) {
  fail('saga SA-E979J must be bound in Donalu inventory');
}

const dryRunSrc = readFileSync(
  join(root, 'scripts/atlas-worldbuilder-migration-dry-run.mjs'),
  'utf8',
);
if (dryRunSrc.includes("seed_key === 'place.dornhain'")) {
  fail('dry-run must not use permissive seed_key=place.dornhain across all worlds');
}
if (!dryRunSrc.includes('missing required --world=')) {
  fail('dry-run must fail closed without --world');
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-real-donalu-inventory-check-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
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
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);

const orphanCsv = readFileSync(
  join(root, '.qa/evidence/atlas-worldbuilder-evidence/sql/orphan_places.csv'),
  'utf8',
);
const orphanLines = orphanCsv.trim().split(/\r?\n/).slice(1);
const orphans = orphanLines.map((line) => {
  const [worldPublicId, seedKey, kind, name] = line.split(',');
  return { worldPublicId, seedKey, kind, name };
});
if (orphans.length !== 38) {
  fail(`expected 38 orphan world rows in evidence, got ${orphans.length}`);
}
const unscopedInflation = orphans.filter((o) => o.seedKey === 'place.dornhain').length;
if (unscopedInflation !== 38) {
  fail('evidence orphan list should still show 38 place.dornhain rows (anti-regression fixture)');
}
const donaluOrphans = mod.countOrphanSettlementsForWorld(orphans, {
  worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
});
if (donaluOrphans !== 1) {
  fail(`scoped orphan count must be 1 for WO-9FFK6, got ${donaluOrphans}`);
}

const otherWorldPlaces = orphans
  .filter((o) => o.worldPublicId !== mod.DONALU_WORLD_PUBLIC_ID)
  .map((o, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    kind: 'settlement',
    name: o.name,
    parentPlaceId: null,
    worldPublicId: o.worldPublicId,
    seedKey: o.seedKey,
  }));
if (otherWorldPlaces.length !== 37) {
  fail(`expected 37 non-Donalu orphan worlds in bag, got ${otherWorldPlaces.length}`);
}
const donaluOnly = [
  {
    id: 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
    kind: 'settlement',
    name: 'Dornhain',
    parentPlaceId: null,
    worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
    seedKey: 'place.dornhain',
  },
  {
    id: '6f270016-a7b1-4536-a0b0-68df58ef0d8b',
    kind: 'site',
    name: 'Marktplatz Dornhain',
    parentPlaceId: 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
    worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
    seedKey: 'loc.market',
  },
];
const multiWorldBag = {
  scope: { worldPublicId: mod.DONALU_WORLD_PUBLIC_ID },
  places: [...otherWorldPlaces, ...donaluOnly],
  maps: [
    {
      id: '76ca488e-76a4-4753-8dae-43f8b6ce6c43',
      kind: 'world',
      title: 'Dornhain Übersicht (Unified)',
      parentMapId: null,
      worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
    },
  ],
  links: [
    {
      placeId: 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
      mapId: '76ca488e-76a4-4753-8dae-43f8b6ce6c43',
      usage: 'overview',
      worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
    },
  ],
  sagas: [
    {
      sagaPublicId: 'SA-E979J',
      sagaName: 'Das Flüstern unter Dornhain',
      worldPublicId: mod.DONALU_WORLD_PUBLIC_ID,
      bindingCount: 25,
    },
  ],
};
const inventory = mod.buildWorldScopedInventory(multiWorldBag);
if (inventory.summary.placeCount !== 2) {
  fail(`38-world bag must collapse to 2 Donalu places, got ${inventory.summary.placeCount}`);
}
if (inventory.summary.orphanSettlementCount !== 1) {
  fail('foreign-world orphans must not inflate Donalu orphanSettlementCount');
}
if (inventory.places.some((p) => mod.isSyntheticSampleId(p.id))) {
  fail('inventory must not emit synthetic sample ids');
}
const market = inventory.places.find((p) => p.id === '6f270016-a7b1-4536-a0b0-68df58ef0d8b');
if (!market || market.parentChain[0] !== 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d') {
  fail('parent chain must resolve real parent UUID');
}
if (inventory.reviewQueue.length < 1 || inventory.reviewQueue[0].proposedKind !== null) {
  fail('ambiguous site must stay needs-review with proposedKind=null');
}

try {
  mod.buildWorldScopedInventory({
    scope: { worldPublicId: mod.DONALU_WORLD_PUBLIC_ID },
    places: [{ id: 'sample:site', kind: 'site', name: 'x', parentPlaceId: null }],
    maps: [],
  });
  fail('synthetic sample:* place ids must throw');
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('synthetic sample')) {
    fail(`unexpected error for sample id: ${err}`);
  }
}

const missingWorld = spawnSync(
  process.execPath,
  ['scripts/atlas-worldbuilder-migration-dry-run.mjs'],
  { cwd: root, encoding: 'utf8' },
);
if (missingWorld.status === 0) {
  fail('dry-run without --world must exit non-zero');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-real-donalu-inventory-check.mjs')) {
  fail('test-gate must invoke real-donalu-inventory check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-real-donalu-inventory-check: OK');
