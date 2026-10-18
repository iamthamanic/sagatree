#!/usr/bin/env node
/**
 * donalu-p0-auth-gate-check — World/Atlas adapters must require GoTrue JWT.
 * Blocks anon PostgREST calls that surface as permission denied / not authenticated.
 * Location: scripts/donalu-p0-auth-gate-check.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Donalu P0 auth gate check failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`missing ${label}: ${needle}`);
}

const authUser = read('src/lib/authenticatedUser.ts');
requireIncludes(authUser, 'export async function assertSupabaseJwtSession', 'assertSupabaseJwtSession export');
requireIncludes(authUser, 'API_AUTH_REQUIRED_DE', 'German API auth message');

const authCtx = read('src/lib/auth-context.tsx');
requireIncludes(authCtx, 'hasJwtSession', 'hasJwtSession on AuthContext');
requireIncludes(authCtx, 'ensureJwtSession', 'ensureJwtSession on AuthContext');

const worldProfiles = read('src/infrastructure/world/world-profile-service.ts');
requireIncludes(worldProfiles, 'assertSupabaseJwtSession', 'world-profile-service JWT assert');

const atlas = read('src/infrastructure/world/world-atlas-service.ts');
requireIncludes(atlas, 'assertSupabaseJwtSession', 'world-atlas-service JWT assert');
requireIncludes(atlas, 'ensureRoot', 'ensureRoot still present');

const places = read('src/infrastructure/world/world-place-service.ts');
requireIncludes(places, 'assertSupabaseJwtSession', 'world-place-service JWT assert');

// No client service-role bypass for world auth
for (const [label, src] of [
  ['world-profile-service', worldProfiles],
  ['world-atlas-service', atlas],
  ['world-place-service', places],
  ['auth-context', authCtx],
]) {
  if (/service_role|SERVICE_ROLE/i.test(src)) {
    fail(`${label} must not reference service_role`);
  }
}

console.log('Donalu P0 auth gate check: OK');
