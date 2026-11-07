#!/usr/bin/env node
/**
 * npc-creature-world-catalog-check — contract for #199 world `npc-creature-catalog`
 * module: config normalize, pure resolveWorldNpcCreatureCatalog order, registry +
 * editor UI, Core never excluded, unknown ids preserved, item-catalog untouched.
 * Location: scripts/npc-creature-world-catalog-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

section('1 · structure & purity');

{
  const worldCatalog = read('src/domains/npc-creature/world-catalog.ts');
  check(
    worldCatalog.includes("NPC_CREATURE_CATALOG_MODULE_ID = 'npc-creature-catalog'"),
    'module id npc-creature-catalog',
  );
  check(worldCatalog.includes('enabledPackIds'), 'enabledPackIds');
  check(worldCatalog.includes('includedDefinitionIds'), 'includedDefinitionIds');
  check(worldCatalog.includes('excludedDefinitionIds'), 'excludedDefinitionIds');
  check(worldCatalog.includes('allowPersonalDefinitions'), 'allowPersonalDefinitions');
  check(
    worldCatalog.includes('export function resolveWorldNpcCreatureCatalog'),
    'resolveWorldNpcCreatureCatalog export',
  );
  check(
    worldCatalog.includes('export function normalizeNpcCreatureCatalogModuleConfig'),
    'normalize export',
  );
  check(!/\bfrom\s+['"]react(?:\/|$)/.test(worldCatalog), 'world-catalog: no React');
  check(!/from\s+['"][^'"]*supabase[^'"]*['"]/i.test(worldCatalog), 'world-catalog: no Supabase');

  const barrel = read('src/domains/npc-creature/index.ts');
  check(barrel.includes('resolveWorldNpcCreatureCatalog'), 'barrel exports resolver');
  check(barrel.includes('NPC_CREATURE_CATALOG_MODULE_ID'), 'barrel exports module id');
  check(barrel.includes('listCoreNpcCreatureDefinitions'), 'barrel exports core catalog');

  const registry = read('src/domains/world/worldModuleRegistry.ts');
  check(registry.includes("'npc-creature-catalog'"), 'registry includes npc-creature-catalog');
  check(registry.includes("'item-catalog'"), 'registry still includes item-catalog');
  check(registry.includes('normalizeNpcCreatureCatalogModuleConfig'), 'registry normalizes npc');
  check(registry.includes('normalizeItemCatalogModuleConfig'), 'registry still normalizes items');

  const editor = read('src/app/world/profile-editor/WorldProfileEditorDialog.tsx');
  check(editor.includes('WorldNpcCreatureCatalogModuleSection'), 'editor wires npc module section');
  check(editor.includes('WorldItemCatalogModuleSection'), 'editor still wires item module');
  check(editor.includes('WorldNpcCreatureCatalogSection'), 'editor wires npc authoring');
  check(editor.includes('!module.customEditor'), 'generic settings skip customEditor');

  const sectionUi = read(
    'src/app/world/npc-creature-catalog/WorldNpcCreatureCatalogModuleSection.tsx',
  );
  check(sectionUi.includes('NPCs & Kreaturen'), 'German section title');
  check(sectionUi.includes('Eigene Figuren der Spieler erlauben'), 'personal toggle copy');
  check(sectionUi.includes('Einzelne Figur hinzufügen'), 'search-add copy');
  check(sectionUi.includes('data-world-npc-creature-catalog-module'), 'data hook');
  check(sectionUi.includes('useNpcCreatureWorldAvailability'), 'uses hook');
  check(!/supabase\.from\(/.test(sectionUi), 'section no direct supabase');

  const authoring = read(
    'src/app/world/npc-creature-catalog/WorldNpcCreatureCatalogSection.tsx',
  );
  check(authoring.includes('Welt-eigene NPCs & Kreaturen'), 'authoring title');
  check(authoring.includes('data-world-npc-creature-catalog'), 'authoring data hook');
  check(authoring.includes('loadWorldProfileNpcCreatureCatalog'), 'authoring uses service');

  const hook = read('src/app/world/npc-creature-catalog/useNpcCreatureWorldAvailability.ts');
  check(hook.includes('resolveWorldNpcCreatureCatalog'), 'hook uses domain resolver');
  check(hook.includes('listBaseNpcCreaturePacks'), 'hook lists base packs');
  check(hook.includes('listContextNpcCreaturePacks'), 'hook lists context packs');
  check(hook.includes('personalDefinitions'), 'hook supplies personal definitions');
  check(hook.includes('catalogRevision'), 'hook refreshes on catalogRevision');

  const libraryHook = read('src/app/library/npc-creatures/useNpcCreatureLibrary.ts');
  check(libraryHook.includes('listCoreNpcCreatureDefinitions'), 'library merges Core');
  check(libraryHook.includes('listBuiltinNpcCreatureDefinitions'), 'library merges Pack builtins');
  check(libraryHook.includes('mergeLibraryCatalog'), 'library merge helper');

  const service = read('src/infrastructure/npc-creature/npc-creature-service.ts');
  check(service.includes('loadWorldProfileNpcCreatureCatalog'), 'service world catalog load');
  check(service.includes('loadWorldNpcCreatureAvailability'), 'service availability compose');

  check(service.includes('getNpcCreatureCatalogModuleConfig'), 'service reads npc catalog module config');
  check(service.includes('fetchHostLibraryNpcCreatures'), 'service loads npc defs via host HTTP');

  for (const file of [
    'src/domains/npc-creature/world-catalog.ts',
    'src/domains/npc-creature/core-catalog.ts',
    'src/app/world/npc-creature-catalog/useNpcCreatureWorldAvailability.ts',
    'src/app/world/npc-creature-catalog/WorldNpcCreatureCatalogModuleSection.tsx',
    'src/domains/world/worldModuleRegistry.ts',
  ]) {
    const text = read(file);
    const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check(!/\bany\b/.test(codeOnly), `${file}: no any`);
    check(!/\bas\s+unknown\b/.test(codeOnly), `${file}: no as unknown`);
  }

  for (const file of walkFiles(join(root, 'src/domains/npc-creature'))) {
    const text = readFileSync(file, 'utf8');
    const rel = file.slice(root.length + 1);
    check(!/\bfrom\s+['"]react(?:\/|$)/.test(text), `${rel}: no React`);
    check(!/from\s+['"][^'"]*supabase[^'"]*['"]/i.test(text), `${rel}: no Supabase`);
  }

  // item-catalog must remain intact
  const itemCatalog = read('src/domains/items/world-catalog.ts');
  check(itemCatalog.includes("ITEM_CATALOG_MODULE_ID = 'item-catalog'"), 'item-catalog unchanged id');
  check(itemCatalog.includes('resolveWorldItemCatalog'), 'item-catalog resolver intact');
}

section('2 · normalize defaults & unknown preserve');

const outdir = join(root, 'node_modules', '.cache', 'npc-creature-world-catalog-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/npc-creature/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'npc.mjs')}`,
  ],
  { stdio: 'inherit' },
);

const npc = await import(pathToFileURL(join(outdir, 'npc.mjs')).href);

equal(npc.NPC_CREATURE_CATALOG_MODULE_ID, 'npc-creature-catalog', 'module id constant');
equal(npc.NPC_CREATURE_CORE_CATALOG_SIZE, 6, 'core catalog size');
equal(npc.listCoreNpcCreatureDefinitions().length, 6, 'core list length');

{
  const defaults = npc.defaultNpcCreatureCatalogModuleConfig();
  equal(defaults.allowPersonalDefinitions, true, 'allowPersonalDefinitions default true');
  equal(defaults.enabledPackIds, [], 'enabledPackIds default empty');
  equal(defaults.includedDefinitionIds, [], 'includes default empty');
  equal(defaults.excludedDefinitionIds, [], 'excludes default empty');

  const fromInvalid = npc.normalizeNpcCreatureCatalogModuleConfig({
    enabledPackIds: 'nope',
    includedDefinitionIds: [123, 'builtin.creature.animal.wolf', ''],
    excludedDefinitionIds: ['x'],
    allowPersonalDefinitions: 'yes',
  });
  check(fromInvalid.config.enabledPackIds.length === 0, 'invalid packs coerced to []');
  equal(
    fromInvalid.config.includedDefinitionIds,
    ['builtin.creature.animal.wolf'],
    'string includes kept',
  );
  equal(fromInvalid.config.allowPersonalDefinitions, true, 'bad boolean → default true');
  check(fromInvalid.diagnosis.coercedFields.includes('enabledPackIds'), 'diagnose enabledPackIds');
  check(
    fromInvalid.diagnosis.coercedFields.includes('allowPersonalDefinitions'),
    'diagnose allowPersonalDefinitions',
  );

  const unknown = npc.normalizeNpcCreatureCatalogModuleConfig({
    enabledPackIds: [npc.FANTASY_BASICS_PACK_ID, 'builtin:pack-from-future'],
    includedDefinitionIds: ['builtin.npc.fantasy.militia', 'future.def.1'],
    excludedDefinitionIds: ['future.def.2'],
    allowPersonalDefinitions: false,
  });
  equal(
    unknown.config.enabledPackIds,
    [npc.FANTASY_BASICS_PACK_ID, 'builtin:pack-from-future'],
    'unknown pack preserved',
  );
  equal(
    unknown.config.includedDefinitionIds,
    ['builtin.npc.fantasy.militia', 'future.def.1'],
    'unknown include preserved',
  );
  equal(unknown.config.excludedDefinitionIds, ['future.def.2'], 'unknown exclude preserved');
  equal(unknown.config.allowPersonalDefinitions, false, 'false allowPersonal kept');
  check(unknown.diagnosis.unknownPackIds.includes('builtin:pack-from-future'), 'diagnose unknown pack');
  check(
    unknown.diagnosis.unknownIncludedDefinitionIds.includes('future.def.1'),
    'diagnose unknown include',
  );
}

section('3 · resolve order, Core, dedupe');

{
  const core = npc.listCoreNpcCreatureDefinitions();
  equal(core.length, 6, 'Core still 6');

  const resolveDefinition = (id) =>
    npc.getBuiltinNpcCreatureDefinition(id) ?? core.find((d) => d.id === id);

  const empty = npc.resolveWorldNpcCreatureCatalog({
    config: npc.defaultNpcCreatureCatalogModuleConfig(),
    coreDefinitions: core,
    resolveDefinition,
  });
  equal(empty.definitions.length, 6, 'empty config → Core only');
  check(
    empty.definitions.every((d) => d.scope === 'core'),
    'empty result is all Core',
  );

  const config = {
    enabledPackIds: [npc.FANTASY_BASICS_PACK_ID, npc.ANIMALS_PACK_ID, 'builtin:npc-context-undead'],
    includedDefinitionIds: [
      'builtin.creature.construct.golem',
      'builtin.npc.fantasy.militia',
    ],
    excludedDefinitionIds: ['builtin.creature.animal.wolf', core[0].id],
    allowPersonalDefinitions: true,
  };

  const worldDef = {
    id: 'world:11111111-1111-4111-8111-111111111111',
    scope: 'world',
    name: 'Welthüter',
    description: 'test',
    kind: 'npc',
    category: 'npc',
    sheetMode: 'compact',
    level: 4,
    combatProfile: 'balanced',
    combatRole: 'standard',
    tags: [],
  };
  const personalDef = {
    id: 'personal:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    scope: 'personal',
    name: 'Mein Schurke',
    description: 'test',
    kind: 'npc',
    category: 'npc',
    sheetMode: 'compact',
    level: 3,
    combatProfile: 'offensive',
    combatRole: 'standard',
    tags: [],
  };

  const resolveWithWorld = (id) => {
    if (id === worldDef.id) return worldDef;
    return resolveDefinition(id);
  };

  const resolved = npc.resolveWorldNpcCreatureCatalog({
    config,
    coreDefinitions: core,
    resolveDefinition: resolveWithWorld,
    worldDefinitions: [worldDef],
    personalDefinitions: [personalDef],
  });

  const ids = resolved.definitions.map((d) => d.id);
  check(ids.includes('builtin.npc.fantasy.militia'), 'pack member present');
  check(ids.includes('builtin.creature.construct.golem'), 'explicit include present');
  check(!ids.includes('builtin.creature.animal.wolf'), 'exclude removes wolf');
  check(ids.includes(worldDef.id), 'world def present');
  check(ids.includes(personalDef.id), 'personal present when allowed');
  check(ids.includes(core[0].id), 'Core id still present despite exclude');
  check(resolved.diagnosis.ignoredCoreExcludeIds.includes(core[0].id), 'Core exclude diagnosed');
  equal(new Set(ids).size, ids.length, 'no duplicate definition ids');

  const militiaCount = ids.filter((id) => id === 'builtin.npc.fantasy.militia').length;
  equal(militiaCount, 1, 'include already in pack deduped');

  const noPersonal = npc.resolveWorldNpcCreatureCatalog({
    config: { ...config, allowPersonalDefinitions: false },
    coreDefinitions: core,
    resolveDefinition: resolveWithWorld,
    worldDefinitions: [worldDef],
    personalDefinitions: [personalDef],
  });
  check(
    !noPersonal.definitions.some((d) => d.id === personalDef.id),
    'personal hidden when disallowed',
  );
  check(noPersonal.definitions.some((d) => d.id === worldDef.id), 'world still present');

  // Pack disabled but explicit include remains
  const includeOnly = npc.resolveWorldNpcCreatureCatalog({
    config: {
      enabledPackIds: [],
      includedDefinitionIds: ['builtin.creature.animal.bear'],
      excludedDefinitionIds: [],
      allowPersonalDefinitions: true,
    },
    coreDefinitions: core,
    resolveDefinition,
  });
  check(
    includeOnly.definitions.some((d) => d.id === 'builtin.creature.animal.bear'),
    'include without pack still present',
  );

  // include + exclude same id → exclude wins
  const both = npc.resolveWorldNpcCreatureCatalog({
    config: {
      enabledPackIds: [],
      includedDefinitionIds: ['builtin.creature.animal.hawk'],
      excludedDefinitionIds: ['builtin.creature.animal.hawk'],
      allowPersonalDefinitions: true,
    },
    coreDefinitions: core,
    resolveDefinition,
  });
  check(
    !both.definitions.some((d) => d.id === 'builtin.creature.animal.hawk'),
    'exclude wins over include',
  );
}

section('4 · composition gate artifact');

{
  const gate = read('.qa/runs/composition-gate-npc-creature-world-catalog.md');
  check(gate.includes('N-actors'), 'composition gate has N-actors label');
  check(gate.includes('Invalid/missing'), 'composition gate has Invalid/missing label');
  check(gate.includes('Two consumers / crash'), 'composition gate has Two consumers label');
  check(/CLEAR|SKIPPED/.test(gate), 'composition gate verdict');
  check(gate.includes('d4de351271f75a153d557a1af9bfc83d30c86625'), 'BASE_SHA recorded');
}

if (failures > 0) {
  console.error(`\nnpc-creature-world-catalog-check: ${failures} Fehler`);
  process.exit(1);
}

console.log('npc-creature-world-catalog-check: OK');
