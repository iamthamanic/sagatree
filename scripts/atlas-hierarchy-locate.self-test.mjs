#!/usr/bin/env node
/**
 * atlas-hierarchy-locate.self-test — Steps 3+4 locate helpers + wiring smoke.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-locate-'));
const outfile = join(tmp, 'map-frame.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/map-frame.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const mod = await import(pathToFileURL(outfile).href);

const bad = mod.parentAnchorFromParentRect({
  parentMapId: 'p1',
  minX: 10,
  minY: 10,
  maxX: 10,
  maxY: 20,
});
assert.equal(bad.ok, false, 'zero-width rect must fail');
assert.match(String(bad.reason), /Ausschnitt|ungültig|positiv/i);

const good = mod.locateChildMapFrame({
  parentMapId: 'parent-map',
  minX: 100,
  minY: 200,
  maxX: 140,
  maxY: 260,
});
assert.equal(good.ok, true);
assert.equal(good.frame.status, 'unsketched');
assert.equal(good.anchor.parentMapId, 'parent-map');
assert.equal(good.anchor.centerX, 120);
assert.equal(good.anchor.centerY, 230);
assert.equal(good.anchor.extentX, 20);
assert.equal(good.anchor.extentY, 30);
assert.equal(good.anchor.metersPerUnit, null);
assert.equal(mod.canLodEnterChildMap(good.frame), true);

const merged = mod.mergeMapFrameIntoGeneratorMeta({ engine: 'unified_canvas' }, good.frame);
assert.equal(merged.mapStatus, 'unsketched');
assert.equal(merged.mapFrame.parentAnchor.parentMapId, 'parent-map');

const editorSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
assert.match(editorSrc, /locateChildOnParent/);
assert.match(editorSrc, /locateChildMapFrame/);

const workbenchSrc = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
assert.match(workbenchSrc, /data-atlas-locate-start/);
assert.match(workbenchSrc, /Ausschnitt verorten/);
assert.match(workbenchSrc, /locateChildOnParent/);

const unifiedSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
assert.match(unifiedSrc, /locateSession/);
assert.match(unifiedSrc, /mode: 'locate'/);
assert.match(unifiedSrc, /data-atlas-locate-session/);

const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
assert.match(barrel, /locateChildMapFrame/);
assert.match(barrel, /parentAnchorFromParentRect/);

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
assert.match(gate, /atlas-hierarchy-locate\.self-test\.mjs/);

rmSync(tmp, { recursive: true, force: true });
console.log('atlas-hierarchy-locate self-test: PASS');
