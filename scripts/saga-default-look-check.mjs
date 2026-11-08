#!/usr/bin/env node
/**
 * saga-default-look-check — Saga default Look + player override (#348).
 * Location: scripts/saga-default-look-check.mjs
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
  'archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql',
  'src/domains/look/system-default.ts',
  'src/app/project/SagaVisualStyleSettings.tsx',
  'src/app/project/SagaResourceScreen.tsx',
  '.qa/acceptance/saga-default-look.md',
].forEach(mustExist);

section('2 · migration binding');
{
  const mig = read('archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql');
  check(/default_look_profile_id/.test(mig), 'default_look_profile_id column');
  check(/allow_player_character_look_override/.test(mig), 'allow override column');
  check(/REFERENCES public\.look_profiles/.test(mig), 'FK to look_profiles');
  check(/enforce_default_look_profile_binding/.test(mig), 'ownership trigger');
  check(/status IS DISTINCT FROM 'active'|status = 'active'/.test(mig), 'active-only binding');
  check(/look_owner IS DISTINCT FROM auth\.uid\(\)/.test(mig), 'owner check');
}

section('3 · types + service');
{
  const types = read('src/domains/project/contracts/project.types.ts');
  const service = read('src/infrastructure/project/project-service.ts');
  const hook = read('src/app/project/hooks/useProjects.ts');
  check(/default_look_profile_id/.test(types), 'DTO field');
  check(/defaultLookProfileId/.test(types), 'VM field');
  check(/allowPlayerCharacterLookOverride/.test(types), 'VM override field');
  check(/updateProjectLookSettings/.test(service), 'service helper');
  check(/defaultLookProfileId/.test(service), 'mapToViewModel');
  check(/default_look_profile_id/.test(hook), 'useProjects maps field');
}

section('4 · UI settings + no authoring knobs');
{
  const screen = read('src/app/project/SagaResourceScreen.tsx');
  const ui = read('src/app/project/SagaVisualStyleSettings.tsx');
  check(/section === 'settings'/.test(screen), 'settings branch');
  check(/SagaVisualStyleSettings/.test(screen), 'mounts visual style');
  check(/Visueller Stil/.test(ui), 'section title DE');
  check(/Spieler dürfen einen eigenen Charakter-Look verwenden/.test(ui), 'override copy');
  check(/pathForLookEdit/.test(ui), 'links Look Editor');
  check(/updateProjectLookSettings/.test(ui), 'saves via service');
  check(/listLookProfiles/.test(ui), 'loads visible looks');
  check(/isGm/.test(ui) || /gmUserId/.test(ui), 'GM gate');
  check(!/CharacterLookInspector|LightingLookInspector|type=["']range["']/.test(ui), 'no look authoring knobs');
  check(/data-saga-visual-style/.test(ui), 'data hook');
}

section('5 · domain resolution helper');
{
  const esbuild = require('esbuild');
  const outfile = join(root, 'node_modules/.cache/saga-default-look-check/system-default.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/system-default.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const m = await import(pathToFileURL(outfile).href);
  check(m.SYSTEM_DEFAULT_LOOK_PROFILE_ID === 'look.system.default', 'system default id');
  const ctx = m.buildLookResolutionContextFromSaga({
    sagaDefaultProfileId: 'look-1',
    allowPlayerCharacterLookOverride: false,
  });
  check(ctx.sagaDefaultProfileId === 'look-1', 'saga default mapped');
  check(ctx.playerOverridesAllowed === false, 'override flag mapped');
  check(ctx.systemDefaultProfileId === 'look.system.default', 'system id on context');

  const resolveOut = join(root, 'node_modules/.cache/saga-default-look-check/resolve.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/resolve.ts')],
    outfile: resolveOut,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const r = await import(pathToFileURL(resolveOut).href);
  const world = r.resolveLookProfileId('world', ctx);
  check(world.profileId === 'look-1' && world.reason === 'saga-default', 'world uses saga default');
  const noSaga = m.buildLookResolutionContextFromSaga({
    sagaDefaultProfileId: null,
    allowPlayerCharacterLookOverride: true,
  });
  const fallback = r.resolveLookProfileId('world', noSaga);
  check(
    fallback.profileId === 'look.system.default' && fallback.reason === 'system-default',
    'null saga → system default',
  );
}

section('6 · acceptance + test-gate');
{
  const acceptance = read('.qa/acceptance/saga-default-look.md');
  check(/#348|Visueller Stil|defaultLook/.test(acceptance), 'acceptance present');
  const gate = read('scripts/test-gate.mjs');
  check(/saga-default-look-check\.mjs/.test(gate), 'test-gate wiring');
}

if (failures > 0) {
  console.error(`\nsaga-default-look-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('saga-default-look-check: OK (#348)');
