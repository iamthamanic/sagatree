#!/usr/bin/env node
/**
 * item-definition-persistence-check — #136 ItemDefinition lifecycle & security.
 * Offline: taxonomy/payload roundtrip, fork provenance, cross-owner/cross-world
 * mutation rejection, Core read-only, archive lookup, static repository contract.
 * Location: scripts/item-definition-persistence-check.mjs
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

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: missing ${label}`);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: ${label}`);
  }
}

const outdir = join(root, 'node_modules', '.cache', 'item-definition-persistence-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/character/inventory-v2/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'inv.mjs')}`,
  ],
  { stdio: 'inherit' },
);
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

const inv = await import(pathToFileURL(join(outdir, 'inv.mjs')).href);
const items = await import(pathToFileURL(join(outdir, 'items.mjs')).href);

const WORLD_A = '11111111-1111-4111-8111-111111111111';
const WORLD_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ===========================================================================
section('1 · taxonomy + asset-key payload roundtrip');
{
  const richPayload = {
    name: 'Feldnotizbuch',
    description: 'Beweise sammeln.',
    type: 'misc',
    load: 0,
    cost: 1,
    stackLimit: 1,
    iconKey: 'icons/notebook',
    assetKey: 'assets/notebook-v1',
    kindKey: 'document',
    settingTags: ['contemporary'],
    techLevel: 'modern',
    contexts: ['social', 'office'],
    capabilities: ['record', 'research'],
    roles: ['evidence'],
    origin: 'personal',
    basedOnDefinitionId: 'core:torch',
    payloadVersion: items.ITEM_DEFINITION_PAYLOAD_VERSION,
  };

  const parsed = inv.parseItemDefinition('personal:note', 'personal', richPayload);
  check(parsed !== null, 'rich taxonomy payload parses');
  equal(parsed?.kindKey, 'document', 'kindKey roundtrips');
  equal(parsed?.settingTags, ['contemporary'], 'settingTags roundtrip');
  equal(parsed?.techLevel, 'modern', 'techLevel roundtrips');
  equal(parsed?.contexts, ['social', 'office'], 'contexts roundtrip');
  equal(parsed?.capabilities, ['record', 'research'], 'capabilities roundtrip');
  equal(parsed?.roles, ['evidence'], 'roles roundtrip');
  equal(parsed?.origin, 'personal', 'origin roundtrips');
  equal(parsed?.basedOnDefinitionId, 'core:torch', 'basedOnDefinitionId roundtrips');
  equal(parsed?.iconKey, 'icons/notebook', 'iconKey roundtrips');
  equal(parsed?.assetKey, 'assets/notebook-v1', 'assetKey roundtrips');
  equal(parsed?.load, 0, 'mechanical load unchanged');
  equal(parsed?.cost, 1, 'mechanical cost unchanged');

  equal(
    inv.parseItemDefinition('personal:bad', 'personal', {
      ...richPayload,
      kindKey: 'laser-sword',
    }),
    null,
    'unknown kindKey fails closed',
  );
  equal(
    inv.parseItemDefinition('personal:bad-tag', 'personal', {
      ...richPayload,
      settingTags: ['cyberpunk'],
    }),
    null,
    'unknown settingTag fails closed',
  );

  const legacy = inv.parseItemDefinition('personal:legacy', 'personal', {
    name: 'Altes Ding',
    type: 'tool',
    load: 1,
    cost: 1,
    stackLimit: 1,
  });
  check(legacy !== null, 'legacy payload without taxonomy still parses');
  equal(legacy?.kindKey, 'tool', 'legacy gets kindKey default from type');
  equal(legacy?.origin, 'personal', 'legacy gets origin default from scope');
  equal(legacy?.load, 1, 'legacy mechanical values unchanged');
}

// ===========================================================================
section('2 · fork copies values, new identity, provenance');
{
  const source = inv.parseItemDefinition('core:shortsword', 'core', {
    name: 'Kurzschwert',
    type: 'weapon',
    load: 1,
    cost: 2,
    stackLimit: 1,
    damage: '1W6',
    kindKey: 'weapon',
    origin: 'core-archetype',
    iconKey: 'icons/shortsword',
  });
  check(source !== null, 'fork source parses');

  const personalDraft = items.buildForkedItemDefinitionDraft(source, 'personal');
  check(!('id' in personalDraft) || personalDraft.id === undefined, 'fork draft has no id');
  check(!('scope' in personalDraft) || personalDraft.scope === undefined, 'fork draft has no scope');
  equal(personalDraft.basedOnDefinitionId, 'core:shortsword', 'fork points at immediate source');
  equal(personalDraft.origin, 'personal', 'personal fork origin');
  equal(personalDraft.name, 'Kurzschwert', 'name copied');
  equal(personalDraft.iconKey, 'icons/shortsword', 'iconKey copied');
  equal(personalDraft.damage, '1W6', 'mechanics copied');

  const worldDraft = items.buildForkedItemDefinitionDraft(source, 'world');
  equal(worldDraft.origin, 'world', 'world fork origin');
  equal(worldDraft.basedOnDefinitionId, 'core:shortsword', 'world fork provenance');

  // Fork of a fork references the immediate source only.
  const alreadyForked = inv.parseItemDefinition('personal:copy', 'personal', {
    name: 'Kopie',
    type: 'tool',
    load: 0,
    cost: 0,
    stackLimit: 1,
    basedOnDefinitionId: 'core:torch',
    origin: 'personal',
  });
  const second = items.buildForkedItemDefinitionDraft(alreadyForked, 'personal');
  equal(second.basedOnDefinitionId, 'personal:copy', 'second fork references immediate source');
}

// ===========================================================================
section('3 · cross-owner / cross-world mutation rejection');
{
  const personalA = {
    definition: {
      id: 'personal:a',
      scope: 'personal',
      name: 'Mein Ding',
      description: '',
      type: 'misc',
      load: 0,
      cost: 0,
      stackLimit: 1,
    },
    status: 'active',
    ownerUserId: USER_A,
  };
  const worldA = {
    definition: {
      id: 'world:a',
      scope: 'world',
      name: 'Welt-Ding',
      description: '',
      type: 'misc',
      load: 0,
      cost: 0,
      stackLimit: 1,
    },
    status: 'active',
    worldProfileId: WORLD_A,
  };
  const coreRec = {
    definition: {
      id: 'core:torch',
      scope: 'core',
      name: 'Fackel',
      description: '',
      type: 'tool',
      load: 1,
      cost: 1,
      stackLimit: 1,
    },
    status: 'active',
  };

  check(
    inv.canMutateDefinition(personalA, { userId: USER_A, editableWorldProfileIds: [] }),
    'owner may mutate personal',
  );
  check(
    !inv.canMutateDefinition(personalA, { userId: USER_B, editableWorldProfileIds: [] }),
    'cross-owner personal mutation rejected',
  );
  check(
    !inv.canMutateDefinition(worldA, { userId: USER_A, editableWorldProfileIds: [WORLD_B] }),
    'cross-world mutation rejected',
  );
  check(
    inv.canMutateDefinition(worldA, { userId: USER_A, editableWorldProfileIds: [WORLD_A] }),
    'editor of matching world may mutate',
  );
  check(
    !inv.canMutateDefinition(coreRec, { userId: USER_A, editableWorldProfileIds: [WORLD_A] }),
    'core is never mutable',
  );

  check(
    inv.canCreateDefinition('personal', { userId: USER_A, editableWorldProfileIds: [] }),
    'authenticated user may create personal',
  );
  check(
    !inv.canCreateDefinition('world', { userId: USER_A, editableWorldProfileIds: [WORLD_B] }, WORLD_A),
    'cannot create world def for non-editable world',
  );
  check(
    inv.canCreateDefinition('world', { userId: USER_A, editableWorldProfileIds: [WORLD_A] }, WORLD_A),
    'may create world def for editable world',
  );
  check(
    !inv.canCreateDefinition('core', { userId: USER_A, editableWorldProfileIds: [] }),
    'cannot create core at runtime',
  );

  // Visibility (read) attacks
  check(
    !inv.isDefinitionVisible(personalA, { userId: USER_B, effectiveWorldProfileId: null }),
    'cross-owner personal read rejected',
  );
  check(
    !inv.isDefinitionVisible(worldA, { userId: USER_A, effectiveWorldProfileId: WORLD_B }),
    'cross-world read rejected',
  );
}

// ===========================================================================
section('4 · archive leaves Add catalog but lookup still resolves');
{
  const records = [
    {
      definition: {
        id: 'personal:keep',
        scope: 'personal',
        name: 'Aktiv',
        description: '',
        type: 'misc',
        load: 0,
        cost: 0,
        stackLimit: 1,
      },
      status: 'active',
      ownerUserId: USER_A,
    },
    {
      definition: {
        id: 'personal:old',
        scope: 'personal',
        name: 'Archiviert',
        description: '',
        type: 'misc',
        load: 0,
        cost: 0,
        stackLimit: 1,
      },
      status: 'archived',
      ownerUserId: USER_A,
    },
  ];
  const ctx = { userId: USER_A, effectiveWorldProfileId: null };
  equal(
    inv.selectCatalogDefinitions(records, ctx).map((d) => d.id),
    ['personal:keep'],
    'archived excluded from addable',
  );
  const lookup = inv.createDefinitionLookup(records, ctx);
  equal(lookup('personal:old')?.id, 'personal:old', 'archived still resolvable for owned instance');
  equal(lookup('personal:keep')?.id, 'personal:keep', 'active still resolvable');
}

// ===========================================================================
section('5 · persistence + security static contract');
{
  const persistence = read('src/infrastructure/inventory/item-catalog.persistence.ts');
  requireMatch(persistence, /ITEM_DEFINITION_PAYLOAD_VERSION/, 'payload version stamped on write');
  requireMatch(persistence, /payloadVersion/, 'payloadVersion field written');
  requireMatch(persistence, /from '\.\.\/\.\.\/domains\/items'/, 'persistence uses domains/items');

  const facade = read('src/infrastructure/inventory/item-catalog-service.ts');
  requireMatch(facade, /buildForkedItemDefinitionDraft/, 'fork uses domains/items');
  requireMatch(facade, /parseItemDefinition/, 'host rows validated via domain parse');
  requireMatch(facade, /getCoreItemDefinition/, 'core fork resolves from in-memory catalog');
  requireMatch(facade, /forkDefinition/, 'fork operation exists');
  requireMatch(facade, /createHostCatalogDefinition/, 'writes go through host library HTTP');
  requireMatch(facade, /assertHost\(\)/, 'host-only item catalog facade');
  rejectMatch(
    facade,
    /draft\.ownerUserId|draft\.owner_user_id|draft\.worldProfileId|draft\.world_profile_id/,
    'draft must not supply owner/world identity',
  );

  const service = read('src/infrastructure/inventory/item-catalog-service.ts');
  requireMatch(service, /forkDefinition/, 'service exposes fork');
  requireMatch(service, /archiveDefinition/, 'service exposes archive');
  requireMatch(service, /restoreDefinition/, 'service exposes restore');
  rejectMatch(service, /ownerUserId:/, 'service facade takes no foreign owner');

  const catalog = read('src/domains/character/inventory-v2/catalog.ts');
  requireMatch(catalog, /canMutateDefinition/, 'mutation policy in catalog domain');
  requireMatch(catalog, /validateItemDefinitionMetadata/, 'parse uses items validate');
  requireMatch(catalog, /normalizeItemDefinition/, 'parse normalizes legacy defaults');

  const itemsIndex = read('src/domains/items/index.ts');
  requireMatch(itemsIndex, /buildForkedItemDefinitionDraft/, 'items exports fork helper');
  requireMatch(itemsIndex, /ITEM_DEFINITION_PAYLOAD_VERSION/, 'items exports payload version');

  requireMatch(
    persistence,
    /inventory_item_definitions/,
    'still maps inventory_item_definitions',
  );
}

// ===========================================================================
section('6 · test-gate wiring');
{
  const gate = read('scripts/test-gate.mjs');
  requireMatch(
    gate,
    /item-definition-persistence-check\.mjs/,
    'test-gate invokes item-definition-persistence-check',
  );
}

if (failures > 0) {
  console.error(`\nitem-definition-persistence-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('item-definition-persistence-check: OK (#136)');
