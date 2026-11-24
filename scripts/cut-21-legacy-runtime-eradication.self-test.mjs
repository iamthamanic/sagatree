#!/usr/bin/env node
/**
 * cut-21-legacy-runtime-eradication.self-test — prove the retired BaaS / Deno runtime is gone
 * from the product (#1156, tightened by #1328).
 * Location: scripts/cut-21-legacy-runtime-eradication.self-test.mjs
 *
 * Product = Node/Hono host (server/) + React/Vite FE (src/). Asserts: no legacy runtime dirs,
 * no legacy SDK dependency or import, no legacy-named files in product/test trees, and the
 * storage URL helper lives at its neutral location. Does not require any archive to exist.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LEGACY_BAAS, legacyStackPattern } from './lib/legacy-stack-terms.mjs';

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

for (const rel of [LEGACY_BAAS, `src/${LEGACY_BAAS}`, `src/utils/${LEGACY_BAAS}`]) {
  assert(!existsSync(join(root, rel)), `${rel}/ must not exist (legacy runtime)`);
}
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

const legacy = legacyStackPattern('i');
for (const rel of ['package.json', 'server/package.json']) {
  const pkg = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
  for (const key of Object.keys(allDeps)) {
    assert(!legacy.test(key), `${rel} must not depend on ${key}`);
  }
}

const productRoots = [join(root, 'src'), join(root, 'server/src'), join(root, 'e2e')];
const sdkImport = new RegExp(
  `from\\s+['"]@${LEGACY_BAAS}/|from\\s+['"]jsr:@${LEGACY_BAAS}|npm:@${LEGACY_BAAS}/|archive/[\\w.-]*legacy`,
);
const importViolations = [];
for (const base of productRoots) {
  for (const full of walk(base)) {
    const rel = relative(root, full).replace(/\\/g, '/');
    const text = readFileSync(full, 'utf8');
    if (sdkImport.test(text)) importViolations.push(rel);
  }
}
assert(
  importViolations.length === 0,
  `legacy SDK imports / archive references remain:\n${importViolations.join('\n')}`,
);

// File and directory names in product, test and host trees must not carry the legacy name.
const tracked = spawnSync('git', ['ls-files', '--', 'src', 'server', 'e2e'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
assert(tracked.status === 0, 'git ls-files failed');
const nameViolations = tracked.stdout
  .split('\n')
  .filter(Boolean)
  .filter((rel) => legacy.test(rel));
assert(nameViolations.length === 0, `legacy-named files remain:\n${nameViolations.join('\n')}`);

const assetUrls = join(root, 'src/lib/asset-urls.ts');
assert(existsSync(assetUrls), 'src/lib/asset-urls.ts must exist');
assert(
  /export function rewriteBrowserStorageUrl/.test(readFileSync(assetUrls, 'utf8')),
  'src/lib/asset-urls.ts keeps the rewriteBrowserStorageUrl helper',
);

const dispatcher = readFileSync(
  join(root, 'server/src/http/edge-main-dispatcher.ts'),
  'utf8',
);
assert(
  /EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED\s*=\s*false/.test(dispatcher),
  '/functions/v1 public activation must stay unauthorized',
);

console.log('PASS: cut-21-legacy-runtime-eradication.self-test');
