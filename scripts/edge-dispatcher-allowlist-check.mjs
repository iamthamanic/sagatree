#!/usr/bin/env node
/**
 * edge-dispatcher-allowlist-check — static contract for #668 deny-by-default mounts.
 * Location: scripts/edge-dispatcher-allowlist-check.mjs
 *
 * Wired into test-gate. Deno unit tests: edge-dispatcher-allowlist_test.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`edge-dispatcher-allowlist-check failed: ${msg}`);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const allowlistTs = 'supabase/functions/_shared/edge-dispatcher-allowlist.ts';
const allowlistTest = 'supabase/functions/_shared/edge-dispatcher-allowlist_test.ts';
const mainTs = 'supabase/functions/main/index.ts';

for (const rel of [allowlistTs, allowlistTest, mainTs]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

const allowSrc = read(allowlistTs);
const mainSrc = read(mainTs);
const testSrc = read(allowlistTest);

if (!allowSrc.includes('EDGE_DISPATCHER_ALLOWLIST')) {
  fail('allowlist module must export EDGE_DISPATCHER_ALLOWLIST');
}
if (!allowSrc.includes('isEdgeDispatcherAllowed')) {
  fail('allowlist module must export isEdgeDispatcherAllowed');
}

for (const name of [
  'character-lore',
  'item-thumbnail',
  'item-model3d',
  'session-recap',
  'ai-provider-credentials',
  'ollama-settings',
]) {
  if (!allowSrc.includes(`'${name}'`)) {
    fail(`allowlist must include hardened mount ${name}`);
  }
}

for (const legacy of ['characters', 'sessions', 'ai-gm', 'marketplace', 'dm-tools']) {
  if (new RegExp(`['"]${legacy}['"]`).test(allowSrc) && allowSrc.includes('EDGE_DISPATCHER_ALLOWLIST')) {
    // Legacy must not appear inside the allowlist array — rough check via line scan
  }
}

const allowlistBlock = allowSrc.slice(
  allowSrc.indexOf('EDGE_DISPATCHER_ALLOWLIST'),
  allowSrc.indexOf('] as const'),
);
for (const legacy of ['characters', 'sessions', 'ai-gm', 'marketplace', 'dm-tools', 'rulesets']) {
  if (allowlistBlock.includes(`'${legacy}'`)) {
    fail(`legacy mount ${legacy} must not be on the allowlist`);
  }
}

if (!mainSrc.includes('isEdgeDispatcherAllowed')) {
  fail('main dispatcher must call isEdgeDispatcherAllowed');
}
if (!mainSrc.includes('edge-dispatcher-allowlist')) {
  fail('main must import edge-dispatcher-allowlist');
}
if (!mainSrc.includes('gateEdgeRequestJwt')) {
  fail('main must still enforce JWT gate after allowlist');
}

// Allowlist check must run before worker create
const allowIdx = mainSrc.indexOf('isEdgeDispatcherAllowed');
const createIdx = mainSrc.indexOf('userWorkers.create');
if (allowIdx < 0 || createIdx < 0 || allowIdx > createIdx) {
  fail('allowlist check must run before EdgeRuntime.userWorkers.create');
}

if (!testSrc.includes('legacy unauthenticated workers are denied')) {
  fail('Deno tests must cover legacy deny');
}
if (!testSrc.includes('characters')) {
  fail('Deno tests must name characters as denied');
}

console.log('edge-dispatcher-allowlist-check OK');
