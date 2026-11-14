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
assert.ok(indexSrc.includes('ATLAS_GOLDEN_VISUAL_BASELINES'));
assert.ok(indexSrc.includes('evaluateAtlasGoldenArtDirection'));
assert.ok(visualSrc.includes('ATLAS_GOLDEN_VISUAL_TOLERANCE'));
assert.ok(visualSrc.includes('atlasGoldenSpatialGeometryFingerprint'));
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
assert.equal(gv.ATLAS_GOLDEN_VISUAL_BASELINES.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode, 'fingerprint-exact');
assert.ok(gv.atlasGoldenVisualFixturesCoverHierarchy());

const snapshots = [];
for (const fixture of gv.ATLAS_GOLDEN_VISUAL_FIXTURES) {
  const snap = gv.buildAtlasGoldenVisualSnapshot(fixture);
  assert.equal(snap.format, 'atl2-golden-visual-v1');
  assert.equal(snap.fixtureId, fixture.id);
  assert.equal(snap.cameraFingerprint.length, 8);
  const canvasDistinct = new Set(snap.materialKeys).size;
  const albedoDistinct = new Set(snap.lookAlbedos).size;
  assert.ok(
    canvasDistinct >= 2 || albedoDistinct >= 2,
    `${fixture.id}: need ≥2 canvas materials OR ≥2 look albedos (got ${canvasDistinct}/${albedoDistinct})`,
  );
  assert.ok(snap.selectionContrastRatio >= 3, `${fixture.id} contrast`);

  const baseline = gv.resolveAtlasGoldenVisualBaseline(fixture.id);
  assert.ok(baseline, `${fixture.id} missing committed baseline`);
  const cmp = gv.snapshotMatchesGoldenBaseline(snap, baseline);
  assert.equal(cmp.ok, true, `${fixture.id} vs baseline: ${cmp.reason} exp=${cmp.expected} act=${cmp.actual}`);

  /* Spatial regression: move one object → geometry fingerprint must change. */
  if (fixture.lookFamily === 'outdoor') {
    const doc = fixture.buildCanvas();
    const moved = {
      ...doc,
      objects: doc.objects.map((o, i) =>
        i === 0 ? { ...o, x: o.x + 17.5, y: o.y + 9.25 } : o,
      ),
    };
    const before = gv.atlasGoldenSpatialGeometryFingerprint(doc);
    const after = gv.atlasGoldenSpatialGeometryFingerprint(moved);
    assert.notEqual(before, after, `${fixture.id} spatial fingerprint ignores object move`);
  } else {
    const doc = fixture.buildCanvas();
    const moved = {
      ...doc,
      rooms: doc.rooms.map((r, i) => (i === 0 ? { ...r, x: r.x + 11, w: r.w + 3 } : r)),
    };
    const before = gv.atlasGoldenSpatialGeometryFingerprint(doc);
    const after = gv.atlasGoldenSpatialGeometryFingerprint(moved);
    assert.notEqual(before, after, `${fixture.id} spatial fingerprint ignores room move`);
  }

  snapshots.push({
    id: snap.fixtureId,
    fp: snap.contentFingerprint,
    materials: snap.materialKeys.length,
    albedos: snap.lookAlbedos.length,
  });
}

/* Full-field compare must fail when only lightFingerprint drifts. */
{
  const fixture = gv.resolveAtlasGoldenVisualFixture('city');
  const snap = gv.buildAtlasGoldenVisualSnapshot(fixture);
  const drifted = { ...snap, lightFingerprint: 'deadbeef' };
  const cmp = gv.compareAtlasGoldenVisualSnapshots(snap, drifted);
  assert.equal(cmp.ok, false);
  assert.equal(cmp.reason, 'lightFingerprint mismatch');
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
    baselines: gv.ATLAS_GOLDEN_VISUAL_BASELINES.length,
    target: target.ATLAS_PRODUCT_3D_TARGET,
  }),
);
