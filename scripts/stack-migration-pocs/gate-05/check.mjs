#!/usr/bin/env node
/**
 * GATE-05 packaging PoC check — sidecar contract + platform matrix (#788).
 * Location: scripts/stack-migration-pocs/gate-05/check.mjs
 *
 * Proves the Node sidecar *contract* (listen/stop/port/data-dir/secrets).
 * Does not claim the product `server/` binary or three-OS Tauri packaging.
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function waitListening(child, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    let buf = '';
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      if (err) reject(err);
      else resolvePromise(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('sidecar-listen-timeout'));
    }, timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString();
      const line = buf.split('\n').find((row) => row.includes('"listening"'));
      if (!line) return;
      finish(null, JSON.parse(line));
    };
    const onExit = (code, signal) => {
      finish(new Error(`sidecar-exited-early:${code}:${signal}`));
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
  return new Promise((resolvePromise, reject) => {
    if (child.exitCode != null || child.signalCode != null) {
      resolvePromise({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('sidecar-stop-timeout'));
    }, 5000);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal });
    });
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

function waitExit(child, timeoutMs = 3000) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('sidecar-exit-timeout'));
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal });
    });
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
  // --- start/stop + health + secrets probe ---
  {
    const child = spawnSidecar({ GATE05_SIDECAR_PORT: '0', GATE05_DATA_DIR: dataDir });
    const listening = await waitListening(child);
    const health = await fetchJson(`http://127.0.0.1:${listening.port}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.dataDirExists, true);
    assert.ok(existsSync(join(dataDir, 'sidecar-alive.json')), 'marker written on boot');
    const leak = await fetchJson(`http://127.0.0.1:${listening.port}/secrets-leak-probe`);
    assert.equal(leak.status, 404, 'renderer must not read secrets via sidecar probe');
    const stop = await stopChild(child);
    assert.equal(stop.signal, null, 'clean stop must not die on signal');
    assert.equal(stop.code, 0, 'clean SIGTERM stop exits 0');
    cases.push({ id: 'start-stop-health', status: 'PASS', port: listening.port });
    cases.push({ id: 'secrets-not-in-renderer', status: 'PASS' });
  }

  // --- persistent data dir survives restart ---
  {
    const markerPath = join(dataDir, 'sidecar-alive.json');
    assert.ok(existsSync(markerPath), 'marker must survive first shutdown');
    const first = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.ok(first.pid && first.startedAt, 'first marker payload');
    const child = spawnSidecar({ GATE05_SIDECAR_PORT: '0', GATE05_DATA_DIR: dataDir });
    const listening = await waitListening(child);
    assert.ok(existsSync(markerPath), 'marker present after second boot');
    const second = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.notEqual(second.pid, first.pid, 'second boot rewrites marker');
    assert.ok(existsSync(dataDir), 'data dir path persists across restart');
    const stop = await stopChild(child);
    assert.equal(stop.code, 0);
    assert.equal(stop.signal, null);
    assert.ok(existsSync(markerPath), 'marker survives second shutdown');
    cases.push({ id: 'persistent-datadir-restart', status: 'PASS', port: listening.port });
  }

  // --- port conflict must exit 4 (EADDRINUSE), never timeout PASS ---
  {
    const occupied = await occupyPort();
    const child = spawnSidecar({
      GATE05_SIDECAR_PORT: String(occupied.port),
      GATE05_DATA_DIR: join(work, 'conflict-data'),
    });
    let exit;
    try {
      exit = await waitExit(child, 3000);
    } finally {
      await occupied.close();
    }
    assert.equal(exit.signal, null, 'port conflict must exit, not hang until SIGKILL');
    assert.equal(exit.code, 4, 'occupied port must exit 4');
    cases.push({ id: 'port-conflict', status: 'PASS', detail: exit });
  }

  // --- failed sidecar boot ---
  {
    const child = spawnSidecar({
      GATE05_SIDECAR_PORT: '0',
      GATE05_DATA_DIR: join(work, 'fail-data'),
      GATE05_FAIL_BOOT: '1',
    });
    const exit = await waitExit(child, 3000);
    assert.equal(exit.signal, null);
    assert.equal(exit.code, 3, 'failed boot exits 3');
    cases.push({ id: 'failed-sidecar-start', status: 'PASS', exitCode: exit.code });
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

  // --- signed updates + product host binary packaging: NOT RUN ---
  cases.push({
    id: 'signed-updates',
    status: 'NOT RUN',
    detail: 'Live updater / code-signing channel mismatch remains platform packaging work',
  });
  cases.push({
    id: 'product-host-binary-packaging',
    status: 'NOT RUN',
    detail:
      'Fixture uses sidecar.mjs stand-in; packaging the product server/ binary into Tauri is deferred to three-OS qualification',
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
      {
        row: '1',
        title: 'Product host binary packaged with Tauri (same as Docker/VPS)',
        status: 'NOT RUN',
        cases: ['product-host-binary-packaging'],
      },
      { row: '2', title: 'Solo mode / local sidecar contract', status: 'PASS', cases: ['start-stop-health', 'persistent-datadir-restart'] },
      { row: '3', title: 'Secrets not in renderer', status: 'PASS', cases: ['secrets-not-in-renderer'] },
      { row: '4', title: 'Auto-update threat model', status: 'NOT RUN', cases: ['signed-updates'] },
      { row: '5', title: 'No browser-dev regression / no product Tauri', status: 'PASS', cases: ['no-desktop-product-activation'] },
      { row: '6', title: 'Port conflict + failed start', status: 'PASS', cases: ['port-conflict', 'failed-sidecar-start'] },
      { row: '7', title: 'Only MIG-703 depends on GATE-05', status: 'PASS', cases: ['intake-only-mig-703'] },
    ],
    platforms,
    cases,
    nonClaims: [
      'No desktop product code under src/ or src-tauri/',
      'No claim that sidecar.mjs is the product server/ binary',
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
    assert.ok(existsSync(join(evidence, 'observations.json')), 'observations.json missing — run --write first');
    const prior = JSON.parse(readFileSync(join(evidence, 'report.json'), 'utf8'));
    const priorObs = JSON.parse(readFileSync(join(evidence, 'observations.json'), 'utf8'));
    assert.equal(prior.gate, 'GATE-05');
    assert.equal(prior.status, 'PASS');
    assert.equal(prior.approval, 'NOT APPROVED');
    assert.equal(priorObs.reportSha256, sha256File(join(evidence, 'report.json')), 'committed report digest must match observations.reportSha256');
    // Platforms in report.json are observations from the --write host. Do not require
    // deepEqual with the current CI host (linux CI would fail a darwin-written matrix).
    for (const key of ['darwin', 'linux', 'win32']) {
      assert.ok(['RUN', 'NOT RUN'].includes(prior.platforms?.[key]), `platforms.${key} must be RUN|NOT RUN`);
    }
    assert.ok(
      Object.values(prior.platforms).includes('RUN'),
      'committed report must record at least one RUN platform',
    );
    assert.equal(prior.criteria.length, report.criteria.length, 'criteria row count drift');
    for (const row of prior.criteria) {
      const live = report.criteria.find((entry) => entry.row === row.row);
      assert.ok(live, `missing live criterion ${row.row}`);
      assert.equal(live.status, row.status, `criterion ${row.row} status drift`);
      assert.deepEqual(live.cases, row.cases, `criterion ${row.row} case mapping drift`);
      if (row.status === 'PASS') {
        for (const caseId of row.cases) {
          const liveCase = cases.find((entry) => entry.id === caseId);
          assert.ok(liveCase && liveCase.status === 'PASS', `criterion ${row.row} missing live PASS case ${caseId}`);
        }
      }
      if (row.status === 'NOT RUN') {
        for (const caseId of row.cases) {
          const liveCase = cases.find((entry) => entry.id === caseId);
          assert.ok(liveCase && liveCase.status === 'NOT RUN', `criterion ${row.row} must stay NOT RUN (${caseId})`);
        }
      }
    }
    assert.equal(
      stableStringify(prior.cases.map((entry) => ({ id: entry.id, status: entry.status }))),
      stableStringify(cases.map((entry) => ({ id: entry.id, status: entry.status }))),
      'case id/status ledger must match committed report',
    );
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
