#!/usr/bin/env node
/**
 * item-library-browser-check — UI/architecture contract for Library Items (#138).
 * Location: scripts/item-library-browser-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function mustExist(relPath) {
  check(existsSync(join(root, relPath)), `missing ${relPath}`);
}

section('1 · slice files exist');
[
  'src/app/library/items/index.ts',
  'src/app/library/items/ItemLibraryBrowser.tsx',
  'src/app/library/items/useItemLibrary.ts',
  'src/app/library/items/ItemLibraryFilters.tsx',
  'src/app/library/items/ItemLibraryToolbar.tsx',
  'src/app/library/items/ItemLibraryResults.tsx',
  'src/app/library/items/ItemLibraryCard.tsx',
  'src/domains/items/library-query.ts',
  '.qa/acceptance/item-library-browser.md',
  'e2e/item-library-browser.spec.ts',
].forEach(mustExist);

section('2 · Library composes slice only');
{
  const library = read('src/app/library/Library.tsx');
  check(/ItemLibraryBrowser/.test(library), 'Library imports/renders ItemLibraryBrowser');
  check(/value=["']items["']/.test(library), 'Items tab trigger present');
  check(/onNavigateToItem/.test(library), 'Library receives onNavigateToItem');
  check(!/filterItemLibraryCatalog/.test(library), 'Library must not own filter rules');
  check(!/loadLibraryItemCatalog/.test(library), 'Library must not call catalog loader');
  check(!/listBuiltinStandardDefinitions/.test(library), 'Library must not import builtins');
  check(!/listCoreItemDefinitions/.test(library), 'Library must not import core catalog');
}

section('3 · App wires item navigation');
{
  const app = read('src/App.tsx');
  check(/navigateToItem/.test(app), 'AppShell uses navigateToItem');
  check(/onNavigateToItem=\{navigateToItem\}/.test(app), 'Library gets navigateToItem');
}

section('4 · hook has no domain filter rules inline');
{
  const hook = read('src/app/library/items/useItemLibrary.ts');
  check(/filterItemLibraryCatalog/.test(hook), 'hook uses domain filter helper');
  check(/loadLibraryItemCatalog/.test(hook), 'hook loads via catalog service');
  check(!/supabase\.from/.test(hook), 'hook must not query supabase directly');
}

section('5 · UI contract strings / a11y hooks');
{
  const browser = read('src/app/library/items/ItemLibraryBrowser.tsx');
  const toolbar = read('src/app/library/items/ItemLibraryToolbar.tsx');
  const toggle = read('src/app/library/LibraryViewModeToggle.tsx');
  const filters = read('src/app/library/items/ItemLibraryFilters.tsx');
  const results = read('src/app/library/items/ItemLibraryResults.tsx');
  const card = read('src/app/library/items/ItemLibraryCard.tsx');

  check(
    /Neues Item erstellen/.test(browser) || /Neues Item erstellen/.test(toolbar),
    'primary CTA copy',
  );
  check(/Gegenstände suchen/.test(browser), 'search placeholder/label');
  check(/Filter zurücksetzen/.test(filters) || /Filter zurücksetzen/.test(results), 'reset copy');
  check(/data-item-library-browser/.test(browser), 'browser data hook');
  check(/data-item-library-search/.test(browser), 'search data hook');
  check(/data-item-library-create/.test(browser), 'create CTA data hook');
  check(/InventoryItemThumb/.test(card), 'card uses InventoryItemThumb');
  check(/min-h-11/.test(browser) || /min-h-11/.test(toolbar), 'toolbar targets ≥44px');
  check(/EntityBrowser/.test(browser), 'browser uses shared EntityBrowser shell');
  check(
    /Listenansicht/.test(toggle) && /Grid-Ansicht/.test(toggle) && /Karussell-Ansicht/.test(toggle),
    'shared list/grid/carousel view toggle',
  );
  check(/Typ/.test(filters) && /Setting/.test(filters) && /Kontext/.test(filters), 'filter labels');
  check(/Quelle/.test(filters) && /Pack/.test(filters), 'source/pack filters');
}

section('6 · catalog service merges Core + builtin + persisted');
{
  const service = read('src/infrastructure/inventory/item-catalog-service.ts');
  check(/loadLibraryItemCatalog/.test(service), 'loadLibraryItemCatalog exported');
  check(/listBuiltinStandardDefinitions/.test(service), 'merges builtin standards');
  check(/listCoreItemDefinitions/.test(service), 'merges core definitions');
  check(/fetchHostItemRecords|fetchHostLibraryItems/.test(service), 'host library list for persisted rows');
}

section('7 · pure filter domain behaviour');
{
  const esbuild = require('esbuild');
  const outfile = join(root, 'node_modules/.cache/item-library-browser-check/library-query.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/items/library-query.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const q = await import(pathToFileURL(outfile).href);

  const sample = {
    id: 'builtin.contemporary.smartphone',
    scope: 'core',
    name: 'Smartphone',
    description: 'Ein smartes Kommunikationsgerät',
    type: 'tool',
    load: 0,
    cost: 2,
    stackLimit: 1,
    kindKey: 'device',
    settingTags: ['contemporary'],
    contexts: ['urban', 'office'],
    capabilities: ['communicate'],
    origin: 'builtin-standard',
  };

  check(q.itemMatchesFulltext(sample, '  SMART  '), 'fulltext trim/case');
  check(!q.itemMatchesFulltext(sample, 'laserkanone'), 'fulltext miss');
  check(
    q.itemMatchesLibraryFilters(
      sample,
      { ...q.EMPTY_ITEM_LIBRARY_FILTERS, kinds: ['device'], settings: ['contemporary'] },
      new Map(),
    ),
    'AND across dimensions',
  );
  check(
    !q.itemMatchesLibraryFilters(
      sample,
      { ...q.EMPTY_ITEM_LIBRARY_FILTERS, kinds: ['weapon'] },
      new Map(),
    ),
    'kind miss rejects',
  );
  check(q.librarySourceFromOrigin('builtin-standard') === 'standard', 'source mapping');
  check(q.librarySourceFromOrigin('core-archetype') === 'core', 'core source mapping');

  const packs = [
    {
      id: 'builtin:contemporary-basic',
      version: 1,
      name: 'Contemporary',
      description: '',
      settingTags: ['contemporary'],
      definitionIds: [sample.id],
    },
  ];
  const membership = q.buildPackMembershipIndex(packs);
  check(
    q.itemMatchesLibraryFilters(
      sample,
      { ...q.EMPTY_ITEM_LIBRARY_FILTERS, packIds: ['builtin:contemporary-basic'] },
      membership,
    ),
    'pack membership match',
  );
  check(
    !q.itemMatchesLibraryFilters(
      sample,
      { ...q.EMPTY_ITEM_LIBRARY_FILTERS, packIds: ['builtin:fantasy-basic'] },
      membership,
    ),
    'pack membership miss',
  );

  const filtered = q.filterItemLibraryCatalog(
    [sample],
    'smart',
    { ...q.EMPTY_ITEM_LIBRARY_FILTERS, kinds: ['device'] },
    membership,
  );
  check(filtered.length === 1, 'combined search+filter');
}

section('8 · acceptance + composition CLEAR + test-gate wiring');
{
  const acceptance = read('.qa/acceptance/item-library-browser.md');
  check(/item-library-browser/.test(acceptance), 'acceptance slug');
  check(/CLEAR/.test(acceptance), 'acceptance references CLEAR');
  mustExist('.qa/runs/composition-gate-item-library-browser.md');
  const gate = read('scripts/test-gate.mjs');
  check(/item-library-browser-check\.mjs/.test(gate), 'test-gate invokes item-library-browser-check');
}

if (failures > 0) {
  console.error(`\nitem-library-browser-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('item-library-browser-check: OK (#138)');
