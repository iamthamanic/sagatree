#!/usr/bin/env node
/**
 * player-test-session-security-check — contract for #296 / Epic #210 Phase 1.
 * Location: scripts/player-test-session-security-check.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql',
  [
    'generate_unique_session_code',
    'create_play_session',
    'join_session_by_code',
    'set_session_status',
    'leave_play_session',
    'sessions_code_uidx',
    'SECURITY DEFINER',
  ],
  'migration RPCs',
);

mustInclude(
  'src/infrastructure/session/session-service.ts',
  [
    'createHostPlaySession',
    'joinHostSessionByCode',
    'setHostSessionStatus',
    'leaveHostPlaySession',
    'host-session-http',
  ],
  'session-service host HTTP (CUT-20)',
);

mustNotInclude(
  'src/infrastructure/session/session-service.ts',
  [
    'Math.random()',
    'make-server-9f6fb44c',
    'publicAnonKey',
    'archive/supabase-legacy/src-utils-supabase/info',
    '.supabase.co/functions',
  ],
  'no hosted join / client code gen',
);

mustInclude(
  'src/domains/session/contracts/session-lifecycle.ts',
  ['canTransitionPlaySessionStatus', 'normalizeSessionJoinCode', 'normalizePlaySessionStatus'],
  'lifecycle domain',
);

mustNotInclude(
  'src/domains/session/contracts/session-lifecycle.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure domain lifecycle',
);

mustInclude(
  'src/app/session/SessionJoin.tsx',
  ['project_id', 'useProjectSummaries', 'Saga *', 'data-session-join-project'],
  'SessionJoin requires Saga (project_id)',
);

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-session-security-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'session-lifecycle.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-lifecycle.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});

const lifecycle = await import(pathToFileURL(domainOut).href);

if (!lifecycle.canTransitionPlaySessionStatus('waiting', 'active')) {
  throw new Error('waiting → active must be allowed');
}
if (lifecycle.canTransitionPlaySessionStatus('completed', 'active')) {
  throw new Error('completed → active must be forbidden');
}
if (lifecycle.normalizePlaySessionStatus('scheduled') !== 'waiting') {
  throw new Error('scheduled must normalize to waiting');
}
if (lifecycle.normalizeSessionJoinCode(' abc123 ') !== 'ABC123') {
  throw new Error('join code normalize failed');
}

console.log('Player-test session security check passed.');
