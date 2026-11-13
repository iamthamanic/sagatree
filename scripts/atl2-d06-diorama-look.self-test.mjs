#!/usr/bin/env node
/**
 * ATL2-D06 — Fantasy diorama look (buildings, vegetation, light profiles).
 * Location: scripts/atl2-d06-diorama-look.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const look = jiti(join(root, 'src/domains/world/atlas/atlas-diorama-look.ts'));
const golden = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d06.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d06-diorama-look.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const hostSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-d06'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-02'));
assert.ok(design.includes('custom WebGL'));
assert.ok(gate.includes('atl2-d06-diorama-look.self-test.mjs'));
assert.ok(indexSrc.includes('buildAtlasDioramaLookPlan'));
assert.ok(runtimeSrc.includes('dioramaLight'));
assert.ok(runtimeSrc.includes('productHousePalette'));
assert.ok(runtimeSrc.includes('uFogDensity'));
assert.ok(hostSrc.includes('resolveAtlasDioramaLightProfile'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');

const empty = look.buildAtlasDioramaLookPlan(canvas.emptyUnifiedCanvasDoc(false), {
  graphicsPresetId: 'high',
});
assert.equal(empty.format, look.ATLAS_DIORAMA_LOOK_FORMAT);
assert.equal(empty.counts.instances, 0);
assert.equal(empty.batches.length, 0);

const dornhain = golden.buildGoldenDornhainCanvas();
const planHigh = look.buildAtlasDioramaLookPlan(dornhain, { graphicsPresetId: 'high' });
const planLite = look.buildAtlasDioramaLookPlan(dornhain, { graphicsPresetId: 'lite' });

assert.ok(planHigh.counts.houses >= 2, 'Dornhain houses');
assert.ok(planHigh.counts.trees >= 2, 'Dornhain vegetation');
assert.ok(planHigh.counts.rocks >= 1, 'Dornhain rocks');
assert.ok(planHigh.counts.streets >= 1, 'Dornhain streets');
assert.ok(planHigh.batches.length >= 2, 'instance batches');
assert.ok(look.atlasDioramaLookPlanIsCanonicalOnly(planHigh));

const houseVariants = new Set(
  planHigh.batches.filter((b) => b.kind === 'house' || b.kind === 'tower').map((b) => b.variant),
);
assert.ok(houseVariants.size >= 2, `distinct house/tower variants, got ${[...houseVariants]}`);

const treeVariants = new Set(
  planHigh.batches.filter((b) => b.kind === 'tree').map((b) => b.variant),
);
assert.ok(treeVariants.size >= 2, `tree variants, got ${[...treeVariants]}`);

assert.equal(planHigh.light.detailLevel, 'full');
assert.equal(planLite.light.detailLevel, 'minimal');
assert.ok(planLite.light.fogDensity === 0);
assert.ok(planHigh.materials.length >= 3);

const timber = look.buildAtlasDioramaMeshRecipe('haus', 'g.tavern', 'full');
const plaster = look.buildAtlasDioramaMeshRecipe('haus', 'g.market', 'full');
assert.notEqual(timber.variant, plaster.variant);
assert.ok(timber.includeFacades);
assert.ok(timber.windowAlbedo);
assert.equal(look.buildAtlasDioramaMeshRecipe('haus', 'x', 'minimal').includeFacades, false);

const litePreset = target.resolveAtlasGraphicsPreset('lite');
assert.equal(litePreset.preferSoftwareFallback, true);

/* Codex P2: overflowing stamp/variant batches must split, not drop objects. */
const overflowN = look.resolveAtlasDioramaLightProfile('lite').maxInstancesPerBatch + 12;
const overflowDoc = canvas.emptyUnifiedCanvasDoc(false);
overflowDoc.objects.push(
  ...Array.from({ length: overflowN }, (_, i) => ({
    id: `tanne.overflow.${i}`,
    type: 'tanne',
    x: i,
    y: 0,
  })),
);
const overflowPlan = look.buildAtlasDioramaLookPlan(overflowDoc, { graphicsPresetId: 'lite' });
assert.equal(overflowPlan.counts.trees, overflowN);
assert.equal(overflowPlan.counts.instances, overflowN);
assert.ok(overflowPlan.batches.length >= 2, 'overflow must create split batches');
assert.ok(
  overflowPlan.batches.every((b) => b.instanceIds.length <= look.resolveAtlasDioramaLightProfile('lite').maxInstancesPerBatch),
);

const writeEvidence = process.env.ATL2_D06_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-d06-out-'));

writeFileSync(
  join(outDir, 'atl2-d06-diorama-look.md'),
  `# ATL2-D06 diorama look\n\n- Verdict: CLEAR\n- Houses: ${planHigh.counts.houses}\n- Trees: ${planHigh.counts.trees}\n- Batches: ${planHigh.counts.batches}\n- House variants: ${[...houseVariants].join(', ')}\n- Tree variants: ${[...treeVariants].join(', ')}\n`,
);
writeFileSync(
  join(outDir, 'atl2-d06-diorama-look.json'),
  JSON.stringify(
    {
      verdict: 'CLEAR',
      houses: planHigh.counts.houses,
      trees: planHigh.counts.trees,
      rocks: planHigh.counts.rocks,
      batches: planHigh.counts.batches,
      houseVariants: [...houseVariants],
      treeVariants: [...treeVariants],
      lightHigh: planHigh.light.presetId,
      lightLiteDetail: planLite.light.detailLevel,
      productTarget: target.ATLAS_PRODUCT_3D_TARGET,
    },
    null,
    2,
  ),
);

console.log('atl2-d06-diorama-look self-test: PASS (CLEAR)');
console.log(
  `report: ${join(outDir, 'atl2-d06-diorama-look.md')}${writeEvidence ? '' : ' (transient)'}`,
);
