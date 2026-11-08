#!/usr/bin/env node
/**
 * session-look-override-check — Session Look inheritance + override (#349).
 * Location: scripts/session-look-override-check.mjs
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
  'archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql',
  'src/app/session/SessionLookSettings.tsx',
  'src/app/session/GamemasterLiveScreen.tsx',
  'src/domains/look/system-default.ts',
  '.qa/acceptance/session-look-override.md',
].forEach(mustExist);

section('2 · migration');
{
  const mig = read('archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql');
  check(/look_profile_id/.test(mig), 'look_profile_id column');
  check(/REFERENCES public\.look_profiles/.test(mig), 'FK to look_profiles');
  check(/enforce_session_look_profile_binding/.test(mig), 'ownership trigger');
  check(/status IS DISTINCT FROM 'active'|status = 'active'/.test(mig), 'active-only');
  check(/gm_user_id/.test(mig), 'GM gate in trigger');
}

section('3 · types + service');
{
  const types = read('src/domains/project/contracts/project.types.ts');
  const service = read('src/infrastructure/project/project-service.ts');
  check(/look_profile_id/.test(types), 'DTO field');
  check(/lookProfileId/.test(types), 'VM field');
  check(/updateSessionLookSettings/.test(service), 'service helper');
  check(/lookProfileId:/.test(service), 'maps lookProfileId');
}

section('4 · GM UI');
{
  const ui = read('src/app/session/SessionLookSettings.tsx');
  const gm = read('src/app/session/GamemasterLiveScreen.tsx');
  check(/Saga-Look übernehmen/.test(ui), 'inherit copy');
  check(/data-session-look-settings/.test(ui), 'data hook');
  check(/data-session-look-resolved/.test(ui), 'resolved display');
  check(/updateSessionLookSettings/.test(ui), 'persists via service');
  check(/resolveLookProfileId/.test(ui), 'uses domain resolution');
  check(!/CharacterLookInspector|LightingLookInspector|type=["']range["']/.test(ui), 'no authoring knobs');
  check(/SessionLookSettings/.test(gm), 'mounted in GM Live');
}

section('5 · resolution smoke');
{
  const esbuild = require('esbuild');
  const outfile = join(root, 'node_modules/.cache/session-look-override-check/system.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/system-default.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const m = await import(pathToFileURL(outfile).href);
  const withSession = m.resolveWorldLookForSession({
    sagaDefaultProfileId: 'look-saga',
    sessionOverrideProfileId: 'look-session',
  });
  check(
    withSession.profileId === 'look-session' && withSession.reason === 'session-override',
    'session override wins',
  );
  const inherit = m.resolveWorldLookForSession({
    sagaDefaultProfileId: 'look-saga',
    sessionOverrideProfileId: null,
  });
  check(
    inherit.profileId === 'look-saga' && inherit.reason === 'saga-default',
    'null override inherits saga',
  );
  const system = m.resolveWorldLookForSession({
    sagaDefaultProfileId: null,
    sessionOverrideProfileId: null,
  });
  check(
    system.profileId === m.SYSTEM_DEFAULT_LOOK_PROFILE_ID && system.reason === 'system-default',
    'null saga → system',
  );
}

section('6 · acceptance + test-gate');
{
  const acceptance = read('.qa/acceptance/session-look-override.md');
  check(/#349|Session-Look|Saga-Look übernehmen/.test(acceptance), 'acceptance present');
  const gate = read('scripts/test-gate.mjs');
  check(/session-look-override-check\.mjs/.test(gate), 'test-gate wiring');
}

if (failures > 0) {
  console.error(`\nsession-look-override-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('session-look-override-check: OK (#349)');
