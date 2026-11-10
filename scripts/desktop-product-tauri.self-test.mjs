#!/usr/bin/env node
/**
 * Product Tauri packaging self-test (readiness + sidecar stand-in smoke).
 * Location: scripts/desktop-product-tauri.self-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

function assertOk(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const srcTauri = join(root, 'src-tauri');
assertOk(existsSync(srcTauri), 'src-tauri/ missing');
assertOk(existsSync(join(srcTauri, 'tauri.conf.json')), 'tauri.conf.json missing');
assertOk(existsSync(join(srcTauri, 'Cargo.toml')), 'Cargo.toml missing');
assertOk(existsSync(join(srcTauri, 'resources/host-sidecar.mjs')), 'host-sidecar.mjs missing');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assertOk(
  Boolean(pkg.dependencies?.['@tauri-apps/api'] || pkg.devDependencies?.['@tauri-apps/cli']),
  '@tauri-apps deps missing',
);

const readiness = spawn(process.execPath, [join(root, 'scripts/desktop-release-readiness.mjs')], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
const chunks = [];
for await (const chunk of readiness.stdout) chunks.push(chunk);
const errChunks = [];
for await (const chunk of readiness.stderr) errChunks.push(chunk);
const code = await new Promise((resolveCode) => readiness.on('close', resolveCode));
assertOk(code === 0, `readiness probe exit ${code}: ${Buffer.concat(errChunks).toString('utf8')}`);
const summary = JSON.parse(Buffer.concat(chunks).toString('utf8'));
assertOk(summary.ready === true, `expected ready=true, got ${JSON.stringify(summary)}`);
assertOk(summary.version === pkg.version, `version mismatch ${summary.version} vs ${pkg.version}`);

// Stand-in mode: force no host by pointing repo root at empty temp.
const dataDir = mkdtempSync(join(tmpdir(), 'sagatree-sidecar-'));
const fakeRoot = mkdtempSync(join(tmpdir(), 'sagatree-norepo-'));
const sidecar = spawn(process.execPath, [join(srcTauri, 'resources/host-sidecar.mjs')], {
  env: {
    ...process.env,
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_REPO_ROOT: fakeRoot,
    SAGATREE_SIDECAR_PORT: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let listening = null;
const timeout = setTimeout(() => {
  sidecar.kill('SIGTERM');
}, 5000);

await new Promise((resolveDone, reject) => {
  let buf = '';
  sidecar.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    const line = buf.split('\n').find((l) => l.includes('"event":"listening"'));
    if (line) {
      try {
        listening = JSON.parse(line);
        clearTimeout(timeout);
        resolveDone();
      } catch (err) {
        reject(err);
      }
    }
  });
  sidecar.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  sidecar.on('exit', (exitCode) => {
    if (!listening) {
      clearTimeout(timeout);
      reject(new Error(`sidecar exited before listening (${exitCode})`));
    }
  });
});

assertOk(listening?.mode === 'stand-in', `expected stand-in mode, got ${JSON.stringify(listening)}`);
assertOk(typeof listening.port === 'number' && listening.port > 0, 'stand-in port missing');

const health = await fetch(`http://127.0.0.1:${listening.port}/health`);
assertOk(health.ok, `health status ${health.status}`);
const healthJson = await health.json();
assertOk(healthJson.ok === true, 'health.ok');

const leak = await fetch(`http://127.0.0.1:${listening.port}/secrets-leak-probe`);
assertOk(leak.status === 404, `secrets probe must 404, got ${leak.status}`);

sidecar.kill('SIGTERM');
await new Promise((r) => sidecar.on('close', r));
rmSync(dataDir, { recursive: true, force: true });
rmSync(fakeRoot, { recursive: true, force: true });

// Confirm CLI package resolves (lockfile / install).
assertOk(Boolean(require.resolve('@tauri-apps/cli/package.json')), '@tauri-apps/cli not resolvable');

console.log(
  JSON.stringify(
    {
      ok: true,
      ready: summary.ready,
      version: summary.version,
      standInPort: listening.port,
    },
    null,
    2,
  ),
);
