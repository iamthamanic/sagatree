#!/usr/bin/env node
/**
 * ATL2-G03 — adaptive atlas UX / gestures / surface states (#1231).
 * Location: scripts/atl2-g03-adaptive-ux.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g03.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g03.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const adaptiveSrc = readFileSync(
  join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'),
  'utf8',
);
const wbSrc = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-g03'));
assert.ok(acceptance.includes('#1231'));
assert.ok(acceptance.includes('AU-CONTENT-WIDTH'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(composition.includes('CLEAR'));
assert.ok(gate.includes('atl2-g03-adaptive-ux.self-test.mjs'));
assert.ok(indexSrc.includes('resolveAtlasWorkstationSurfaceState'));
assert.ok(indexSrc.includes('resolveAtlasGestureDisambiguation'));
assert.ok(adaptiveSrc.includes('ATLAS_KEYBOARD_SHORTCUTS'));
assert.ok(!adaptiveSrc.includes(' as any'));
assert.ok(!adaptiveSrc.includes('@ts-ignore'));
assert.ok(!adaptiveSrc.includes('@ts-expect-error'));
assert.ok(wbSrc.includes('data-atlas-surface-state'));
assert.ok(wbSrc.includes('data-atlas-surface-live'));
assert.ok(wbSrc.includes('prefers-reduced-motion'));
assert.ok(wbSrc.includes('resolveAtlasWorkstationSurfaceState'));
assert.ok(wbSrc.includes('webglFallback'));
assert.ok(wbSrc.includes('onWebglMountError'));
assert.ok(wbSrc.includes('onRequestSave'));
const edSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
assert.ok(edSrc.includes("key === 's'"));
assert.ok(edSrc.includes('onRequestSave?.()'));
assert.ok(edSrc.includes('undo()'));
assert.ok(edSrc.includes("setTool('hand')"));
const nativeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
assert.ok(nativeSrc.includes('onWebglMountError'));

const ad = jiti(join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'));

assert.equal(ad.resolveAtlasAdaptiveBand(390), 'phone');
assert.equal(ad.resolveAtlasAdaptiveBand(900), 'tablet');
assert.equal(ad.resolveAtlasAdaptiveBand(1280), 'desktop');

const phone = ad.resolveAtlasWorkstationComposition(390);
assert.equal(phone.useSheetsForChrome, true);
assert.equal(phone.reducedPhoneComposition, true);

const pan = ad.resolveAtlasGestureDisambiguation({
  tool: 'hand',
  pointerType: 'touch',
  band: 'phone',
});
assert.equal(pan.mode, 'pan');
/* Custom atlasPanBy — browser must not claim the gesture (Codex P1). */
assert.equal(pan.touchActionCss, 'none');

const draw = ad.resolveAtlasGestureDisambiguation({
  tool: 'paint',
  pointerType: 'touch',
  band: 'phone',
});
assert.equal(draw.mode, 'draw');
assert.equal(draw.touchActionCss, 'none');

assert.equal(ad.resolveAtlasWorkstationSurfaceState({ loading: true }), 'loading');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({ error: true }), 'error');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({ emptyMaps: true }), 'empty');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({ unlocated: true }), 'unlocated');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({ webglFallback: true }), 'webgl-fallback');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({ reducedMotion: true }), 'reduced-motion');
assert.equal(ad.resolveAtlasWorkstationSurfaceState({}), 'ready');
assert.match(ad.atlasWorkstationSurfaceLabelDe('webgl-fallback'), /WebGL/);

const phoneControls = ad.atlasCriticalControlsForBand('phone');
assert.ok(phoneControls.includes('save'));
assert.ok(phoneControls.includes('tool-hand'));
assert.ok(!phoneControls.includes('view-3d'));

const deskShortcuts = ad.atlasKeyboardShortcutsForBand('desktop');
assert.ok(deskShortcuts.some((s) => s.id === 'undo'));
const phoneShortcuts = ad.atlasKeyboardShortcutsForBand('phone');
assert.ok(phoneShortcuts.every((s) => s.bands.includes('phone')));

assert.equal(
  ad.atlasChromeOverflowSafe({
    contentWidthPx: 320,
    criticalControlCount: phoneControls.length,
  }),
  true,
);
assert.equal(
  ad.atlasChromeOverflowSafe({
    contentWidthPx: 200,
    criticalControlCount: 6,
  }),
  false,
);

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-g03',
    issue: 1231,
    phoneControls: phoneControls.length,
    deskShortcuts: deskShortcuts.length,
    pan: pan.mode,
    draw: draw.mode,
  }),
);
