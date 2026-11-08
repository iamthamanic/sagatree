#!/usr/bin/env node
/**
 * npc-creature-domain-persistence-check — #196 domain + persistence contracts.
 * Offline: parse/validate roundtrip, policy attacks, derived machtgrad,
 * static repository/migration/wiring contracts. No live Supabase required.
 * Location: scripts/npc-creature-domain-persistence-check.mjs
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

const outdir = join(root, 'node_modules', '.cache', 'npc-creature-domain-persistence-check');
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

const WORLD_A = '11111111-1111-4111-8111-111111111111';
const WORLD_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const validDraft = {
  name: 'Waldwächter',
  description: 'Ein stiller Hüter.',
  kind: 'npc',
  category: 'npc',
  sheetMode: 'compact',
  level: 5,
  combatProfile: 'balanced',
  combatRole: 'standard',
  tags: ['wald', 'wächter'],
};

// ===========================================================================
section('1 · payload roundtrip + fail-closed parse');
{
  const id = 'personal:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const assembled = npc.assembleNpcCreatureDefinition(id, 'personal', validDraft);
  const validation = npc.validateNpcCreatureDefinition(assembled);
  check(validation.ok === true, 'valid draft validates');

  const payload = npc.toNpcCreatureDefinitionPayload(assembled);
  equal(payload.payloadVersion, npc.NPC_CREATURE_DEFINITION_PAYLOAD_VERSION, 'payloadVersion stamped');
  check(!('id' in payload), 'payload strips id');
  check(!('scope' in payload), 'payload strips scope');

  const parsed = npc.parseNpcCreatureDefinition(id, 'personal', payload);
  check(parsed !== null, 'payload roundtrips');
  equal(parsed?.name, 'Waldwächter', 'name roundtrips');
  equal(parsed?.level, 5, 'level roundtrips');
  equal(parsed?.combatProfile, 'balanced', 'combatProfile roundtrips');
  equal(parsed?.tags, ['wald', 'wächter'], 'tags roundtrip');

  equal(
    npc.parseNpcCreatureDefinition(id, 'personal', { ...payload, level: 99 }),
    null,
    'invalid level fails closed',
  );
  equal(
    npc.parseNpcCreatureDefinition(id, 'personal', { ...payload, category: 'dragon' }),
    null,
    'unknown category fails closed',
  );
  equal(
    npc.parseNpcCreatureDefinition(id, 'personal', {
      ...payload,
      combatProfile: 'noncombat',
      combatRole: 'boss',
    }),
    null,
    'noncombat+boss fails closed',
  );
  equal(
    npc.parseNpcCreatureDefinition(id, 'personal', {
      ...payload,
      id: 'personal:smuggle',
    }),
    null,
    'payload identity smuggle fails closed',
  );
  equal(
    npc.parseNpcCreatureDefinition(id, 'personal', {
      ...payload,
      challenge_rating: 5,
      sheetMode: 'compact',
      fullSheet: { hp: 10 },
    }),
    null,
    'compact with fullSheet fails closed',
  );

  const dndish = npc.parseNpcCreatureDefinition(id, 'personal', {
    name: 'Goblin',
    description: '',
    kind: 'creature',
    category: 'kreatur',
    sheetMode: 'compact',
    level: 1,
    combatProfile: 'offensive',
    combatRole: 'standard',
    tags: [],
    armor_class: 15,
  });
  // Unknown extra keys are ignored on parse; banned keys only checked on validate of assembled objects.
  // Ensure D&D fields are not required and do not become identity.
  check(dndish !== null, 'extra unknown keys ignored on parse when core fields valid');
  check(!('armor_class' in (dndish ?? {})), 'legacy armor_class not promoted onto definition');
}

// ===========================================================================
section('2 · derived Machtgrad via power framework');
{
  const id = 'personal:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const def = npc.assembleNpcCreatureDefinition(id, 'personal', {
    ...validDraft,
    level: 12,
    combatProfile: 'tough',
    combatRole: 'elite',
  });
  const derived = npc.deriveNpcCreaturePower(def);
  equal(derived.machtgrad, 'hoch', 'level 12 → hoch');
  equal(derived.machtgradLabel, 'Hoch', 'German Machtgrad label');
  equal(derived.benchmarks.level, 12, 'benchmarks level');
  check(derived.benchmarks.health > 0, 'benchmarks health positive');
}

// ===========================================================================
section('3 · cross-owner / cross-world mutation rejection');
{
  const personalA = {
    definition: npc.assembleNpcCreatureDefinition('personal:a', 'personal', validDraft),
    status: 'active',
    ownerUserId: USER_A,
    worldProfileId: null,
  };
  const worldA = {
    definition: npc.assembleNpcCreatureDefinition('world:a', 'world', {
      ...validDraft,
      kind: 'creature',
      category: 'kreatur',
    }),
    status: 'active',
    ownerUserId: USER_A,
    worldProfileId: WORLD_A,
  };

  check(
    npc.canMutateNpcCreatureDefinition(personalA, { userId: USER_A, editableWorldProfileIds: [] }),
    'owner may mutate personal',
  );
  check(
    !npc.canMutateNpcCreatureDefinition(personalA, { userId: USER_B, editableWorldProfileIds: [] }),
    'cross-owner personal mutation rejected',
  );
  check(
    !npc.canMutateNpcCreatureDefinition(worldA, {
      userId: USER_A,
      editableWorldProfileIds: [WORLD_B],
    }),
    'cross-world mutation rejected',
  );
  check(
    npc.canMutateNpcCreatureDefinition(worldA, {
      userId: USER_A,
      editableWorldProfileIds: [WORLD_A],
    }),
    'editor of matching world may mutate',
  );

  check(
    npc.canCreateNpcCreatureDefinition('personal', { userId: USER_A, editableWorldProfileIds: [] }),
    'authenticated user may create personal',
  );
  check(
    !npc.canCreateNpcCreatureDefinition(
      'world',
      { userId: USER_A, editableWorldProfileIds: [WORLD_B] },
      WORLD_A,
    ),
    'cannot create world def for non-editable world',
  );
  check(
    npc.canCreateNpcCreatureDefinition(
      'world',
      { userId: USER_A, editableWorldProfileIds: [WORLD_A] },
      WORLD_A,
    ),
    'may create world def for editable world',
  );

  check(
    !npc.isNpcCreatureDefinitionVisible(personalA, {
      userId: USER_B,
      readableWorldProfileIds: [],
    }),
    'cross-owner personal read rejected',
  );
  check(
    !npc.isNpcCreatureDefinitionVisible(worldA, {
      userId: USER_A,
      readableWorldProfileIds: [WORLD_B],
    }),
    'cross-world read rejected',
  );
}

// ===========================================================================
section('4 · migration + RLS static contract');
{
  const migration = read('archive/supabase-legacy/supabase/migrations/021_npc_creature_definitions.sql');
  requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.npc_creature_definitions/, 'creates table');
  requireMatch(migration, /ENABLE ROW LEVEL SECURITY/, 'RLS enabled');
  requireMatch(migration, /REVOKE ALL ON TABLE public\.npc_creature_definitions FROM anon/, 'revokes anon');
  requireMatch(migration, /owner_user_id = auth\.uid\(\)/, 'owner scoped policies');
  requireMatch(migration, /current_user_can_edit_world_profile/, 'world edit helper');
  requireMatch(migration, /current_user_can_read_world_profile/, 'world read helper');
  requireMatch(migration, /payload_version/, 'versioning column');
  requireMatch(migration, /prevent_npc_creature_definition_retarget/, 'immutability trigger');
  rejectMatch(migration, /FOR DELETE/, 'no hard DELETE policy');
  rejectMatch(migration, /challenge_rating|armor_class|hit_dice/, 'no D&D columns');

  const apply = read('scripts/apply-migrations.sh');
  requireMatch(apply, /021_npc_creature_definitions\.sql/, 'apply-migrations registers 021');
}

// ===========================================================================
section('5 · infrastructure facade security contract');
{
  const policy = read('src/domains/npc-creature/policy.ts');
  requireMatch(policy, /canMutateNpcCreatureDefinition/, 'mutation policy in domain');
  requireMatch(policy, /canCreateNpcCreatureDefinition/, 'create policy in domain');

  const persistence = read('src/infrastructure/npc-creature/npc-creature.persistence.ts');
  requireMatch(persistence, /npc_creature_definitions/, 'maps npc_creature_definitions');
  requireMatch(persistence, /NPC_CREATURE_DEFINITION_PAYLOAD_VERSION/, 'stamps payload version');

  const service = read('src/infrastructure/npc-creature/npc-creature-service.ts');
  requireMatch(service, /createNpcCreatureDefinition/, 'service create');
  requireMatch(service, /archiveNpcCreatureDefinition/, 'service archive');
  requireMatch(service, /parseNpcCreatureDefinition/, 'validates before map');
  requireMatch(service, /createHostLibraryNpcCreature/, 'writes via host library HTTP');
  requireMatch(service, /assertHost\(\)/, 'host-only npc facade');
  requireMatch(service, /getAuthenticatedUserId/, 'actor resolved from session where needed');
  rejectMatch(service, /ownerUserId:/, 'service facade takes no foreign owner');
  rejectMatch(
    service,
    /draft\.ownerUserId|draft\.owner_user_id|draft\.worldProfileId|draft\.world_profile_id|input\.owner/,
    'draft must not supply owner/world identity',
  );

  // Legacy paths must remain untouched as SoT.
  const legacyNpcs = read('archive/supabase-legacy/supabase/functions/npcs/index.ts');
  rejectMatch(
    legacyNpcs,
    /npc_creature_definitions|NpcCreatureDefinition/,
    'legacy npcs edge must not become new SoT',
  );
}

// ===========================================================================
section('6 · domain purity + test-gate wiring');
{
  const domainIndex = read('src/domains/npc-creature/index.ts');
  rejectMatch(domainIndex, /from ['"]react|supabase|infrastructure/, 'domain barrel stays pure');

  const validate = read('src/domains/npc-creature/validate.ts');
  rejectMatch(validate, /\bsupabase\b|\breact\b/i, 'validate has no React/Supabase');

  const gate = read('scripts/test-gate.mjs');
  requireMatch(
    gate,
    /npc-creature-domain-persistence-check\.mjs/,
    'test-gate invokes npc-creature-domain-persistence-check',
  );

  const acceptance = read('.qa/acceptance/npc-creature-domain-persistence.md');
  requireMatch(acceptance, /Composition Gate/, 'acceptance documents composition gate');
  requireMatch(acceptance, /CLEAR/, 'acceptance expects CLEAR verdict');
}

if (failures > 0) {
  console.error(`\nnpc-creature-domain-persistence-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('npc-creature-domain-persistence-check: OK (#196)');
