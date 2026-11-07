#!/usr/bin/env node
/**
 * Inventory v2 catalog contract (#107) — covers the seven required tests of the
 * issue: effective world-profile precedence, world isolation, personal isolation,
 * Core visibility/immutability, archive semantics, world authorization and the
 * null-world case.
 *
 * Two halves: the pure catalog policy runs against the real bundled domain code,
 * while the persistence/security contract is asserted statically against the
 * migration and the infrastructure adapter (there is no test database here).
 * Location: scripts/inventory-catalog-check.mjs
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
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
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
    console.error(`FAIL [${group}]: ${message} — erwartet ${b}, war ${a}`);
  }
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: fehlt ${label}`);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Load the real domain catalog policy
// ---------------------------------------------------------------------------

const outdir = join(root, 'node_modules', '.cache', 'inventory-catalog-check');
mkdirSync(outdir, { recursive: true });
execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  [
    join(root, 'src/domains/character/inventory-v2/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'catalog.mjs')}`,
  ],
  { stdio: 'inherit' },
);
const inv = await import(pathToFileURL(join(outdir, 'catalog.mjs')).href);

const WORLD_A = '11111111-1111-4111-8111-111111111111';
const WORLD_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function coreRecord(id, name) {
  return {
    definition: {
      id,
      scope: 'core',
      name,
      description: '',
      type: 'tool',
      load: 1,
      cost: 1,
      stackLimit: 1,
    },
    status: 'active',
  };
}

function worldRecord(id, name, worldProfileId, status = 'active') {
  return {
    definition: {
      id,
      scope: 'world',
      name,
      description: '',
      type: 'misc',
      load: 0,
      cost: 1,
      stackLimit: 1,
    },
    status,
    worldProfileId,
  };
}

function personalRecord(id, name, ownerUserId, status = 'active') {
  return {
    definition: {
      id,
      scope: 'personal',
      name,
      description: '',
      type: 'misc',
      load: 0,
      cost: 1,
      stackLimit: 1,
    },
    status,
    ownerUserId,
  };
}

// ===========================================================================
// 1. Resolution precedence: adventure > character > null
// ===========================================================================
section('1 · Rangfolge des wirksamen Weltprofils');
{
  equal(
    inv.resolveEffectiveWorldProfileId({
      adventureWorldProfileId: WORLD_A,
      characterWorldProfileId: WORLD_B,
    }),
    WORLD_A,
    'Abenteuer-Weltprofil gewinnt über das Charakter-Weltprofil',
  );
  equal(
    inv.resolveEffectiveWorldProfileId({
      adventureWorldProfileId: null,
      characterWorldProfileId: WORLD_B,
    }),
    WORLD_B,
    'Charakter-Weltprofil greift ohne Abenteuer-Bindung',
  );
  equal(
    inv.resolveEffectiveWorldProfileId({
      adventureWorldProfileId: undefined,
      characterWorldProfileId: undefined,
    }),
    null,
    'ohne beide Bindungen ist das wirksame Profil null',
  );
  equal(
    inv.resolveEffectiveWorldProfileId({
      adventureWorldProfileId: '   ',
      characterWorldProfileId: '',
    }),
    null,
    'leere Zeichenketten gelten nicht als Weltprofil',
  );
  equal(
    inv.resolveEffectiveWorldProfileId({
      adventureWorldProfileId: '  ' + WORLD_A + '  ',
      characterWorldProfileId: null,
    }),
    WORLD_A,
    'führende und folgende Leerzeichen werden bereinigt',
  );
}

// ===========================================================================
// 2. World A cannot see World B definitions
// ===========================================================================
section('2 · Welten-Isolation');
{
  const records = [
    worldRecord('world:a-item', 'Relikt von Welt A', WORLD_A),
    worldRecord('world:b-item', 'Relikt von Welt B', WORLD_B),
  ];
  const inWorldA = inv.selectCatalogDefinitions(records, {
    userId: USER_A,
    effectiveWorldProfileId: WORLD_A,
  });
  equal(inWorldA.map((definition) => definition.id), ['world:a-item'], 'Welt A sieht nur eigene Welt-Definitionen');
  const inWorldB = inv.selectCatalogDefinitions(records, {
    userId: USER_A,
    effectiveWorldProfileId: WORLD_B,
  });
  equal(inWorldB.map((definition) => definition.id), ['world:b-item'], 'Welt B sieht nur eigene Welt-Definitionen');

  // The lookup used for owned instances follows the same isolation.
  const lookupA = inv.createDefinitionLookup(records, { userId: USER_A, effectiveWorldProfileId: WORLD_A });
  check(lookupA('world:a-item') !== undefined, 'eigener Welt-Eintrag bleibt auflösbar');
  check(lookupA('world:b-item') === undefined, 'fremder Welt-Eintrag ist nicht auflösbar');
}

// ===========================================================================
// 3. User A cannot see/modify User B personal definitions
// ===========================================================================
section('3 · Persönliche Isolation');
{
  const records = [
    personalRecord('personal:a-item', 'Erbstück von A', USER_A),
    personalRecord('personal:b-item', 'Erbstück von B', USER_B),
  ];
  equal(
    inv.selectCatalogDefinitions(records, { userId: USER_A, effectiveWorldProfileId: null })
      .map((definition) => definition.id),
    ['personal:a-item'],
    'Nutzer A sieht nur eigene persönliche Definitionen',
  );
  const lookupB = inv.createDefinitionLookup(records, { userId: USER_B, effectiveWorldProfileId: null });
  check(lookupB('personal:b-item') !== undefined, 'Nutzer B sieht den eigenen Eintrag');
  check(lookupB('personal:a-item') === undefined, 'Nutzer B sieht nicht den Eintrag von A');
}

// ===========================================================================
// 4. Core visible for all valid characters, immutable through runtime repository
// ===========================================================================
section('4 · Core-Katalog ist universell und unveränderlich');
{
  const core = inv.listCoreItemDefinitions();
  check(core.length > 0, 'Core-Katalog enthält Definitionen');
  check(
    core.every(
      (definition) =>
        definition.scope === 'core' &&
        (definition.id.startsWith('core.') || definition.id.startsWith('core:')),
    ),
    'alle Core-Definitionen tragen Scope core und das Präfix core./core:',
  );
  check(
    new Set(core.map((definition) => definition.id)).size === core.length,
    'Core-Ids sind eindeutig',
  );
  equal(
    inv.coreCatalogRecords().every((record) => record.status === 'active'),
    true,
    'Core-Einträge sind immer aktiv',
  );

  // Visible regardless of user and world profile, including the null case.
  for (const context of [
    { userId: USER_A, effectiveWorldProfileId: WORLD_A },
    { userId: USER_B, effectiveWorldProfileId: null },
  ]) {
    const visible = inv.selectCatalogDefinitions(inv.coreCatalogRecords(), context);
    equal(visible.length, core.length, `Core ist für ${context.effectiveWorldProfileId ?? 'null'} vollständig sichtbar`);
  }

  const frozen = inv.listCoreItemDefinitions();
  check(Object.isFrozen(frozen), 'Core-Liste ist eingefroren');
  check(Object.isFrozen(frozen[0]), 'Core-Einträge sind tief eingefroren');
  check(
    !frozen[0].equipSlots || Object.isFrozen(frozen[0].equipSlots),
    'verschachtelte Core-Felder sind eingefroren',
  );
  const before = frozen[0].name;
  try {
    frozen[0].name = 'Manipuliert';
  } catch {
    // strict mode throws; either way the value must not change
  }
  equal(frozen[0].name, before, 'Core-Definitionen lassen sich nicht zur Laufzeit umbenennen');

  // The runtime repository cannot write Core: the table excludes the scope and
  // the id prefix constraint makes a core: row structurally unreachable.
  const migration = read('supabase/migrations/015_inventory_item_definitions.sql');
  requireMatch(migration, /CHECK \(scope IN \('world', 'personal'\)\)/, 'Scope-Check ohne core');
  requireMatch(migration, /CHECK \(id LIKE scope \|\| ':%'\)/, 'Id-Präfix bindet die Id an den Scope');
  const catalogFacade = read('src/infrastructure/inventory/item-catalog-service.ts');
  rejectMatch(
    catalogFacade,
    /origin:\s*['"]core['"]/,
    'Facade schreibt keinen Core-Scope',
  );
}

// ===========================================================================
// 5. Archived definition absent from Add catalog, resolvable by owned instance
// ===========================================================================
section('5 · Archivierung ohne Auflösungsverlust');
{
  const records = [
    personalRecord('personal:kept', 'Verfügbarer Gegenstand', USER_A),
    personalRecord('personal:gone', 'Archivierter Gegenstand', USER_A, 'archived'),
    worldRecord('world:archived', 'Archivierte Welt-Reliquie', WORLD_A, 'archived'),
  ];
  const context = { userId: USER_A, effectiveWorldProfileId: WORLD_A };

  equal(
    inv.selectCatalogDefinitions(records, context).map((definition) => definition.id),
    ['personal:kept'],
    'archivierte Definitionen fehlen im Add-Katalog',
  );

  const lookup = inv.createDefinitionLookup(records, context);
  check(lookup('personal:gone') !== undefined, 'archivierter eigener Eintrag bleibt für besessene Instanzen auflösbar');
  check(lookup('world:archived') !== undefined, 'archivierte Welt-Definition bleibt im eigenen Weltprofil auflösbar');
  check(lookup('personal:kept') !== undefined, 'aktive Einträge bleiben auflösbar');

  // Archiving a definition in another world must not make it resolvable.
  const foreignLookup = inv.createDefinitionLookup(records, {
    userId: USER_B,
    effectiveWorldProfileId: WORLD_B,
  });
  check(foreignLookup('world:archived') === undefined, 'archivierter fremder Welt-Eintrag bleibt unsichtbar');

  // Hard deletion is not part of the product: no DELETE policy on the table.
  const migration = read('supabase/migrations/015_inventory_item_definitions.sql');
  rejectMatch(
    migration,
    /FOR DELETE[\s\S]{0,120}inventory_item_definitions|ON public\.inventory_item_definitions[\s\S]{0,120}FOR DELETE/,
    'keine DELETE-Policy auf dem Katalog',
  );
  requireMatch(migration, /status TEXT NOT NULL DEFAULT 'active' CHECK \(status IN \('active', 'archived'\)\)/, 'Status active/archived');

  const catalogFacade = read('src/infrastructure/inventory/item-catalog-service.ts');
  rejectMatch(catalogFacade, /\.delete\(\)/, 'Facade löscht keine Definitionen');
  requireMatch(catalogFacade, /archiveDefinition/, 'Archivierung über host archive');
}

// ===========================================================================
// 6. World-definition mutation follows existing world editor authorization
// ===========================================================================
section('6 · Welt-Autorisierung für Schreibzugriffe');
{
  const migration = read('supabase/migrations/015_inventory_item_definitions.sql');
  requireMatch(
    migration,
    /CREATE OR REPLACE FUNCTION public\.current_user_can_edit_world_profile/,
    'Hilfsfunktion für Welt-Schreibrecht',
  );
  requireMatch(
    migration,
    /wp\.owner_user_id = auth\.uid\(\)/,
    'Welt-Schreibrecht folgt dem Eigentümermodell von world_profiles',
  );
  requireMatch(
    migration,
    /CREATE POLICY "Update own personal and editable world item definitions"/,
    'Update-Policy bindet Welt-Schreiben an die Edit-Funktion',
  );
  requireMatch(
    migration,
    /scope = 'world' AND public\.current_user_can_edit_world_profile\(world_profile_id\)/,
    'Welt-Zweig der Update-Policy',
  );
  requireMatch(
    migration,
    /CREATE POLICY "Insert own personal and editable world item definitions"/,
    'Insert-Policy bindet Welt-Schreiben an die Edit-Funktion',
  );
  requireMatch(
    migration,
    /REVOKE ALL ON FUNCTION public\.current_user_can_edit_world_profile\(UUID\) FROM PUBLIC, anon/,
    'REVOKE auf der Edit-Funktion',
  );
  requireMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.current_user_can_edit_world_profile\(UUID\) TO authenticated/,
    'GRANT EXECUTE auf der Edit-Funktion',
  );

  // Reading is deliberately wider than writing, otherwise a player of an
  // adventure could never see the World items that adventure runs on.
  requireMatch(
    migration,
    /CREATE OR REPLACE FUNCTION public\.current_user_can_read_world_profile/,
    'Hilfsfunktion für Welt-Leserecht',
  );
  requireMatch(
    migration,
    /public\.current_user_is_active_project_member\(p\.id\)/,
    'Leserecht über aktive Abenteuer-Mitgliedschaft',
  );
  requireMatch(
    migration,
    /p\.gm_user_id = auth\.uid\(\)/,
    'Leserecht über den Abenteuer-Spielleiter',
  );

  // World definition writes must go through the world profile id, never through
  // a client-supplied owner.
  const catalogFacade = read('src/infrastructure/inventory/item-catalog-service.ts');
  requireMatch(catalogFacade, /createWorldDefinition\(/, 'Welt-Definition anlegen');
  requireMatch(catalogFacade, /assertHost\(\)/, 'Host-only catalog facade');
  requireMatch(catalogFacade, /createHostLibraryItem/, 'Persistenz über Host Library HTTP');
  rejectMatch(
    read('src/infrastructure/inventory/item-catalog-service.ts'),
    /ownerUserId:/,
    'Facade nimmt keinen fremden Besitzer entgegen',
  );
}

// ===========================================================================
// 7. Null world profile returns no world-scope items
// ===========================================================================
section('7 · Null-Weltprofil ohne Welt-Gegenstände');
{
  const records = [
    coreRecord('core:torch', 'Fackel'),
    worldRecord('world:a-item', 'Relikt von Welt A', WORLD_A),
    personalRecord('personal:a-item', 'Erbstück', USER_A),
  ];
  equal(
    inv.selectCatalogDefinitions(records, { userId: USER_A, effectiveWorldProfileId: null })
      .map((definition) => definition.id),
    ['core:torch', 'personal:a-item'],
    'ohne wirksames Weltprofil gibt es Core und Persönliches, aber keine Welt-Definitionen',
  );

  // A world record without a profile can never be claimed by a null context.
  check(
    !inv.isDefinitionVisible(worldRecord('world:loose', 'Verwaist', null), {
      userId: USER_A,
      effectiveWorldProfileId: null,
    }),
    'Welt-Definition ohne Profil ist nie sichtbar',
  );
  // A personal record without an owner can never be claimed either.
  check(
    !inv.isDefinitionVisible(personalRecord('personal:loose', 'Verwaist', null), {
      userId: USER_A,
      effectiveWorldProfileId: null,
    }),
    'persönliche Definition ohne Besitzer ist nie sichtbar',
  );

  const catalogFacade = read('src/infrastructure/inventory/item-catalog-service.ts');
  requireMatch(catalogFacade, /listCatalogRecordsForEffectiveWorld/, 'Katalogfilter über Sichtbarkeitsregeln');
  requireMatch(catalogFacade, /isDefinitionVisible/, 'ohne Weltprofil greifen Domain-Sichtbarkeitsregeln');
}

// ===========================================================================
// 8. Payload parsing rejects corrupt rows instead of corrupting the catalog
// ===========================================================================
section('8 · Persistiertes Payload wird nicht blind vertraut');
{
  const valid = inv.parseItemDefinition('world:sword', 'world', {
    name: 'Klingenreliquie',
    description: 'Aus Welt A.',
    type: 'weapon',
    load: 1,
    cost: 2,
    stackLimit: 1,
    equipSlots: ['mainHand', 'offHand'],
    damage: '1W6',
  });
  check(valid !== null, 'gültiges Payload wird gelesen');
  equal(valid?.id, 'world:sword', 'Id kommt aus der Spalte');
  equal(valid?.scope, 'world', 'Scope kommt aus der Spalte');
  equal(valid?.equipSlots, ['mainHand', 'offHand'], 'Ausrüstungsslots werden übernommen');

  // Identity must not be taken from the payload, or a personal row could
  // smuggle itself into a world catalog.
  equal(
    inv.parseItemDefinition('personal:thing', 'personal', {
      id: 'world:smuggled',
      scope: 'world',
      name: 'Schmuggelware',
      type: 'misc',
      load: 0,
      cost: 0,
    })?.id,
    'personal:thing',
    'Payload kann die Id nicht überschreiben',
  );

  // Corrupt rows degrade to a missing item instead of failing the catalog.
  const invalidPayloads = [
    [null, 'kein Objekt'],
    [{ name: '', type: 'tool', load: 0, cost: 0 }, 'leerer Name'],
    [{ name: 'X', type: 'starship', load: 0, cost: 0 }, 'unbekannter Typ'],
    [{ name: 'X', type: 'tool', load: 9, cost: 0 }, 'Last außerhalb 0–3'],
    [{ name: 'X', type: 'tool', load: 0, cost: 99 }, 'Kosten außerhalb 0–5'],
  ];
  for (const [payload, label] of invalidPayloads) {
    equal(inv.parseItemDefinition('world:x', 'world', payload), null, `ungültiges Payload (${label}) ergibt null`);
  }

  // Values outside the contract are dropped, not trusted.
  const sanitized = inv.parseItemDefinition('world:sanitized', 'world', {
    name: 'Bereinigt',
    type: 'weapon',
    load: 1,
    cost: 1,
    stackLimit: 0,
    equipSlots: ['mainHand', 'wings'],
    protection: 7,
    traits: ['stabil', 42, ''],
  });
  equal(sanitized?.stackLimit, 1, 'ungültiges Stapellimit fällt auf 1');
  equal(sanitized?.equipSlots, ['mainHand'], 'unbekannte Slots werden verworfen');
  equal(sanitized?.protection, undefined, 'Schutz außerhalb 1–3 wird verworfen');
  equal(sanitized?.traits, ['stabil'], 'nicht-textliche Merkmale werden verworfen');

  // A container must never come back without capacity positions.
  equal(
    inv.parseItemDefinition('world:crate', 'world', {
      name: 'Kiste',
      type: 'container',
      load: 1,
      cost: 1,
    })?.containerCapacity,
    1,
    'Behälter ohne Angabe erhält eine Position',
  );
}

// ===========================================================================
// 9. Static persistence contract (no test database in this gate)
// ===========================================================================
section('9 · Persistenz- und Sicherheitsvertrag');
{
  const migration = read('supabase/migrations/015_inventory_item_definitions.sql');
  requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.inventory_item_definitions/, 'Katalogtabelle');
  requireMatch(migration, /ALTER TABLE public\.inventory_item_definitions ENABLE ROW LEVEL SECURITY/, 'RLS aktiviert');
  requireMatch(
    migration,
    /ADD COLUMN IF NOT EXISTS world_profile_id UUID REFERENCES public\.world_profiles\(id\)/,
    'Weltprofil-Bindung an Charakter und Abenteuer',
  );
  requireMatch(
    migration,
    /CREATE TRIGGER trg_inventory_item_definitions_no_retarget/,
    'Trigger gegen Umbenennung oder Scope-Wechsel',
  );
  requireMatch(migration, /inventory_item_definitions\.id is immutable/, 'Id unveränderlich');
  requireMatch(migration, /inventory_item_definitions\.scope is immutable/, 'Scope unveränderlich');
  requireMatch(
    migration,
    /\(scope = 'world' AND world_profile_id IS NOT NULL\)\s*OR \(scope = 'personal' AND world_profile_id IS NULL\)/,
    'Scope bindet das Weltprofil',
  );
  requireMatch(
    migration,
    /CONSTRAINT inventory_item_definitions_id_prefix/,
    'Id-Präfix entspricht dem Scope',
  );

  const persistence = read('src/infrastructure/inventory/item-catalog.persistence.ts');
  requireMatch(persistence, /export function mapDefinitionRow/, 'Zeilen-Mapping');
  requireMatch(persistence, /parseItemDefinition/, 'Mapping nutzt die Domänen-Prüfung');
  requireMatch(
    persistence,
    /const \{ id: _id, scope: _scope, publicId: _publicId, \.\.\.payload \}/,
    'Payload ohne Identitätsspalten',
  );

  requireMatch(migration, /ON DELETE RESTRICT/, 'Weltprofil-FK verhindert Hard-Delete per Cascade');
  rejectMatch(migration, /world_profile_id UUID REFERENCES public\.world_profiles\(id\) ON DELETE CASCADE/, 'kein CASCADE auf Welt-Definitionen');
  requireMatch(
    migration,
    /CREATE OR REPLACE FUNCTION public\.enforce_world_profile_binding_ownership/,
    'Bindungs-Trigger: nur editierbare Weltprofile',
  );
  requireMatch(
    migration,
    /trg_projects_world_profile_binding/,
    'Abenteuer-Bindung an Weltprofil-Eigentum gekoppelt',
  );
  requireMatch(
    migration,
    /trg_characters_world_profile_binding/,
    'Charakter-Bindung an Weltprofil-Eigentum gekoppelt',
  );

  const worldService = read('src/infrastructure/world/world-profile-service.ts');
  requireMatch(
    worldService,
    /deleteHostLibraryWorld/,
    'Welt-Löschen über Host Library HTTP (CUT-20)',
  );
  requireMatch(
    worldService,
    /world-in-use|inventory_item_definitions/,
    'Welt-Löschen prüft auf abhängige Definitionen (Host world-in-use / FK)',
  );
  requireMatch(
    worldService,
    /Archivieren Sie die Definitionen zuerst/,
    'Welt-Löschen verweigert mit deutscher Fehlermeldung',
  );
  const hostWorldDelete = read('server/src/modules/world/index.ts');
  requireMatch(
    hostWorldDelete,
    /deleteOwnedWorld/,
    'Host deleteOwnedWorld vorhanden',
  );
  requireMatch(
    hostWorldDelete,
    /world-in-use/,
    'Host verweigert Löschen bei abhängigen Referenzen',
  );

  const service = read('src/infrastructure/inventory/item-catalog-service.ts');
  requireMatch(service, /toDefinitionPayload/, 'Schreiben serialisiert Payload');
  requireMatch(service, /parseItemDefinition/, 'ungültiges Payload wird beim Lesen verworfen');
  requireMatch(service, /resolveEffectiveWorldProfileId/, 'Auflösung des wirksamen Weltprofils');
  requireMatch(service, /listCoreItemDefinitions/, 'Core kommt aus dem Domain-Katalog');
  requireMatch(service, /fetchHostLibraryAdventureArcs/, 'Abenteuer-Auflösung über aktive Arcs');
  requireMatch(service, /arc\.status !== 'active'/, 'nur aktive Arcs zählen für Abenteuer-Weltprofil');
  requireMatch(service, /composeCharacterInventoryAddCatalog/, 'Facade komponiert Add-Katalog über World-Resolver (#143)');
  requireMatch(service, /createDefinitionLookup/, 'Facade liefert Lookup für besessene Instanzen');
  requireMatch(service, /getBuiltinStandardDefinition/, 'Lookup löst Builtin-Standard für Besitz auf');
  requireMatch(service, /getItemCatalogModuleConfig/, 'Facade lädt Weltmodul-Konfiguration (#1159 host parity)');

  // Layering: the domain policy must not import persistence or infrastructure.
  // Comments may legitimately name where the enforcement lives, so only import
  // statements are rejected — scripts/architecture-boundary-check.mjs covers the
  // full layer rule set on top of this.
  for (const path of [
    'src/domains/character/inventory-v2/catalog.ts',
    'src/domains/character/inventory-v2/core-catalog.ts',
  ]) {
    rejectMatch(
      read(path),
      /^import\s.*(?:supabase|infrastructure|\/components\/|\/app\/)/m,
      `${path} importiert keine Persistenz oder Infrastruktur`,
    );
    rejectMatch(read(path), /^\s*await\s+/m, `${path} enthält keine asynchrone Persistenz`);
  }
}

if (failures > 0) {
  console.error(`\nInventory catalog check failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('Inventory catalog check passed (7 required tests, #107).');
