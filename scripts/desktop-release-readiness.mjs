#!/usr/bin/env node
/**
 * Desktop release readiness probe for CI (.github/workflows/desktop-release.yml).
 *
 * FAIL-CLOSED for product packaging: GATE-05 PoC must not count as shippable.
 * Ready only when a real Tauri app package exists (src-tauri + config).
 *
 * Outputs GitHub Actions style ::set-output alternatives via GITHUB_OUTPUT.
 * Exit 0 always when invoked as a probe (CI decides fail vs deferred).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const srcTauri = resolve(root, 'src-tauri');
const confCandidates = [
  resolve(srcTauri, 'tauri.conf.json'),
  resolve(srcTauri, 'tauri.conf.json5'),
  // Tauri v2 TOML format uses the case-sensitive filename Tauri.toml.
  resolve(srcTauri, 'Tauri.toml'),
];

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function hasTauriPackageJsonDep() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const bags = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies];
    for (const bag of bags) {
      if (!bag || typeof bag !== 'object') continue;
      if ('@tauri-apps/cli' in bag || '@tauri-apps/api' in bag) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

const confPath = confCandidates.find((p) => existsSync(p)) ?? null;
const hasSrcTauri = existsSync(srcTauri);
const hasConf = Boolean(confPath);
const hasDep = hasTauriPackageJsonDep();
const ready = hasSrcTauri && hasConf && hasDep;
const version = readPackageVersion();

const reasons = [];
if (!hasSrcTauri) reasons.push('missing src-tauri/ (MIG-703 product packaging)');
if (!hasConf) reasons.push('missing src-tauri/tauri.conf.*');
if (!hasDep) reasons.push('package.json has no @tauri-apps/cli or @tauri-apps/api');

const summary = {
  ready,
  version,
  hasSrcTauri,
  hasConf,
  confPath: confPath ? confPath.replace(`${root}/`, '') : null,
  hasTauriDependency: hasDep,
  blockers: reasons,
  note: ready
    ? 'Desktop packaging present — matrix build may run.'
    : 'Deferred until MIG-703 activates product Tauri. GATE-05 PoC alone is not enough.',
};

console.log(JSON.stringify(summary, null, 2));

const ghOut = process.env.GITHUB_OUTPUT;
if (ghOut) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(
    ghOut,
    [
      `ready=${ready ? 'true' : 'false'}`,
      `version=${version}`,
      `blocker<<EOF`,
      reasons.join('\n') || 'none',
      `EOF`,
      '',
    ].join('\n'),
  );
}

// Probe always exits 0; workflow jobs decide fail vs deferred.
process.exit(0);
