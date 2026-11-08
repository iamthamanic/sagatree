#!/usr/bin/env node
/**
 * Inventory v2 legacy migration contract (#109) — migrates flat ItemDto[] into
 * Inventory v2 without silent data loss, asserts Core mapping strictness,
 * Personal fingerprint reuse, stack splits, overflow placement and idempotence.
 * Location: scripts/inventory-legacy-migration-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
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

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message} — erwartet ${b}, war ${a}`);
  }
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: fehlt ${label}`);
  }
}

const outdir = join(root, 'node_modules', '.cache', 'inventory-legacy-migration-check');
mkdirSync(outdir, { recursive: true });
execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  [
    join(root, 'src/domains/character/inventory-v2/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'inventory.mjs')}`,
  ],
  { stdio: 'inherit' },
);
const inv = await import(pathToFileURL(join(outdir, 'inventory.mjs')).href);

function totalUnits(state) {
  return Object.values(state.instances).reduce((sum, instance) => sum + instance.quantity, 0);
}

section('1 · Leeres und ungültiges Legacy-Inventar');
{
  const empty = inv.migrateLegacyInventory([]);
  equal(empty.state.baseSlots.filter(Boolean).length, 0, 'leeres Inventar bleibt leer');
  equal(empty.personalDrafts, [], 'keine Personal-Drafts');
  equal(inv.migrateLegacyInventory(null).state.instances, {}, 'null ergibt leeren Zustand');
  check(inv.isInventoryV2State(empty.state), 'Migrationsergebnis ist gültiges v2');
  check(!inv.isInventoryV2State([]), 'Legacy-Array ist kein v2-Zustand');
  check(!inv.isInventoryV2State({ schemaVersion: 2 }), 'unvollständiges Objekt ist kein v2-Zustand');
}

section('2 · Striktes Core-Mapping nur bei exakter Übereinstimmung');
{
  const shield = inv.getCoreItemDefinition('core.shield.standard');
  const exact = inv.migrateLegacyInventory([
    {
      id: 'legacy-1',
      name: shield.name,
      description: 'egal',
      type: 'shield',
      quantity: 1,
      load: shield.load,
      cost: shield.cost,
      traits: [...(shield.traits ?? [])],
    },
  ]);
  equal(
    Object.values(exact.state.instances).map((instance) => instance.definitionId),
    [shield.id],
    'exakter mechanischer Treffer mappt auf Core',
  );
  equal(exact.personalDrafts.length, 0, 'kein Personal-Draft bei Core-Treffer');

  const fuzzy = inv.migrateLegacyInventory([
    {
      id: 'legacy-2',
      name: shield.name,
      description: '',
      type: 'shield',
      quantity: 1,
      load: shield.load,
      cost: shield.cost,
      // missing traits → must NOT map to Core
    },
  ]);
  check(
    Object.values(fuzzy.state.instances)[0].definitionId.startsWith('pending:'),
    'abweichende Merkmale erzeugen Personal, kein Core',
  );
  equal(fuzzy.personalDrafts.length, 1, 'ein Personal-Draft für Custom-Schild');
}

section('3 · Mengen, Stapelsplits und Overflow');
{
  const consumable = {
    id: 'c1',
    name: 'Heiltrank Hausmarke',
    description: 'Eigenbau',
    type: 'consumable',
    quantity: 12,
    load: 0,
    cost: 1,
  };
  const migrated = inv.migrateLegacyInventory([consumable]);
  equal(totalUnits(migrated.state), 12, 'Gesamtmenge bleibt 12');
  equal(migrated.personalDrafts[0].stackLimit, 12, 'Consumable-Stapellimit = Menge (≤99)');
  equal(
    Object.values(migrated.state.instances).map((instance) => instance.quantity),
    [12],
    'eine Instanz wenn Menge ≤ Stapellimit',
  );

  const many = inv.migrateLegacyInventory(
    Array.from({ length: 25 }, (_, index) => ({
      id: `w${index}`,
      name: `Unikat ${index}`,
      description: '',
      type: 'weapon',
      quantity: 1,
      load: 1,
      cost: 1,
    })),
  );
  equal(totalUnits(many.state), 25, '25 Unikate bleiben erhalten');
  equal(many.state.baseSlots.filter(Boolean).length, 20, 'erste 20 im Grid');
  equal(many.state.legacyOverflow.length, 5, 'Rest im Overflow');
  equal(many.personalDrafts.length, 25, 'jedes Unikat eigener Fingerprint');
}

section('4 · Fingerprint-Wiederverwendung und Idempotenz');
{
  const twin = [
    { id: 'a', name: 'Seil', description: 'Hanf', type: 'misc', quantity: 1, load: 1, cost: 1 },
    { id: 'b', name: 'Seil', description: 'Hanf', type: 'misc', quantity: 1, load: 1, cost: 1 },
  ];
  const once = inv.migrateLegacyInventory(twin);
  equal(once.personalDrafts.length, 1, 'identische Fingerprints teilen einen Draft');
  const ids = Object.values(once.state.instances).map((instance) => instance.definitionId);
  equal(ids[0], ids[1], 'beide Instanzen zeigen auf denselben pending-Key');

  const again = inv.migrateLegacyInventory(twin);
  equal(again.personalDrafts[0].fingerprint, once.personalDrafts[0].fingerprint, 'Fingerprint ist deterministisch');
  equal(
    Object.keys(again.state.instances).length,
    Object.keys(once.state.instances).length,
    'erneute Migration ergibt dieselbe Instanzzahl',
  );
}

section('5 · Pending-Ids an stabile Personal-Ids binden');
{
  const migrated = inv.migrateLegacyInventory([
    { id: 'x', name: 'Amulett', description: '', type: 'misc', quantity: 1, load: 0, cost: 1 },
  ]);
  const fingerprint = migrated.personalDrafts[0].fingerprint;
  const pendingId = `pending:${fingerprint}`;
  equal(
    Object.values(migrated.state.instances)[0].definitionId,
    pendingId,
    'Instanz trägt pending-Key',
  );
  const bound = inv.bindPendingDefinitions(
    migrated.state,
    new Map([[fingerprint, 'personal:stable-1']]),
  );
  equal(
    Object.values(bound.instances)[0].definitionId,
    'personal:stable-1',
    'pending wird durch stabile Id ersetzt',
  );
  check(migrated.state.instances !== bound.instances, 'bindPendingDefinitions mutiert den Input nicht');
}

section('6 · Persistenzvertrag (Migration 016)');
{
  const migration = readFileSync(
    new URL('../supabase/migrations/016_character_inventory_v2.sql', import.meta.url),
    'utf8',
  );
  requireMatch(migration, /inventory_schema_version/, 'Versionsmarker-Spalte');
  requireMatch(migration, /inventory_v2 JSONB/, 'v2-Zustands-Spalte');
  requireMatch(migration, /DEFAULT 1/, 'Default bleibt Legacy');
  requireMatch(migration, /CHECK \(inventory_schema_version IN \(1, 2\)\)/, 'nur Version 1 oder 2');
}

section('7 · Strikte isInventoryV2State + Persistenz-Härtung');
{
  const empty = inv.migrateLegacyInventory([]);
  const partialContainers = {
    ...empty.state,
    containers: undefined,
  };
  check(!inv.isInventoryV2State(partialContainers), 'fehlende containers → kein v2');
  const shortQuick = {
    ...empty.state,
    quickSlots: [null],
  };
  check(!inv.isInventoryV2State(shortQuick), 'falsche quickSlots-Länge → kein v2');
  const badInstance = {
    ...empty.state,
    instances: {
      'inst-1': { instanceId: 'other', definitionId: 'core.misc.coin', quantity: 1 },
    },
  };
  check(!inv.isInventoryV2State(badInstance), 'instanceId ≠ Map-Key → kein v2');

  const persistence = readFileSync(
    new URL('../src/infrastructure/inventory/inventory-persistence.ts', import.meta.url),
    'utf8',
  );
  requireMatch(
    persistence,
    /schemaVersion !== 1|inventory_schema_version[\s\S]{0,80}!==\s*1/,
    'Optimistic Lock auf Version 1',
  );
  requireMatch(persistence, /migrationDefinitionId|personal:mig-/, 'deterministische Personal-Ids');
  requireMatch(persistence, /assertWritableInventoryV2/, 'Katalog-Sichtbarkeit vor Write');

  const commands = readFileSync(
    new URL('../src/domains/character/contracts/character.commands.ts', import.meta.url),
    'utf8',
  );
  check(
    !/inventory_schema_version\??:/.test(commands),
    'DTO erlaubt kein client-seitiges inventory_schema_version',
  );

  requireMatch(persistence, /persistMigratedInventory/, 'v2 migration persists via host character sheet');
  requireMatch(
    persistence,
    /inventory_schema_version/,
    'inventory schema version handled in persistence layer',
  );
}

if (failures > 0) {
  console.error(`\nInventory legacy migration check failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('Inventory legacy migration check passed (#109).');
