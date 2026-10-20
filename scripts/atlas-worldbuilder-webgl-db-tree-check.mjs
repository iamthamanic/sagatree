#!/usr/bin/env node
/**
 * atlas-worldbuilder-webgl-db-tree-check — product WebGL nav from DB (#747).
 * Location: scripts/atlas-worldbuilder-webgl-db-tree-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-webgl-db-tree-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-followup-webgl-db-tree.md', ['#747', 'NAV_CHILDREN']);
mustInclude('src/domains/world/places/atlas-webgl-nav-tree.ts', [
  'buildAtlasWebglNavTree',
  'isDemoNavPlaceId',
  'webglNavKindFromPlaceKind',
]);
mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  'externalNav',
  'productNavActive',
  'data-atlas-product-nav',
  'data-atlas-nav-source',
]);
mustInclude('src/app/world/atlas/unified/AtlasNative3dEditor.tsx', [
  'externalNav',
  'updateExternalNav',
  'onNavSelect',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'webglNavTree',
  'onWebglNavSelect',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'buildAtlasWebglNavTree',
  'webglNavTree',
  'onWebglNavSelect',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-webgl-nav-tree-bundle.mjs');
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
const places = [
  {
    id: 'c1',
    worldProfileId: 'w',
    parentPlaceId: null,
    kind: 'continent',
    name: 'Nordkontinent',
    description: null,
    status: 'draft',
    seedKey: null,
    sortOrder: 0,
    revision: 1,
  },
  {
    id: 'k1',
    worldProfileId: 'w',
    parentPlaceId: 'c1',
    kind: 'country',
    name: 'Nordreich',
    description: null,
    status: 'canonical',
    seedKey: null,
    sortOrder: 0,
    revision: 1,
  },
  {
    id: 'p1',
    worldProfileId: 'w',
    parentPlaceId: 'k1',
    kind: 'place',
    name: 'Dornhain',
    description: null,
    status: 'canonical',
    seedKey: null,
    sortOrder: 0,
    revision: 1,
  },
  {
    id: 'arch',
    worldProfileId: 'w',
    parentPlaceId: null,
    kind: 'continent',
    name: 'Archiv',
    description: null,
    status: 'archived',
    seedKey: null,
    sortOrder: 9,
    revision: 1,
  },
];
const links = [
  {
    id: 'l1',
    worldProfileId: 'w',
    placeId: 'p1',
    mapId: 'map-p1',
    usage: 'primary',
    featureId: null,
    anchor: {},
  },
];

const tree = mod.buildAtlasWebglNavTree({
  worldProfileId: 'w-uuid',
  worldLabel: 'Donalu',
  worldPrimaryMapId: 'map-world',
  places,
  links,
});

if (tree.worldId !== 'world:w-uuid') fail('worldId must be namespaced');
if (tree.nodes.length !== 3) fail(`expected 3 active nodes, got ${tree.nodes.length}`);
if (tree.nodes.some((n) => n.id === 'arch')) fail('archived must be excluded');
if (mod.isDemoNavPlaceId('westmark') !== true) fail('westmark is demo id');
if (mod.isDemoNavPlaceId('c1') !== false) fail('uuid place must not be demo');
if (tree.childrenByParentId[tree.worldId]?.[0] !== 'c1') fail('continent under world');
if (tree.childrenByParentId.c1?.[0] !== 'k1') fail('country under continent');
const dornhain = tree.nodes.find((n) => n.id === 'p1');
if (!dornhain || dornhain.primaryMapId !== 'map-p1') fail('primary map on place');
if (mod.webglNavKindFromPlaceKind('country') !== 'land') fail('country → land');
if (mod.webglNavKindFromPlaceKind('building') !== 'gebaeude') fail('building → gebaeude');

const empty = mod.buildAtlasWebglNavTree({
  worldProfileId: 'w-uuid',
  worldLabel: 'Leer',
  places: [],
  links: [],
});
if (empty.status !== 'empty') fail('empty world status');

const runtime = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
if (!runtime.includes('if(productNavActive())')) {
  fail('runtime must branch on productNavActive');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-webgl-db-tree-check.mjs')) {
  fail('test-gate must invoke webgl-db-tree check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}


// Browser DOM proof when Chromium is available (local / Browser E2E job).
// Test Gate CI does not install Playwright browsers — then require committed evidence.
const evidencePath = join(root, '.qa/evidence/atlas-followup-webgl-db-tree/browser-nav-proof.json');
async function runBrowserDomProof() {
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
    const result = await page.evaluate((navTree) => {
      const host = document.getElementById('host');
      const mount = window.mountAtlasPrototype3d(host, {
        controlled: true,
        externalNav: navTree,
        activePlaceId: 'p1',
      });
      const nav = host.querySelector('#nav');
      const source = nav
        ?.querySelector('[data-atlas-nav-source]')
        ?.getAttribute('data-atlas-nav-source');
      const placeIds = [...host.querySelectorAll('[data-nav-place]')].map((el) =>
        el.getAttribute('data-nav-place'),
      );
      const labels = [...host.querySelectorAll('[data-nav-place] .nav-edit')].map(
        (el) => el.textContent,
      );
      const demoLeak = placeIds.filter((id) =>
        ['westmark', 'nordreich', 'asteria', 'city', 'dungeon', 'room', 'kontinent'].includes(id),
      );
      const product = host.querySelector('[data-atlas-product-nav="true"]');
      mount.dispose();
      return { source, placeIds, labels, demoLeak, hasProductAttr: !!product };
    }, tree);
    if (!result.hasProductAttr) fail('browser: missing data-atlas-product-nav');
    if (result.source !== 'db') fail(`browser: nav source ${result.source}`);
    if (result.demoLeak.length) fail(`browser: demo ids leaked ${result.demoLeak.join(',')}`);
    if (!result.placeIds.includes('p1') || !result.labels.some((l) => l.includes('Dornhain'))) {
      fail(`browser: expected Dornhain place id, got ${JSON.stringify(result)}`);
    }
    const selectProof = await page.evaluate((navTree) => {
      const host = document.getElementById('host');
      host.replaceChildren();
      /** @type {object|null} */
      let selected = null;
      const mount = window.mountAtlasPrototype3d(host, {
        controlled: true,
        externalNav: navTree,
        onNavSelect: (payload) => {
          selected = payload;
        },
      });
      const btn = host.querySelector('[data-nav-place="p1"] [data-focus="p1"]');
      if (!(btn instanceof HTMLElement)) {
        mount.dispose();
        return { ok: false, reason: 'missing focus button' };
      }
      btn.click();
      mount.dispose();
      return { ok: true, selected };
    }, tree);
    if (!selectProof.ok || !selectProof.selected || selectProof.selected.mapId !== 'map-p1') {
      fail(`browser select: expected map-p1, got ${JSON.stringify(selectProof)}`);
    }
    const emptyResult = await page.evaluate(() => {
      const host = document.getElementById('host');
      host.replaceChildren();
      const mount = window.mountAtlasPrototype3d(host, {
        controlled: true,
        externalNav: {
          worldId: 'world:empty',
          worldLabel: 'Leerwelt',
          worldSub: 'Welt',
          worldPrimaryMapId: null,
          nodes: [],
          childrenByParentId: { 'world:empty': [] },
          status: 'empty',
        },
      });
      const placeIds = [...host.querySelectorAll('[data-nav-place]')].map((el) =>
        el.getAttribute('data-nav-place'),
      );
      const text = host.querySelector('#nav')?.textContent || '';
      mount.dispose();
      return { placeIds, text };
    });
    if (emptyResult.placeIds.some((id) => ['westmark', 'nordreich', 'city'].includes(id))) {
      fail('browser empty: demo places present');
    }
    if (!/Keine Orte|Leerwelt|Welt/i.test(emptyResult.text)) {
      fail(`browser empty: unexpected nav text ${emptyResult.text.slice(0, 120)}`);
    }
    mkdirSync(join(root, '.qa/evidence/atlas-followup-webgl-db-tree'), { recursive: true });
    writeFileSync(
      evidencePath,
      JSON.stringify({ ok: true, result, selectProof, emptyResult }, null, 2),
    );
  } finally {
    await browser.close();
  }
}

try {
  await runBrowserDomProof();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/Executable doesn't exist|browserType\.launch/i.test(msg)) throw err;
  if (!existsSync(evidencePath)) {
    fail(`playwright browsers missing and no evidence at ${evidencePath}`);
  }
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  if (!evidence.ok || evidence.result?.source !== 'db' || evidence.result?.demoLeak?.length) {
    fail('committed browser-nav-proof.json invalid for product nav');
  }
  if (!evidence.result?.placeIds?.includes('p1')) {
    fail('committed browser proof missing Dornhain place id');
  }
  console.warn('atlas-worldbuilder-webgl-db-tree-check: using committed browser proof (no Chromium)');
}


console.log('atlas-worldbuilder-webgl-db-tree-check: ok');
