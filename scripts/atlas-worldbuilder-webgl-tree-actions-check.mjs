#!/usr/bin/env node
/**
 * atlas-worldbuilder-webgl-tree-actions-check — product WebGL nav mutations (#748).
 * Location: scripts/atlas-worldbuilder-webgl-tree-actions-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-webgl-tree-actions-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-followup-webgl-tree-actions.md', ['#748', 'createNodeWithMaps']);
mustInclude('src/domains/world/places/atlas-webgl-nav-tree.ts', [
  'worldNodeKindFromWebglNavUiKind',
]);
mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  'onNavAdd',
  'onNavDuplicate',
  'onNavArchive',
  'onNavReparent',
  'data-nav-reparent',
]);
mustInclude('src/app/world/atlas/unified/AtlasNative3dEditor.tsx', [
  'onNavAdd',
  'onNavDuplicate',
  'onNavArchive',
  'onNavReparent',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'onWebglNavAdd',
  'onWebglNavDuplicate',
  'onWebglNavArchive',
  'onWebglNavReparent',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'WebglNavTreeActionHost',
  'onWebglNavAdd',
  'duplicateNode',
  'worldNodeKindFromWebglNavUiKind',
]);
mustInclude('src/app/world/atlas/WebglNavTreeActionHost.tsx', [
  'CreateWorldNodeDialog',
  'archiveNodeSubtree',
  'reparentNode',
  'previewNodeConsequences',
]);
mustInclude('src/app/world/places/CreateWorldNodeDialog.tsx', ['fixedChildKind', 'createNodeWithMaps']);

// Product path must not toast "Server-Dialog folgt" anymore.
const runtime = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
if (runtime.includes('Server-Dialog folgt')) {
  fail('product nav still shows stub toast "Server-Dialog folgt"');
}
if (runtime.includes('Duplizieren folgt über Server-Aktion')) {
  fail('product nav still stubs duplicate');
}
if (runtime.includes('Löschen folgt über Server-Aktion')) {
  fail('product nav still stubs delete/archive');
}

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-webgl-tree-actions-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/places/atlas-webgl-nav-tree.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const map = {
  kontinent: 'continent',
  land: 'country',
  ort: 'place',
  gebaeude: 'building',
  raum: 'room',
  world: null,
};
for (const [ui, expect] of Object.entries(map)) {
  const got = mod.worldNodeKindFromWebglNavUiKind(ui);
  if (got !== expect) fail(`map ${ui}: expected ${expect}, got ${got}`);
}

const evidenceDir = join(root, '.qa/evidence/atlas-followup-webgl-tree-actions');
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  join(evidenceDir, 'domain-map-proof.json'),
  `${JSON.stringify({ ok: true, map, issue: 748 }, null, 2)}\n`,
);

const evidencePath = join(evidenceDir, 'browser-actions-proof.json');
const navTree = {
  worldId: 'world:w-uuid',
  worldLabel: 'Donalu',
  worldSub: 'Welt',
  worldPrimaryMapId: 'map-world',
  nodes: [
    {
      id: 'c1',
      parentId: null,
      label: 'Nordkontinent',
      sub: 'Kontinent',
      kind: 'kontinent',
      primaryMapId: 'map-c1',
      placeKind: 'continent',
      status: 'draft',
    },
    {
      id: 'k1',
      parentId: 'c1',
      label: 'Nordreich',
      sub: 'Land',
      kind: 'land',
      primaryMapId: 'map-k1',
      placeKind: 'country',
      status: 'canonical',
    },
  ],
  childrenByParentId: {
    'world:w-uuid': ['c1'],
    c1: ['k1'],
    k1: [],
  },
  status: 'ready',
};

async function runBrowserActionsProof() {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<!doctype html><html><body><div id="host" style="width:900px;height:600px"></div></body></html>',
    );
    const runtimeSrc = readFileSync(
      join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
      'utf8',
    );
    const classic = runtimeSrc
      .replace(
        /export function mountAtlasPrototype3d/g,
        'window.mountAtlasPrototype3d = function mountAtlasPrototype3d',
      )
      .replace(/export \{[^}]+\};?/g, '');
    await page.addScriptTag({ content: classic });
    const result = await page.evaluate((tree) => {
      const host = document.getElementById('host');
      /** @type {object[]} */
      const events = [];
      const mount = window.mountAtlasPrototype3d(host, {
        controlled: true,
        externalNav: tree,
        onNavAdd: (p) => events.push({ type: 'add', ...p }),
        onNavDuplicate: (p) => events.push({ type: 'dup', ...p }),
        onNavArchive: (p) => events.push({ type: 'archive', ...p }),
        onNavReparent: (p) => events.push({ type: 'reparent', ...p }),
      });
      // Expand world so continent category + is present.
      const worldToggle = host.querySelector('[data-nav-place^="world:"] [data-nav-toggle]');
      if (worldToggle instanceof HTMLElement) worldToggle.click();
      const addLand = host.querySelector('[data-nav-add="land"][data-nav-add-parent="c1"]');
      if (!(addLand instanceof HTMLElement)) {
        mount.dispose();
        return { ok: false, reason: 'missing + land under continent', events };
      }
      addLand.click();
      const menuBtn = host.querySelector('[data-nav-menu="k1"]');
      if (menuBtn instanceof HTMLElement) menuBtn.click();
      const dup = host.querySelector('[data-nav-dup="k1"]');
      if (dup instanceof HTMLElement) dup.click();
      const menuBtn2 = host.querySelector('[data-nav-menu="k1"]');
      if (menuBtn2 instanceof HTMLElement) menuBtn2.click();
      const reparent = host.querySelector('[data-nav-reparent="k1"]');
      if (reparent instanceof HTMLElement) reparent.click();
      const menuBtn3 = host.querySelector('[data-nav-menu="k1"]');
      if (menuBtn3 instanceof HTMLElement) menuBtn3.click();
      const del = host.querySelector('[data-nav-del="k1"]');
      if (del instanceof HTMLElement) del.click();
      const archiveLabel = del?.textContent || '';
      mount.dispose();
      return { ok: true, events, archiveLabel };
    }, navTree);
    if (!result.ok) fail(`browser actions: ${result.reason}`);
    const types = (result.events || []).map((e) => e.type);
    if (!types.includes('add')) fail(`browser: missing onNavAdd ${JSON.stringify(result.events)}`);
    const addEv = result.events.find((e) => e.type === 'add');
    if (addEv.uiKind !== 'land' || addEv.parentId !== 'c1') {
      fail(`browser: bad add payload ${JSON.stringify(addEv)}`);
    }
    if (!types.includes('dup') || !types.includes('archive') || !types.includes('reparent')) {
      fail(`browser: missing mutation callbacks ${JSON.stringify(types)}`);
    }
    if (!/Archivieren/i.test(result.archiveLabel || '')) {
      fail(`browser: archive menu label expected Archivieren, got ${result.archiveLabel}`);
    }
    writeFileSync(evidencePath, `${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

try {
  await runBrowserActionsProof();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/Executable doesn't exist|browserType\.launch/i.test(msg)) throw err;
  if (!existsSync(evidencePath)) {
    fail(`playwright browsers missing and no evidence at ${evidencePath}`);
  }
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  if (!evidence.ok || !evidence.result?.events?.some((e) => e.type === 'add')) {
    fail('committed browser-actions-proof.json invalid');
  }
  console.warn(
    'atlas-worldbuilder-webgl-tree-actions-check: using committed browser proof (no Chromium)',
  );
}

console.log('atlas-worldbuilder-webgl-tree-actions-check: OK');
