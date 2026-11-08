#!/usr/bin/env node
/**
 * edge-cors-shared-check — Edge Functions must use `_shared/cors.ts` (#305/#306).
 * Location: scripts/edge-cors-shared-check.mjs
 *
 * Wave 2 (#306): every function `index.ts` except the `main` dispatcher must
 * import `_shared/cors` and must not set Access-Control-Allow-Origin locally.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const functionsRoot = join(root, 'archive/supabase-legacy/supabase/functions');
const sharedCorsPath = join(functionsRoot, '_shared/cors.ts');

/** Dispatcher only — no browser CORS surface. */
const CORS_EXEMPT = new Set(['main']);

function fail(message) {
  console.error(`edge-cors-shared-check FAIL: ${message}`);
  process.exit(1);
}

function listFunctionDirs() {
  if (!existsSync(functionsRoot)) fail('archive/supabase-legacy/supabase/functions missing');
  return readdirSync(functionsRoot)
    .filter((name) => name !== '_shared' && !name.startsWith('.'))
    .filter((name) => {
      const indexPath = join(functionsRoot, name, 'index.ts');
      try {
        return statSync(join(functionsRoot, name)).isDirectory() && existsSync(indexPath);
      } catch {
        return false;
      }
    })
    .sort();
}

if (!existsSync(sharedCorsPath)) {
  fail('archive/supabase-legacy/supabase/functions/_shared/cors.ts is required');
}

const sharedSrc = readFileSync(sharedCorsPath, 'utf8');
if (!/export function corsHeaders/.test(sharedSrc)) {
  fail('_shared/cors.ts must export corsHeaders');
}
if (!/export function handleOptions/.test(sharedSrc)) {
  fail('_shared/cors.ts must export handleOptions');
}

const dirs = listFunctionDirs();
const originLiteral = /Access-Control-Allow-Origin/;
const sharedImport = /_shared\/cors(?:\.ts)?['"]/;

let migrated = 0;
for (const name of dirs) {
  const src = readFileSync(join(functionsRoot, name, 'index.ts'), 'utf8');
  if (CORS_EXEMPT.has(name)) {
    if (originLiteral.test(src)) {
      fail(`${name}: exempt dispatcher must not set Access-Control-Allow-Origin`);
    }
    continue;
  }

  if (!sharedImport.test(src)) {
    fail(`${name}: must import ../_shared/cors.ts`);
  }
  if (originLiteral.test(src)) {
    fail(`${name}: must not set Access-Control-Allow-Origin locally`);
  }
  migrated += 1;
}

console.log(
  `edge-cors-shared-check PASS (${migrated} functions on shared cors; exempt: ${[...CORS_EXEMPT].join(', ')})`,
);
