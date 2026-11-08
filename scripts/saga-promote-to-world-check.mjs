#!/usr/bin/env node
/**
 * saga-promote-to-world-check — #582 promote session outcomes to saga/world.
 * Location: scripts/saga-promote-to-world-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Saga promote-to-world check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migration = 'archive/supabase-legacy/supabase/migrations/070_saga_promote_session_outcomes.sql';
if (!existsSync(join(root, migration))) fail(`missing ${migration}`);
const mig = read(migration);
requireMatch(mig, /session_outcome_promotions/i, 'ledger table');
requireMatch(mig, /promote_session_outcome_to_saga/i, 'saga RPC');
requireMatch(mig, /promote_session_outcome_to_world/i, 'world RPC');
requireMatch(mig, /Native Sagas sind unveränderlich/i, 'native reject');
requireMatch(mig, /owner_user_id IS DISTINCT FROM/i, 'saga author check');
requireMatch(mig, /current_user_can_edit_world_profile/i, 'world owner check');
requireMatch(mig, /promotedLore/i, 'world lore path');
requireMatch(mig, /append_session_event/i, 'audit event');

const domain = read('src/domains/session/contracts/session-outcome-promotion.ts');
requireMatch(domain, /planPromoteConsequence/i, 'planPromoteConsequence');
requireMatch(domain, /parsePromoteRpcResult/i, 'parsePromoteRpcResult');

const service = read('src/infrastructure/saga/session-outcome-promotion-service.ts');
requireMatch(service, /promoteToSaga/i, 'promoteToSaga');
requireMatch(service, /promoteToWorld/i, 'promoteToWorld');

const ui = read('src/app/session/SessionRecapPromoteActions.tsx');
requireMatch(ui, /data-session-recap-promote/i, 'promote marker');
requireMatch(ui, /In die Saga/i, 'saga button DE');
requireMatch(ui, /In die Welt/i, 'world button DE');
requireMatch(ui, /min-h-11/i, 'AU');
requireMatch(ui, /\buseState\b|\buseRef\b/, 'allowed hooks');
if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(ui)) {
  fail('type escape hatch in UI');
}

const recap = read('src/app/session/SessionRecapScreen.tsx');
requireMatch(recap, /SessionRecapPromoteActions/i, 'wired in recap');
requireMatch(recap, /selfRole === 'gamemaster'/i, 'GM-only promote');

requireMatch(read('scripts/apply-migrations.sh'), /070_saga_promote_session_outcomes\.sql/, 'apply-migrations');
requireMatch(read('scripts/test-gate.mjs'), /saga-promote-to-world-check\.mjs/, 'test-gate');

const touched = [domain, service, ui, recap, mig];
for (const content of touched) {
  if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(content)) {
    fail('type escape hatch');
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-promote-to-world-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'promote.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-outcome-promotion.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const mod = await import(pathToFileURL(out).href);
const bad = mod.planPromoteConsequence({
  target: 'saga',
  consequenceId: 'pending',
  summary: 'x',
  kind: 'note',
});
if (bad.ok) fail('pending id must fail');
const ok = mod.planPromoteConsequence({
  target: 'world',
  consequenceId: 'c1',
  summary: 'Der Bote kam',
  kind: 'deadline',
});
if (!ok.ok || !ok.confirmDe.includes('Welt')) fail('world plan');
const parsed = mod.parsePromoteRpcResult({
  ok: true,
  idempotent: true,
  targetRef: 'promoted:c1',
  messageDe: 'ok',
});
if (!parsed.ok || !parsed.idempotent) fail('parse result');

console.log('Saga promote-to-world check OK');
