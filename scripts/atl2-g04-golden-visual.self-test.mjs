#!/usr/bin/env node
/**
 * ATL2-G04 — golden visual regression fixtures / art-direction (#1232).
 * Location: scripts/atl2-g04-golden-visual.self-test.mjs
 *
 * Requires Browser E2E screenshot contract (toHaveScreenshot) — fingerprints alone FAIL.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g04.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g04.md'), 'utf8');
const fantasyReview = readFileSync(join(root, '.qa/runs/atl2-g04-fantasy-look-review.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const visualSrc = readFileSync(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const e2ePath = join(root, 'e2e/atl2-g04-golden-visual.spec.ts');
assert.ok(existsSync(e2ePath), 'missing e2e/atl2-g04-golden-visual.spec.ts');
const e2eSrc = readFileSync(e2ePath, 'utf8');

assert.ok(acceptance.includes('atl2-g04'));
assert.ok(acceptance.includes('#1232'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('toHaveScreenshot') || acceptance.includes('Pixel-Diff'));
assert.ok(acceptance.includes('Custom WebGL') || acceptance.includes('Custom-WebGL'));
assert.ok(acceptance.includes('1280'));
assert.ok(acceptance.includes('390'));
assert.ok(composition.includes('CLEAR'));
assert.ok(fantasyReview.includes('IV-01'));
assert.ok(fantasyReview.includes('custom-webgl-prototype-runtime'));
assert.ok(fantasyReview.includes('maxDiffPixelRatio'));
assert.ok(gate.includes('atl2-g04-golden-visual.self-test.mjs'));
assert.ok(indexSrc.includes('ATLAS_GOLDEN_VISUAL_FIXTURES'));
assert.ok(indexSrc.includes('ATLAS_GOLDEN_VISUAL_BASELINES'));
assert.ok(indexSrc.includes('ATLAS_GOLDEN_VISUAL_VIEWPORTS'));
assert.ok(indexSrc.includes('evaluateAtlasGoldenArtDirection'));
assert.ok(visualSrc.includes('ATLAS_GOLDEN_VISUAL_TOLERANCE'));
assert.ok(visualSrc.includes('fingerprint-and-screenshot'));
assert.ok(visualSrc.includes('atlasGoldenSpatialGeometryFingerprint'));
assert.ok(visualSrc.includes('uiMapTitleDe'));
assert.ok(visualSrc.includes('diorama-oblique'));
assert.ok(!visualSrc.includes(' as any'));
assert.ok(!visualSrc.includes('@ts-ignore'));
assert.ok(!visualSrc.includes('@ts-expect-error'));
assert.ok(!visualSrc.includes("from 'three'") && !visualSrc.includes('from "three"'));

/* Browser contract: real WebGL + pixel diff (never fingerprint-only theatre). */
assert.ok(e2eSrc.includes('toHaveScreenshot'), 'e2e must pixel-diff via toHaveScreenshot');
assert.ok(e2eSrc.includes('SAGATREE_BROWSER_E2E_HOST'), 'e2e must gate on host Browser E2E');
assert.ok(e2eSrc.includes('data-atlas-ready'), 'e2e must wait for productive atlas ready');
assert.ok(e2eSrc.includes('__sagatreeAtlas'), 'e2e must drive Custom WebGL camera bridge');
assert.ok(e2eSrc.includes('maxDiffPixelRatio'), 'e2e must pass documented pixel tolerance');
assert.ok(e2eSrc.includes('g04-world-desktop') || e2eSrc.includes('g04-${fixture.id}-desktop'));
assert.ok(e2eSrc.includes('mobile'), 'e2e must capture a mobile viewport');
assert.ok(!e2eSrc.includes('maxDiffPixelRatio: 1'), 'must not auto-PASS all pixel diffs');

const gv = jiti(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(gv.ATLAS_GOLDEN_VISUAL_FIXTURES.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_SCALE_IDS.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_BASELINES.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode, 'fingerprint-and-screenshot');
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.maxDiffPixelRatio, 0.02);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_VIEWPORTS.length, 2);
assert.ok(gv.ATLAS_GOLDEN_VISUAL_MOBILE_FIXTURE_IDS.includes('world'));
assert.ok(gv.atlasGoldenVisualFixturesCoverHierarchy());

for (const fixture of gv.ATLAS_GOLDEN_VISUAL_FIXTURES) {
  assert.ok(typeof fixture.uiMapTitleDe === 'string' && fixture.uiMapTitleDe.length > 0);
}

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
    uiMapTitleDe: fixture.uiMapTitleDe,
  });
}

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

/* Fail-closed: committed Playwright PNG baselines must exist (no auto-PASS). */
const snapDir = join(root, 'e2e/atl2-g04-golden-visual.spec.ts-snapshots');
assert.ok(existsSync(snapDir), 'missing Playwright snapshot dir — run Browser E2E with --update-snapshots');
const pngs = readdirSync(snapDir).filter((f) => f.endsWith('.png'));
const required = [
  'g04-world-desktop',
  'g04-country-desktop',
  'g04-city-desktop',
  'g04-tavern-desktop',
  'g04-crypt-desktop',
  'g04-room-desktop',
  'g04-world-mobile',
  'g04-tavern-mobile',
];
for (const stem of required) {
  assert.ok(
    pngs.some((f) => f.includes(stem)),
    `missing snapshot PNG for ${stem} in ${snapDir} (got ${pngs.join(',') || 'none'})`,
  );
}

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-g04',
    issue: 1232,
    fixtures: snapshots,
    artDirection: report.checks,
    tolerance: gv.ATLAS_GOLDEN_VISUAL_TOLERANCE,
    viewports: gv.ATLAS_GOLDEN_VISUAL_VIEWPORTS,
    baselines: gv.ATLAS_GOLDEN_VISUAL_BASELINES.length,
    screenshotBaselines: pngs.length,
    target: target.ATLAS_PRODUCT_3D_TARGET,
  }),
);
