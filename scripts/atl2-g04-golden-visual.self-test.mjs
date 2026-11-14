#!/usr/bin/env node
/**
 * ATL2-G04 — golden visual regression fixtures / art-direction (#1232).
 * Location: scripts/atl2-g04-golden-visual.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g04.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g04.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const visualSrc = readFileSync(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-g04'));
assert.ok(acceptance.includes('#1232'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('fingerprint'));
assert.ok(composition.includes('CLEAR'));
assert.ok(gate.includes('atl2-g04-golden-visual.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_GOLDEN_VISUAL_FIXTURES'));
assert.ok(indexSrc.includes('evaluateAtlasGoldenArtDirection'));
assert.ok(visualSrc.includes('ATLAS_GOLDEN_VISUAL_TOLERANCE'));
assert.ok(visualSrc.includes('diorama-oblique'));
assert.ok(!visualSrc.includes(' as any'));
assert.ok(!visualSrc.includes('@ts-ignore'));
assert.ok(!visualSrc.includes('@ts-expect-error'));
assert.ok(!visualSrc.includes("from 'three'") && !visualSrc.includes('from "three"'));

const gv = jiti(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(gv.ATLAS_GOLDEN_VISUAL_FIXTURES.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_SCALE_IDS.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode, 'fingerprint-exact');
assert.ok(gv.atlasGoldenVisualFixturesCoverHierarchy());

const snapshots = [];
for (const fixture of gv.ATLAS_GOLDEN_VISUAL_FIXTURES) {
  const snap = gv.buildAtlasGoldenVisualSnapshot(fixture);
  assert.equal(snap.format, 'atl2-golden-visual-v1');
  assert.equal(snap.fixtureId, fixture.id);
  assert.equal(snap.cameraFingerprint.length, 8);
  assert.ok(snap.materialKeys.length + snap.lookAlbedos.length >= 2, fixture.id);
  assert.ok(snap.selectionContrastRatio >= 3, `${fixture.id} contrast`);
  const again = gv.buildAtlasGoldenVisualSnapshot(fixture);
  const cmp = gv.compareAtlasGoldenVisualSnapshots(snap, again);
  assert.equal(cmp.ok, true, `${fixture.id}: ${cmp.reason}`);
  snapshots.push({
    id: snap.fixtureId,
    fp: snap.contentFingerprint,
    materials: snap.materialKeys.length,
    albedos: snap.lookAlbedos.length,
  });
}

const ids = new Set(snapshots.map((s) => s.id));
assert.equal(ids.size, 6);
assert.ok(ids.has('world') && ids.has('room'));

const report = gv.evaluateAtlasGoldenArtDirection();
assert.equal(report.allPass, true, JSON.stringify(report.checks));
assert.ok(report.detailDegrades);
assert.ok(report.outdoorCanonicalOnly);
assert.ok(report.selectionContrastRatio >= 3);

const contrast = gv.atlasGoldenContrastRatio(
  gv.ATLAS_GOLDEN_SELECTION_OUTLINE,
  gv.ATLAS_GOLDEN_SELECTION_SURFACE,
);
assert.ok(contrast >= 3);

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-g04',
    issue: 1232,
    fixtures: snapshots,
    artDirection: report.checks,
    tolerance: gv.ATLAS_GOLDEN_VISUAL_TOLERANCE,
    target: target.ATLAS_PRODUCT_3D_TARGET,
  }),
);
