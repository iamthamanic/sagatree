#!/usr/bin/env node
/**
 * cut-21-eradicate-supabase.self-test — prove Supabase/Deno runtime eradication (#1156).
 * Location: scripts/cut-21-eradicate-supabase.self-test.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|json)$/.test(name)) out.push(full);
  }
  return out;
}

assert(!existsSync(join(root, 'supabase')), 'root supabase/ must be archived');
assert(!existsSync(join(root, 'src/supabase')), 'src/supabase/ must be archived');
assert(!existsSync(join(root, 'src/utils/supabase')), 'src/utils/supabase/ must be archived');
{
  const denoLock = join(root, 'deno.lock');
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'deno.lock'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert(tracked.status !== 0, 'deno.lock must not remain tracked at repo root');
  // Local Deno tooling may recreate an untracked lock; scrub it so the tree stays clean.
  if (existsSync(denoLock)) {
    unlinkSync(denoLock);
  }
}
assert(
  existsSync(join(root, 'archive/supabase-legacy/README.md')),
  'archive/supabase-legacy/README.md required',
);
assert(
  existsSync(join(root, 'archive/supabase-legacy/supabase/functions')),
  'historical Edge sources must remain under archive/',
);
assert(
  existsSync(join(root, 'archive/supabase-legacy/supabase/migrations')),
  'historical migrations must remain under archive/',
);

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const allDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.optionalDependencies ?? {}),
};
for (const key of Object.keys(allDeps)) {
  assert(
    !/supabase/i.test(key),
    `package.json must not depend on ${key}`,
  );
}

const productRoots = [join(root, 'src'), join(root, 'server/src')];
const sdkImport = /from\s+['"]@supabase\/supabase-js['"]|from\s+['"]jsr:@supabase|npm:@supabase\/supabase-js/;
const violations = [];
for (const base of productRoots) {
  for (const full of walk(base)) {
    const rel = relative(root, full).replace(/\\/g, '/');
    if (rel.startsWith('archive/')) continue;
    const text = readFileSync(full, 'utf8');
    if (sdkImport.test(text)) violations.push(rel);
  }
}
assert(violations.length === 0, `product SDK imports remain:\n${violations.join('\n')}`);

const supabaseTs = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8');
assert(
  !/^\s*import\s+.*@supabase\/supabase-js/m.test(supabaseTs),
  'src/lib/supabase.ts must not import the Supabase SDK',
);
assert(
  !/\bcreateClient\s*\(/.test(supabaseTs),
  'src/lib/supabase.ts must not construct a Supabase client',
);
assert(
  /rewriteBrowserStorageUrl/.test(supabaseTs),
  'src/lib/supabase.ts keeps rewriteBrowserStorageUrl helper',
);

const dispatcher = readFileSync(
  join(root, 'server/src/http/edge-main-dispatcher.ts'),
  'utf8',
);
assert(
  /EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED\s*=\s*false/.test(dispatcher),
  '/functions/v1 public activation must stay unauthorized',
);

console.log('PASS: cut-21-eradicate-supabase.self-test');
