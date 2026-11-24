#!/usr/bin/env node
/**
 * edge-dispatcher-allowlist-check — static contract for #668 deny-by-default mounts.
 * Location: scripts/edge-dispatcher-allowlist-check.mjs
 *
 * Wired into test-gate. Source of truth: server/src/http/edge-main-dispatcher.ts (host-owned
 * since #1328; no external mirror). Behavioural coverage: scripts/mig-414-edge-main.self-test.mjs.
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

const dispatcherTs = 'server/src/http/edge-main-dispatcher.ts';
if (!existsSync(join(root, dispatcherTs))) fail(`missing ${dispatcherTs}`);
const src = readFileSync(join(root, dispatcherTs), 'utf8');

for (const symbol of [
  'HOST_EDGE_DISPATCHER_ALLOWLIST',
  'HOST_EDGE_DISPATCHER_BLOCKED',
  'isHostEdgeDispatcherAllowed',
  'EDGE_DISPATCHER_ALLOWLIST',
  'isEdgeDispatcherAllowed',
]) {
  if (!new RegExp(`export (const|function) ${symbol}\\b`).test(src)) {
    fail(`${dispatcherTs} must export ${symbol}`);
  }
}

const start = src.indexOf('export const HOST_EDGE_DISPATCHER_ALLOWLIST');
const end = src.indexOf('] as const', start);
if (start < 0 || end < 0) fail('HOST_EDGE_DISPATCHER_ALLOWLIST array literal not found');
const allowlistBlock = src.slice(start, end);

for (const name of [
  'character-lore',
  'item-thumbnail',
  'item-model3d',
  'session-recap',
  'ai-provider-credentials',
  'ollama-settings',
]) {
  if (!allowlistBlock.includes(`'${name}'`)) {
    fail(`allowlist must include hardened mount ${name}`);
  }
}

for (const legacy of [
  'characters',
  'sessions',
  'ai-gm',
  'marketplace',
  'dm-tools',
  'rulesets',
  'bestiary',
  'export',
  'items',
]) {
  if (new RegExp(`['"]${legacy}['"]`).test(allowlistBlock)) {
    fail(`legacy mount ${legacy} must not be on the allowlist`);
  }
}

if (!/HOST_EDGE_DISPATCHER_BLOCKED\s*=\s*new Set\(\[\s*'main',\s*'_shared'\s*\]\)/.test(src)) {
  fail('main and _shared must stay blocked');
}

// Allowlist must be evaluated before the JWT gate and before any forward decision.
const dispatchIdx = src.indexOf('export async function dispatchEdgeMainRequest');
if (dispatchIdx < 0) fail('dispatchEdgeMainRequest missing');
const body = src.slice(dispatchIdx);
const allowIdx = body.indexOf('isHostEdgeDispatcherAllowed(serviceName)');
const jwtIdx = body.indexOf('gateEdgeMainJwt(');
if (allowIdx < 0 || jwtIdx < 0 || allowIdx > jwtIdx) {
  fail('allowlist check must run before the JWT gate in dispatchEdgeMainRequest');
}
if (!/wouldCreateWorker:\s*false/.test(body)) {
  fail('dispatcher must never create workers (wouldCreateWorker: false)');
}

console.log('edge-dispatcher-allowlist-check OK');
