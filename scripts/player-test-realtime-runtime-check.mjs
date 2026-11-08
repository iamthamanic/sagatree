#!/usr/bin/env node
/**
 * player-test-realtime-runtime-check — contract for #297 / Epic #210 Phase 2.
 * Location: scripts/player-test-realtime-runtime-check.mjs
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
  'archive/supabase-legacy/supabase/migrations/041_session_runtime_state.sql',
  [
    'runtime_revision',
    'session_events',
    'get_session_runtime_snapshot',
    'apply_session_runtime_command',
    'set_session_player_presence',
    'idempotency_key',
    'stale revision',
    'SECURITY DEFINER',
  ],
  'migration runtime RPCs',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  [
    'SessionRuntimeState',
    'StaleRuntimeRevisionError',
    'assertExpectedRevision',
    'parseGameplayFromWorldState',
    'SessionEventKind',
  ],
  'runtime domain contract',
);

mustNotInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure domain runtime',
);

mustInclude(
  'src/infrastructure/session/session-runtime-service.ts',
  [
    'fetchHostSessionRuntime',
    'applyHostSessionRuntimeCommand',
    'setHostSessionPresence',
    'StaleRuntimeRevisionError',
    'host-session-http',
  ],
  'runtime service host HTTP (CUT-20)',
);

mustInclude(
  'src/infrastructure/session/session-runtime-channel.ts',
  [
    'subscribeSessionRuntime',
    'HOST_RUNTIME_POLL_MS',
    'getSnapshot',
    'sessionRuntimeService',
  ],
  'runtime channel polling adapter (CUT-20)',
);

mustInclude(
  'src/app/session/hooks/useSessionRuntime.ts',
  ['subscribeSessionRuntime', 'resync', 'visibilitychange', 'applyCommand'],
  'reconnect hook',
);

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-realtime-runtime-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'session-runtime.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-runtime.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
});

const runtime = await import(pathToFileURL(domainOut).href);

const empty = runtime.emptyGameplayState();
if (empty.sceneId !== null || empty.combatActive !== false) {
  throw new Error('emptyGameplayState must be { sceneId: null, combatActive: false }');
}

const parsed = runtime.parseGameplayFromWorldState({
  sceneId: 'sc-1',
  combatActive: true,
  shared: { turn: 2 },
});
if (parsed.sceneId !== 'sc-1' || parsed.combatActive !== true || parsed.shared.turn !== 2) {
  throw new Error('parseGameplayFromWorldState failed');
}

try {
  runtime.assertExpectedRevision(3, 4);
  throw new Error('assertExpectedRevision should throw on mismatch');
} catch (err) {
  if (!(err instanceof runtime.StaleRuntimeRevisionError)) {
    throw err;
  }
  if (err.expected !== 3 || err.actual !== 4) {
    throw new Error('StaleRuntimeRevisionError fields wrong');
  }
}

runtime.assertExpectedRevision(5, 5);

if (!runtime.isSessionEventKind('roll') || runtime.isSessionEventKind('hack')) {
  throw new Error('isSessionEventKind failed');
}

const roster = runtime.upsertRosterPresence([], {
  userId: 'u1',
  characterId: null,
  isOnline: true,
  joinedAt: '2026-01-01T00:00:00.000Z',
});
if (roster.length !== 1 || roster[0].userId !== 'u1') {
  throw new Error('upsertRosterPresence failed');
}
if (runtime.removeRosterUser(roster, 'u1').length !== 0) {
  throw new Error('removeRosterUser failed');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('player-test-realtime-runtime-check.mjs')) {
  throw new Error('test-gate must invoke player-test-realtime-runtime-check.mjs');
}

console.log('player-test-realtime-runtime-check: OK');
