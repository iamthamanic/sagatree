#!/usr/bin/env node
/**
 * ATL2-C05 — Atlas Workstation adaptive composition + AU markers.
 * Location: scripts/atl2-c05-adaptive-workstation.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const ad = jiti(join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-c05.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const wb = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const ed = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');

assert.ok(acceptance.includes('atl2-c05'));
assert.ok(acceptance.includes('AU-CONTENT-WIDTH'));
assert.ok(acceptance.includes('Workstation'));
assert.ok(gate.includes('atl2-c05-adaptive-workstation.self-test.mjs'));

assert.ok(wb.includes('useAdaptiveContentBand'));
assert.ok(wb.includes('data-atlas-content-band'));
assert.ok(wb.includes('data-atlas-surface-class="workstation"'));
assert.ok(wb.includes('resolveAtlasWorkstationComposition'));
assert.ok(wb.includes('safe-area-inset-top'));

assert.ok(ed.includes('data-atlas-history-live'));
assert.ok(ed.includes('data-atlas-interaction-hint'));
assert.ok(ed.includes('@container/atlas'));
assert.ok(ed.includes('atlasInteractionModeLabelDe'));
assert.ok(ed.includes('data-atlas-layers-sheet-trigger'));
assert.ok(ed.includes('renderLayersChrome'));
assert.ok(ed.includes('safe-area-inset-bottom'));
assert.ok(ed.includes('data-atlas-surface-mode="3d"'));
// 3D mount shell (not the early surfaceMode === '3d' reportNavView guard) keeps AU safe-area.
{
  const mountIdx = ed.indexOf('data-atlas-surface-mode="3d"');
  assert.ok(mountIdx >= 0);
  assert.ok(
    ed.slice(Math.max(0, mountIdx - 600), mountIdx + 200).includes('safe-area-inset-bottom'),
  );
}

assert.equal(ad.resolveAtlasAdaptiveBand(320), 'phone');
assert.equal(ad.resolveAtlasAdaptiveBand(800), 'tablet');
assert.equal(ad.resolveAtlasAdaptiveBand(1280), 'desktop');
assert.equal(ad.atlasContentWidthUsable(320), true);
assert.equal(ad.atlasContentWidthUsable(319), false);

const phone = ad.resolveAtlasWorkstationComposition(390);
assert.equal(phone.reducedPhoneComposition, true);
assert.equal(phone.useSheetsForChrome, true);
assert.equal(phone.showSideRails, false);

const desk = ad.resolveAtlasWorkstationComposition(1280);
assert.equal(desk.showSideRails, true);
assert.equal(desk.useSheetsForChrome, false);

assert.match(ad.atlasInteractionModeLabelDe('touch'), /Touch/);
assert.match(ad.atlasInteractionModeLabelDe('keyboard'), /Tastatur/);

console.log('atl2-c05-adaptive-workstation self-test: PASS');
