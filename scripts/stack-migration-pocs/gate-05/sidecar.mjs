#!/usr/bin/env node
/**
 * Minimal GATE-05 host sidecar stand-in (health + data-dir probe).
 * Location: scripts/stack-migration-pocs/gate-05/sidecar.mjs
 *
 * Not a product binary — exercises start/stop/port/data-dir contracts only.
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.GATE05_SIDECAR_PORT || '0');
const dataDir = process.env.GATE05_DATA_DIR;
const failBoot = process.env.GATE05_FAIL_BOOT === '1';

if (!dataDir) {
  console.error('GATE05_DATA_DIR required');
  process.exit(2);
}
if (failBoot) {
  console.error('simulated-sidecar-boot-failure');
  process.exit(3);
}

mkdirSync(dataDir, { recursive: true });
const marker = join(dataDir, 'sidecar-alive.json');
writeFileSync(
  marker,
  `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dataDirExists: existsSync(dataDir) }));
    return;
  }
  if (req.url === '/secrets-leak-probe') {
    // Negative contract: sidecar must never expose host secrets to renderer clients.
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
  process.stdout.write(`${JSON.stringify({ event: 'listening', port: bound })}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
