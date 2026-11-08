#!/usr/bin/env node
/**
 * cut-20-legacy-client-ban.self-test — ban Supabase dual-path in product src (#1155).
 * Location: scripts/cut-20-legacy-client-ban.self-test.mjs
 *
 * Fail-closed AST/regex scan of productive frontend sources. Historical
 * Edge/SQL lives under archive/supabase-legacy/ (CUT-21) and is out of scope.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const srcRoot = join(root, 'src');

const BANNED = [
  { id: 'functions.invoke', re: /supabase\.functions\.invoke\s*\(/ },
  { id: 'from(', re: /supabase\.from\s*\(/ },
  { id: 'rpc(', re: /supabase\.rpc\s*\(/ },
  { id: 'auth.', re: /supabase\.auth\./ },
  { id: 'storage', re: /supabase\.storage\b/ },
  {
    id: 'host-library-opt-out',
    re: /isHostLibraryExplicitlyDisabled|VITE_SAGATREE_HOST_LIBRARY\s*[=!]=|HOST_LIBRARY['"]?\s*===\s*['"]0['"]/,
  },
  {
    id: 'supabase-js-import',
    re: /from\s+['"]@supabase\/supabase-js['"]/,
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    /** Edge function sources under `archive/supabase-legacy/src-supabase/` — CUT-21 archive; out of product scan. */
    if (name === 'supabase') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const files = walk(srcRoot);
const violations = [];

for (const full of files) {
  const rel = relative(root, full).replace(/\\/g, '/');
  const text = readFileSync(full, 'utf8');
  for (const ban of BANNED) {
    if (!ban.re.test(text)) continue;
    if (ban.id === 'host-library-opt-out' && rel === 'src/infrastructure/host/host-library-http.ts') {
      // Gate helper may still mention the env key only while documenting removal —
      // ban any opt-out branch instead.
      if (!/=== ['"]0['"]|=== ['"]false['"]|=== ['"]off['"]|=== ['"]no['"]/.test(text)) {
        continue;
      }
    }
    violations.push(`${rel}: ${ban.id}`);
  }
}

assert(violations.length === 0, `legacy client ban violations:\n${violations.join('\n')}`);

// Host auth URL remains the sole product routing signal.
const hostLib = readFileSync(join(srcRoot, 'infrastructure/host/host-library-http.ts'), 'utf8');
assert(!/isHostLibraryExplicitlyDisabled/.test(hostLib), 'opt-out helper removed');
assert(/getHostAuthBaseUrl/.test(hostLib), 'host auth URL gate retained');

console.log(`PASS: cut-20-legacy-client-ban (${files.length} src files scanned)`);
