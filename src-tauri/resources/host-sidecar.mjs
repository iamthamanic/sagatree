#!/usr/bin/env node
/**
 * Product desktop host sidecar.
 * Location: src-tauri/resources/host-sidecar.mjs
 *
 * Prefers the real SagaTree host (`server/` via npm) when the repo checkout
 * (or bundled host root) is present. Otherwise starts a loopback health
 * stand-in so unsigned installer shells still boot without inventing secrets.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = process.env.SAGATREE_DATA_DIR;
const repoRoot = process.env.SAGATREE_REPO_ROOT
  ? resolve(process.env.SAGATREE_REPO_ROOT)
  : resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const port = Number(process.env.SAGATREE_SIDECAR_PORT || '8787');
const failBoot = process.env.SAGATREE_FAIL_BOOT === '1';

if (!dataDir) {
  console.error('SAGATREE_DATA_DIR required');
  process.exit(2);
}
if (failBoot) {
  console.error('simulated-sidecar-boot-failure');
  process.exit(3);
}

mkdirSync(dataDir, { recursive: true });
writeFileSync(
  join(dataDir, 'sidecar-alive.json'),
  `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), mode: 'pending' }, null, 2)}\n`,
);

const hostEntry = join(repoRoot, 'server/src/bootstrap/main.ts');
const hostPackage = join(repoRoot, 'server/package.json');

/** @type {import('node:child_process').ChildProcess | null} */
let hostChild = null;

function shutdown(code = 0) {
  if (hostChild && !hostChild.killed) {
    hostChild.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

if (existsSync(hostEntry) && existsSync(hostPackage)) {
  writeFileSync(
    join(dataDir, 'sidecar-alive.json'),
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), mode: 'host' }, null, 2)}\n`,
  );
  hostChild = spawn(
    process.execPath,
    ['--experimental-strip-types', hostEntry],
    {
      cwd: join(repoRoot, 'server'),
      env: {
        ...process.env,
        SAGATREE_DATA_DIR: dataDir,
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  hostChild.on('exit', (code, signal) => {
    console.error(`host-exit code=${code} signal=${signal ?? ''}`);
    shutdown(code ?? 1);
  });
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', mode: 'host', port, dataDir })}\n`,
  );
} else {
  // Stand-in for packaged drafts until externalBin ships the full host.
  writeFileSync(
    join(dataDir, 'sidecar-alive.json'),
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), mode: 'stand-in' }, null, 2)}\n`,
  );
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: 'stand-in', dataDirExists: existsSync(dataDir) }));
      return;
    }
    if (req.url === '/secrets-leak-probe') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    res.writeHead(404);
    res.end('not-found');
  });
  server.on('error', (err) => {
    console.error(`sidecar-listen-error:${err && err.code ? err.code : 'unknown'}`);
    process.exit(4);
  });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const bound = typeof address === 'object' && address ? address.port : port;
    process.stdout.write(
      `${JSON.stringify({ event: 'listening', mode: 'stand-in', port: bound, dataDir })}\n`,
    );
  });
}
