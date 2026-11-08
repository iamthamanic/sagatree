#!/usr/bin/env node
/**
 * player-test-multiuser-e2e-security-check — contract for #303 / Epic #210 Phase 8.
 * Location: scripts/player-test-multiuser-e2e-security-check.mjs
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
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

function mustExist(rel, label) {
  if (!existsSync(join(root, rel))) {
    throw new Error(`${label}: missing ${rel}`);
  }
}

// ── Prior vertical-slice contracts must still be present ────────────────────
const PRIOR_GATES = [
  'scripts/player-test-session-security-check.mjs',
  'scripts/player-test-realtime-runtime-check.mjs',
  'scripts/player-test-player-panel-check.mjs',
  'scripts/player-test-shared-rolls-check.mjs',
  'scripts/player-test-shared-scene-presentation-check.mjs',
  'scripts/player-test-prepared-adventure-fixture-check.mjs',
  'scripts/player-test-combat-encounter-check.mjs',
];
for (const gate of PRIOR_GATES) {
  mustExist(gate, 'prior player-test gate');
}

mustInclude(
  'archive/supabase-legacy/supabase/migrations/041_session_runtime_state.sql',
  [
    'is_session_participant',
    'stale revision',
    'idempotency_key',
    'Completed sessions cannot accept gameplay commands',
    "'forbidden'",
    'Authentication required',
  ],
  'runtime security SQL',
);

mustInclude(
  'archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql',
  ['create_play_session', 'join_session_by_code', 'set_session_status', 'SECURITY DEFINER'],
  'session lifecycle SQL',
);

mustInclude(
  'src/domains/session/contracts/multiuser-e2e-security.ts',
  [
    'PHASE8_E2E_STEPS',
    'classifyRuntimeSecurityError',
    'authorizeSessionCommand',
    'decideIdempotencyReplay',
    'decideStaleRevision',
    'isCompletePhase8Checklist',
  ],
  'multiuser e2e domain',
);

mustInclude(
  'src/domains/session/contracts/index.ts',
  ["from './multiuser-e2e-security'"],
  'session contracts barrel',
);

const E2E_SPEC = 'e2e/player-test-multiuser-e2e-security.spec.ts';
mustExist(E2E_SPEC, 'playwright multi-context spec');
mustInclude(
  E2E_SPEC,
  [
    'browser.newContext',
    'PHASE8',
    'data-phase8-checklist',
    'unauthorized',
    'stale_revision',
    'duplicate_command',
    'E2E_PLAYER_TEST_LIVE',
  ],
  'playwright Phase 8 markers',
);

mustInclude(
  'scripts/test-gate.mjs',
  ['checkPlayerTestMultiuserE2eSecurity', 'player-test-multiuser-e2e-security-check.mjs'],
  'test-gate wiring',
);

// ── Domain unit tests ───────────────────────────────────────────────────────
const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-multiuser-e2e-security-check');
mkdirSync(cacheDir, { recursive: true });

const out = join(cacheDir, 'multiuser-e2e-security.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/multiuser-e2e-security.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(out).href);

const {
  PHASE8_E2E_STEPS,
  classifyRuntimeSecurityError,
  authorizeSessionCommand,
  decideIdempotencyReplay,
  decideStaleRevision,
  isCompletePhase8Checklist,
  missingPhase8Steps,
} = mod;

if (!Array.isArray(PHASE8_E2E_STEPS) || PHASE8_E2E_STEPS.length !== 12) {
  throw new Error(`PHASE8_E2E_STEPS must have 12 steps, got ${PHASE8_E2E_STEPS?.length}`);
}

{
  const classes = [
    ['Authentication required', 'unauthenticated'],
    ['forbidden', 'forbidden'],
    ['stale revision: expected 3, actual 4', 'stale_revision'],
    ['Completed sessions cannot accept gameplay commands', 'session_closed'],
    ['Session is completed', 'session_closed'],
    ['Session not found', 'not_found'],
  ];
  for (const [msg, expected] of classes) {
    const got = classifyRuntimeSecurityError(msg);
    if (got !== expected) {
      throw new Error(`classifyRuntimeSecurityError(${msg}) → ${got}, expected ${expected}`);
    }
  }
}

{
  const replay = decideIdempotencyReplay('cmd-1', ['cmd-1']);
  if (!replay.isReplay || replay.applyMutation) {
    throw new Error('duplicate idempotency must replay without mutation');
  }
  const fresh = decideIdempotencyReplay('cmd-2', ['cmd-1']);
  if (fresh.isReplay || !fresh.applyMutation) {
    throw new Error('new idempotency key must apply');
  }
}

{
  const stale = decideStaleRevision(2, 3);
  if (stale.accept || stale.class !== 'stale_revision') {
    throw new Error('stale revision must reject');
  }
  const ok = decideStaleRevision(5, 5);
  if (!ok.accept || ok.class !== 'ok') {
    throw new Error('matching revision must accept');
  }
}

{
  const base = {
    actorUserId: 'u1',
    isParticipant: true,
    isGm: false,
    sessionStatus: 'active',
    requiresGm: false,
    clientRevision: 1,
    serverRevision: 1,
  };
  const ok = authorizeSessionCommand(base);
  if (!ok.allowed || ok.isReplay) throw new Error('participant command should allow');

  const forbidden = authorizeSessionCommand({ ...base, requiresGm: true, isGm: false });
  if (forbidden.allowed || forbidden.class !== 'forbidden') {
    throw new Error('non-GM must be forbidden for GM commands');
  }

  const closed = authorizeSessionCommand({ ...base, sessionStatus: 'completed' });
  if (closed.allowed || closed.class !== 'session_closed') {
    throw new Error('completed session must reject');
  }

  const unauth = authorizeSessionCommand({ ...base, actorUserId: null });
  if (unauth.allowed || unauth.class !== 'unauthenticated') {
    throw new Error('null actor must be unauthenticated');
  }

  const outsider = authorizeSessionCommand({ ...base, isParticipant: false });
  if (outsider.allowed || outsider.class !== 'forbidden') {
    throw new Error('non-participant must be forbidden');
  }

  const staleCmd = authorizeSessionCommand({ ...base, clientRevision: 1, serverRevision: 9 });
  if (staleCmd.allowed || staleCmd.class !== 'stale_revision') {
    throw new Error('stale revision command must reject');
  }

  const dup = authorizeSessionCommand({
    ...base,
    idempotencyKey: 'same',
    priorIdempotencyKeys: ['same'],
  });
  if (!dup.allowed || !dup.isReplay) {
    throw new Error('duplicate idempotency should allow as replay');
  }
}

{
  if (isCompletePhase8Checklist(PHASE8_E2E_STEPS) !== true) {
    throw new Error('full checklist should be complete');
  }
  const missing = missingPhase8Steps(PHASE8_E2E_STEPS.slice(0, 3));
  if (missing.length !== 9) {
    throw new Error(`expected 9 missing steps, got ${missing.length}`);
  }
}

console.log('player-test-multiuser-e2e-security-check: OK');
