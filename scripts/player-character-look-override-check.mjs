#!/usr/bin/env node
/**
 * player-character-look-override-check — Personal Look override write gate (#351).
 * Location: scripts/player-character-look-override-check.mjs
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

section('1 · files');
[
  'archive/supabase-legacy/supabase/migrations/054_characters_personal_look_override.sql',
  'src/domains/look/personal-look-override.ts',
  'src/infrastructure/character/character-service.ts',
  'src/app/look/CharacterLookSelector.tsx',
  '.qa/acceptance/player-character-look-override.md',
].forEach(mustExist);

section('2 · migration');
{
  const mig = read('archive/supabase-legacy/supabase/migrations/054_characters_personal_look_override.sql');
  check(/enforce_personal_look_profile_binding/.test(mig), 'trigger function');
  check(/personal_look_profile_id/.test(mig), 'JSON field check');
  check(/allow_player_character_look_override IS FALSE/.test(mig), 'saga forbid');
  check(/owner_user_id IS DISTINCT FROM auth\.uid\(\)/.test(mig), 'owner gate');
  check(/status IS DISTINCT FROM 'active'/.test(mig), 'active look');
}

section('3 · service + UI');
{
  const service = read('src/infrastructure/character/character-service.ts');
  const selector = read('src/app/look/CharacterLookSelector.tsx');
  check(/updateCharacterPersonalLook/.test(service), 'dedicated write helper');
  check(/assertPersonalLookOverrideWrite/.test(service), 'domain assert');
  check(/updateCharacterPersonalLook/.test(selector), 'selector uses gated write');
  check(/Welt-Look verwenden/.test(selector), 'clear override copy');
}

section('4 · domain smoke');
{
  const esbuild = require('esbuild');
  const outfile = join(root, 'node_modules/.cache/player-character-look-override-check/assert.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/personal-look-override.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const m = await import(pathToFileURL(outfile).href);
  const clear = m.assertPersonalLookOverrideWrite({
    characterOwnerUserId: 'u1',
    actorUserId: 'u1',
    personalLookProfileId: null,
    lookOwnerUserId: null,
    lookStatus: null,
    sagaAllowsPlayerOverrides: false,
  });
  check(clear.ok === true, 'clear always ok for owner');
  const forbidden = m.assertPersonalLookOverrideWrite({
    characterOwnerUserId: 'u1',
    actorUserId: 'u1',
    personalLookProfileId: 'look-1',
    lookOwnerUserId: 'u1',
    lookStatus: 'active',
    sagaAllowsPlayerOverrides: false,
  });
  check(forbidden.ok === false && forbidden.code === 'saga-forbidden', 'saga forbid blocks write');
  const ok = m.assertPersonalLookOverrideWrite({
    characterOwnerUserId: 'u1',
    actorUserId: 'u1',
    personalLookProfileId: 'look-1',
    lookOwnerUserId: 'u1',
    lookStatus: 'active',
    sagaAllowsPlayerOverrides: true,
  });
  check(ok.ok === true, 'allowed write ok');
  const stranger = m.assertPersonalLookOverrideWrite({
    characterOwnerUserId: 'u1',
    actorUserId: 'u2',
    personalLookProfileId: 'look-1',
    lookOwnerUserId: 'u1',
    lookStatus: 'active',
    sagaAllowsPlayerOverrides: true,
  });
  check(stranger.ok === false && stranger.code === 'not-owner', 'non-owner blocked');
}

section('5 · resolution still ignores when forbidden');
{
  const esbuild = require('esbuild');
  const resolveOut = join(root, 'node_modules/.cache/player-character-look-override-check/resolve.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/resolve.ts')],
    outfile: resolveOut,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const r = await import(pathToFileURL(resolveOut).href);
  const sysOut = join(root, 'node_modules/.cache/player-character-look-override-check/sys.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/system-default.ts')],
    outfile: sysOut,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const sys = await import(pathToFileURL(sysOut).href);
  const ctx = sys.buildLookResolutionContextFromSaga({
    sagaDefaultProfileId: 'look-saga',
    allowPlayerCharacterLookOverride: false,
    personalOverrideProfileId: 'look-personal',
  });
  const resolved = r.resolveLookProfileId('player-character', ctx);
  check(
    resolved.profileId === 'look-saga' && resolved.reason === 'saga-default',
    'resolution ignores personal when forbidden',
  );
}

section('6 · acceptance + test-gate');
{
  const acceptance = read('.qa/acceptance/player-character-look-override.md');
  check(/#351|personal_look|assertPersonalLook/.test(acceptance), 'acceptance present');
  const gate = read('scripts/test-gate.mjs');
  check(/player-character-look-override-check\.mjs/.test(gate), 'test-gate wiring');
}

if (failures > 0) {
  console.error(`\nplayer-character-look-override-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('player-character-look-override-check: OK (#351)');
