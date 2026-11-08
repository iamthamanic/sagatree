#!/usr/bin/env node
/**
 * item-inventory-world-catalog-wire-check — contract for #143: Character
 * Inventory add-catalog composes Core + world item-catalog resolver + personal;
 * source labels; no 3D in inventory; Library stays independent.
 * Location: scripts/item-inventory-world-catalog-wire-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message} — expected ${b}, got ${a}`);
  }
}

section('1 · structure & wiring');

{
  const worldCatalog = read('src/domains/items/world-catalog.ts');
  check(worldCatalog.includes('composeCharacterInventoryAddCatalog'), 'compose export');
  check(worldCatalog.includes('effectiveWorldProfileId'), 'null-world branch key');

  const barrel = read('src/domains/items/index.ts');
  check(barrel.includes('composeCharacterInventoryAddCatalog'), 'barrel exports compose');

  const service = read('src/infrastructure/inventory/item-catalog-service.ts');
  check(service.includes('composeCharacterInventoryAddCatalog'), 'service uses compose');
  check(service.includes('getItemCatalogModuleConfig'), 'service reads module config');
  check(service.includes('getItemCatalogModuleConfig'), 'service reads item catalog module config');
  check(service.includes('getBuiltinStandardDefinition'), 'service resolves builtins for lookup');
  check(!/selectCatalogDefinitions/.test(service), 'service no longer uses selectCatalogDefinitions for addable');
  check(service.includes('resolveEffectiveWorldProfileId'), 'service resolves effective world profile');
  check(service.includes('fetchHostLibraryItems'), 'service loads catalog via host library HTTP');

  const catalogWritable = read('src/infrastructure/inventory/item-catalog-service.ts');
  check(
    catalogWritable.includes('getBuiltinStandardDefinition') &&
      catalogWritable.includes('assertWritableInventoryV2'),
    'writable inventory accepts builtins',
  );

  const migration = read('archive/supabase-legacy/supabase/migrations/019_world_profiles_read_for_adventure.sql');
  check(migration.includes('current_user_can_read_world_profile'), 'RLS uses read helper');
  check(migration.includes('Users can view readable world profiles'), 'new SELECT policy');

  const dialog = read('src/app/character/inventory/InventoryCatalogDialog.tsx');
  check(dialog.includes('INVENTORY_SOURCE_LABELS'), 'source text labels');
  check(dialog.includes("librarySourceFromOrigin"), 'source from origin');
  check(dialog.includes('InventoryItemThumb'), 'thumbnail only');
  check(!/model3d|Model3d|GLB|\.glb/i.test(dialog), 'no 3D in inventory catalog');
  check(dialog.includes('Standard'), 'Standard tab/label');
  check(dialog.includes('Quelle'), 'Quelle filter');
  check(dialog.includes('Setting'), 'Setting filter');
  check(dialog.includes('Kontext'), 'Kontext filter');

  const labels = read('src/app/character/inventory/inventory-ui-labels.ts');
  check(labels.includes("core: 'Core'"), 'Core label');
  check(labels.includes("standard: 'Standard'"), 'Standard label');
  check(labels.includes("world: 'Welt'"), 'Welt label');
  check(labels.includes("personal: 'Eigen'"), 'Eigen label');

  const libraryService = read('src/infrastructure/inventory/item-catalog-service.ts');
  check(libraryService.includes('loadLibraryItemCatalog'), 'Library catalog still independent');

  for (const file of [
    'src/domains/items/world-catalog.ts',
    'src/infrastructure/inventory/item-catalog-service.ts',
    'src/app/character/inventory/InventoryCatalogDialog.tsx',
    'src/app/character/inventory/inventory-ui-labels.ts',
  ]) {
    const text = read(file);
    const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check(!/\bany\b/.test(codeOnly), `${file}: no any`);
    check(!/\bas\s+unknown\b/.test(codeOnly), `${file}: no as unknown`);
    check(!/@ts-ignore|@ts-nocheck|eslint-disable/.test(text), `${file}: no type escape`);
  }
}

section('2 · compose runtime (null world / defaults / packs)');

const outdir = join(root, 'node_modules', '.cache', 'item-inventory-world-catalog-wire-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/items/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'items.mjs')}`,
  ],
  { stdio: 'inherit' },
);

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/character/inventory-v2/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'inventory.mjs')}`,
  ],
  { stdio: 'inherit' },
);

const items = await import(pathToFileURL(join(outdir, 'items.mjs')).href);
const inv = await import(pathToFileURL(join(outdir, 'inventory.mjs')).href);

{
  const core = inv.listCoreItemDefinitions();
  equal(core.length, 36, 'Core still 36');

  const resolveDefinition = (id) =>
    items.getBuiltinStandardDefinition(id) ?? core.find((d) => d.id === id);

  const worldDef = {
    id: 'world.test.custom-sword',
    scope: 'world',
    name: 'Weltschwert',
    description: 'test',
    type: 'weapon',
    load: 1,
    cost: 0,
    stackLimit: 1,
    origin: 'world',
  };
  const personalDef = {
    id: 'personal.test.trinket',
    scope: 'personal',
    name: 'Glücksbringer',
    description: 'test',
    type: 'misc',
    load: 0,
    cost: 0,
    stackLimit: 1,
    origin: 'personal',
  };

  // Null world → Core + Personal only (no packs / world defs)
  const nullWorld = items.composeCharacterInventoryAddCatalog({
    effectiveWorldProfileId: null,
    config: {
      enabledPackIds: [items.FANTASY_BASIC_PACK_ID],
      includedDefinitionIds: ['builtin.contemporary.smartphone'],
      excludedDefinitionIds: [],
      allowPersonalItems: true,
    },
    coreDefinitions: core,
    resolveDefinition,
    worldDefinitions: [worldDef],
    personalDefinitions: [personalDef],
  });
  equal(nullWorld.definitions.length, 37, 'null world: Core 36 + personal 1');
  check(
    !nullWorld.definitions.some((d) => d.id === 'builtin.contemporary.smartphone'),
    'null world: no pack/include builtins',
  );
  check(!nullWorld.definitions.some((d) => d.id === worldDef.id), 'null world: no world defs');
  check(nullWorld.definitions.some((d) => d.id === personalDef.id), 'null world: personal present');

  // Missing/empty module defaults → Core + World + Personal (prior semantics)
  const defaults = items.defaultItemCatalogModuleConfig();
  const emptyModule = items.composeCharacterInventoryAddCatalog({
    effectiveWorldProfileId: 'world-profile-1',
    config: defaults,
    coreDefinitions: core,
    resolveDefinition,
    worldDefinitions: [worldDef],
    personalDefinitions: [personalDef],
  });
  equal(emptyModule.definitions.length, 38, 'empty module: Core+World+Personal');
  check(
    !emptyModule.definitions.some((d) => d.origin === 'builtin-standard'),
    'empty module: no builtin-standard without packs',
  );
  check(emptyModule.definitions.some((d) => d.id === worldDef.id), 'empty module: world def');

  // Fantasy pack + personal off + exclude
  const packed = items.composeCharacterInventoryAddCatalog({
    effectiveWorldProfileId: 'world-profile-1',
    config: {
      enabledPackIds: [items.FANTASY_BASIC_PACK_ID],
      includedDefinitionIds: ['builtin.contemporary.smartphone'],
      excludedDefinitionIds: ['builtin.fantasy.torch'],
      allowPersonalItems: false,
    },
    coreDefinitions: core,
    resolveDefinition,
    worldDefinitions: [worldDef],
    personalDefinitions: [personalDef],
  });
  check(packed.definitions.some((d) => d.id === 'builtin.fantasy.longsword'), 'pack member offered');
  check(packed.definitions.some((d) => d.id === 'builtin.contemporary.smartphone'), 'include offered');
  check(!packed.definitions.some((d) => d.id === 'builtin.fantasy.torch'), 'exclude hides torch');
  check(!packed.definitions.some((d) => d.id === personalDef.id), 'personal blocked');
  check(packed.definitions.some((d) => d.id === worldDef.id), 'world def still offered');
  equal(
    packed.definitions.filter((d) => items.librarySourceFromOrigin(d.origin) === 'core').length,
    36,
    'exactly 36 Core source labels',
  );
}

section('3 · acceptance + composition CLEAR + test-gate wiring');

{
  const acceptance = read('.qa/acceptance/item-inventory-world-catalog-wire.md');
  check(acceptance.includes('Implementation Notes'), 'acceptance has Implementation Notes');
  check(acceptance.includes('Composition Gate'), 'acceptance has Composition Gate');

  const gate = read('.qa/runs/composition-gate-item-inventory-world-catalog-wire.md');
  check(gate.includes('N-actors'), 'composition gate has N-actors label');
  check(gate.includes('Invalid/missing'), 'composition gate has Invalid/missing label');
  check(gate.includes('Two consumers / crash'), 'composition gate has Two consumers label');
  check(/CLEAR|SKIPPED/.test(gate), 'composition gate verdict');

  const gateScript = read('scripts/test-gate.mjs');
  check(
    /item-inventory-world-catalog-wire-check\.mjs/.test(gateScript),
    'test-gate invokes item-inventory-world-catalog-wire-check',
  );
}

if (failures > 0) {
  console.error(`\nitem-inventory-world-catalog-wire-check: ${failures} Fehler`);
  process.exit(1);
}

console.log('item-inventory-world-catalog-wire-check: OK');
