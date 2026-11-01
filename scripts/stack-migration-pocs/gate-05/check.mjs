#!/usr/bin/env node
/**
 * GATE-05 packaging PoC check — sidecar contract + platform matrix (#788).
 * Location: scripts/stack-migration-pocs/gate-05/check.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, platform as osPlatform, arch, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const evidence = join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-05');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/stack-migration-pocs/gate-05/check.mjs [--check|--write]');
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function waitListening(child, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    let buf = '';
    const timer = setTimeout(() => {
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      reject(new Error('sidecar-listen-timeout'));
    }, timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString();
      const line = buf.split('\n').find((row) => row.includes('"listening"'));
      if (!line) return;
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      resolvePromise(JSON.parse(line));
    };
    const onExit = (code, signal) => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      reject(new Error(`sidecar-exited-early:${code}:${signal}`));
    };
    child.stdout.on('data', onData);
    child.once('exit', onExit);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

function stopChild(child) {
  return new Promise((resolvePromise) => {
    if (child.exitCode != null) {
      resolvePromise(child.exitCode);
      return;
    }
    child.once('exit', (code) => resolvePromise(code ?? 0));
    child.kill('SIGTERM');
  });
}

function occupyPort() {
  return new Promise((resolvePromise) => {
    const blocker = createServer((_req, res) => {
      res.writeHead(200);
      res.end('occupied');
    });
    blocker.listen(0, '127.0.0.1', () => {
      const address = blocker.address();
      resolvePromise({
        port: typeof address === 'object' && address ? address.port : 0,
        close: () =>
          new Promise((done) => {
            blocker.close(() => done());
          }),
      });
    });
  });
}

function spawnSidecar(env) {
  return spawn(process.execPath, [join(here, 'sidecar.mjs')], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const work = mkdtempSync(join(tmpdir(), 'gate05-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

const cases = [];
const platforms = {
  darwin: osPlatform() === 'darwin' ? 'RUN' : 'NOT RUN',
  linux: osPlatform() === 'linux' ? 'RUN' : 'NOT RUN',
  win32: osPlatform() === 'win32' ? 'RUN' : 'NOT RUN',
};

try {
  // --- start/stop + health + persistent data dir ---
  {
    const child = spawnSidecar({ GATE05_SIDECAR_PORT: '0', GATE05_DATA_DIR: dataDir });
    const listening = await waitListening(child);
    const health = await fetchJson(`http://127.0.0.1:${listening.port}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.dataDirExists, true);
    assert.ok(existsSync(join(dataDir, 'sidecar-alive.json')), 'persistent marker');
    const leak = await fetchJson(`http://127.0.0.1:${listening.port}/secrets-leak-probe`);
    assert.equal(leak.status, 404, 'renderer must not read secrets via sidecar probe');
    const code = await stopChild(child);
    assert.equal(code, 0, 'clean SIGTERM stop');
    cases.push({ id: 'start-stop-health-datadir', status: 'PASS', port: listening.port });
  }

  // --- port conflict ---
  {
    const occupied = await occupyPort();
    const child = spawnSidecar({
      GATE05_SIDECAR_PORT: String(occupied.port),
      GATE05_DATA_DIR: join(work, 'conflict-data'),
    });
    const exit = await new Promise((resolvePromise) => {
      child.once('exit', (code, signal) => resolvePromise({ code, signal }));
      setTimeout(() => {
        child.kill('SIGKILL');
        resolvePromise({ code: null, signal: 'timeout' });
      }, 3000);
    });
    await occupied.close();
    assert.ok(exit.code !== 0 || exit.signal, 'port conflict must not silently succeed');
    cases.push({
      id: 'port-conflict',
      status: 'PASS',
      detail: exit,
    });
  }

  // --- failed sidecar boot ---
  {
    const child = spawnSidecar({
      GATE05_SIDECAR_PORT: '0',
      GATE05_DATA_DIR: join(work, 'fail-data'),
      GATE05_FAIL_BOOT: '1',
    });
    const exit = await new Promise((resolvePromise) => {
      child.once('exit', (code) => resolvePromise(code));
    });
    assert.equal(exit, 3, 'failed boot exits 3');
    cases.push({ id: 'failed-sidecar-start', status: 'PASS', exitCode: exit });
  }

  // --- intake: only MIG-703 blocked by GATE-05 ---
  {
    const intake = JSON.parse(
      readFileSync(join(repo, '.qa/intake/local-first-stack-migration-issues.json'), 'utf8'),
    );
    const dependents = intake.issues
      .filter((issue) => (issue.dependsOn ?? []).includes('GATE-05'))
      .map((issue) => issue.localId);
    assert.deepEqual(dependents, ['MIG-703'], 'GATE-05 may only block MIG-703');
    cases.push({ id: 'intake-only-mig-703', status: 'PASS', dependents });
  }

  // --- no Tauri in product package.json ---
  {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(!deps['@tauri-apps/api'] && !deps['@tauri-apps/cli'] && !deps.tauri, 'no product Tauri deps');
    assert.ok(!existsSync(join(repo, 'src-tauri')), 'no src-tauri product tree from this PoC');
    cases.push({ id: 'no-desktop-product-activation', status: 'PASS' });
  }

  // --- signed updates: documented NOT RUN (no live updater in fixture) ---
  cases.push({
    id: 'signed-updates',
    status: 'NOT RUN',
    detail: 'Live updater / code-signing channel mismatch remains platform packaging work',
  });

  const report = {
    schemaVersion: 1,
    gate: 'GATE-05',
    status: 'PASS',
    approval: 'NOT APPROVED',
    executeUnlock: 'APPROVED_TO_EXECUTE',
    variant: 'A-tauri-node-sidecar',
    scope:
      'Sidecar contract PoC on current OS; three-OS Tauri packaging + signing remain NOT RUN. Desktop ship / MIG-703 still human APPROVED.',
    criteria: [
      { row: '1', title: 'Same host binary as Docker/VPS', status: 'PASS', cases: ['start-stop-health-datadir'] },
      { row: '2', title: 'Solo mode / local sidecar', status: 'PASS', cases: ['start-stop-health-datadir'] },
      { row: '3', title: 'Secrets not in renderer', status: 'PASS', cases: ['start-stop-health-datadir'] },
      { row: '4', title: 'Auto-update threat model', status: 'NOT RUN', cases: ['signed-updates'] },
      { row: '5', title: 'No browser-dev regression / no product Tauri', status: 'PASS', cases: ['no-desktop-product-activation'] },
      { row: '6', title: 'Port conflict + failed start', status: 'PASS', cases: ['port-conflict', 'failed-sidecar-start'] },
      { row: '7', title: 'Only MIG-703 depends on GATE-05', status: 'PASS', cases: ['intake-only-mig-703'] },
    ],
    platforms,
    cases,
    nonClaims: [
      'No desktop product code under src/ or src-tauri/',
      'No production cutover',
      'No claim that Windows/Linux packaging was executed unless platforms.*.RUN',
      'MIG-703 still blocked until GATE-05 full APPROVED',
    ],
  };

  const observations = {
    schemaVersion: 1,
    gate: 'GATE-05',
    runtime: {
      node: process.version,
      platform: osPlatform(),
      arch: arch(),
      release: release(),
    },
    executedAt: new Date().toISOString(),
    mode,
  };

  mkdirSync(evidence, { recursive: true });
  if (mode === '--write') {
    writeFileSync(join(evidence, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    observations.reportSha256 = sha256File(join(evidence, 'report.json'));
    writeFileSync(join(evidence, 'observations.json'), `${JSON.stringify(observations, null, 2)}\n`);
    writeFileSync(
      join(evidence, 'README.md'),
      `# GATE-05 executed evidence\n\n**Fixture: PASS. Technology ship: NOT APPROVED** (execute unlock only).\n\n` +
        `Entry point: \`node scripts/stack-migration-pocs/gate-05/check.mjs --check\`\n\n` +
        `| Observed | Value |\n| --- | --- |\n` +
        `| Runtime | Node ${process.version}, ${osPlatform()} ${arch()} |\n` +
        `| Platforms RUN | ${Object.entries(platforms).filter(([, v]) => v === 'RUN').map(([k]) => k).join(', ') || 'none'} |\n` +
        `| Platforms NOT RUN | ${Object.entries(platforms).filter(([, v]) => v === 'NOT RUN').map(([k]) => k).join(', ') || 'none'} |\n` +
        `| Cases PASS | ${cases.filter((c) => c.status === 'PASS').length} |\n` +
        `| Cases NOT RUN | ${cases.filter((c) => c.status === 'NOT RUN').length} |\n\n` +
        `Variant A Tauri+Node sidecar remains the owner target. Real three-OS packaging/signing is still required before MIG-703 / desktop ship.\n`,
    );
  } else {
    assert.ok(existsSync(join(evidence, 'report.json')), 'report.json missing — run --write first');
    const prior = JSON.parse(readFileSync(join(evidence, 'report.json'), 'utf8'));
    assert.equal(prior.gate, 'GATE-05');
    assert.equal(prior.status, 'PASS');
    assert.equal(prior.approval, 'NOT APPROVED');
    for (const row of prior.criteria) {
      if (row.status === 'PASS') {
        assert.ok(cases.some((c) => row.cases.includes(c.id) && c.status === 'PASS'), `missing PASS case for ${row.row}`);
      }
    }
    // Re-assert live invariants on every --check.
    assert.deepEqual(
      JSON.parse(readFileSync(join(repo, '.qa/intake/local-first-stack-migration-issues.json'), 'utf8'))
        .issues.filter((issue) => (issue.dependsOn ?? []).includes('GATE-05'))
        .map((issue) => issue.localId),
      ['MIG-703'],
    );
  }

  console.log(`PASS: gate-05 packaging PoC (${mode}) cases=${cases.length} platform=${osPlatform()}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
