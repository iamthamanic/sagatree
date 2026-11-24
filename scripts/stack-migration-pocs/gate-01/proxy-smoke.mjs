// Smoke test for the `@hono/node-server` override (see README "Abhängigkeits-Overrides"):
// starts the real `zen proxy` (which serves through @hono/node-server `serve()`) on a
// throwaway SQLite file and requires a JSON answer from /api/schema.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, 'work');
fs.mkdirSync(work, { recursive: true });
const dbFile = path.join(work, 'proxy-smoke.sqlite');
fs.rmSync(dbFile, { force: true });

const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const { port: p } = server.address(); server.close(() => resolve(p)); });
});

const bin = path.join(here, 'node_modules/.bin/zen');
const child = spawn(bin, ['proxy', '--schema', 'zenstack/schema.zmodel', '-o', 'zenstack', '-p', String(port), '-d', 'file:' + dbFile],
  { cwd: here, env: { ...process.env, DO_NOT_TRACK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });
const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));

const fail = (message) => { child.kill('SIGTERM'); console.error('proxy-smoke FAIL: ' + message + '\n' + log); process.exit(1); };
const deadline = Date.now() + 60_000;
let body;
while (Date.now() < deadline) {
  const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r(undefined), 500))]);
  if (code !== undefined) fail('zen proxy exited early with code ' + code);
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/api/schema', { signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - Date.now()))) });
    if (res.status !== 200) fail('/api/schema returned HTTP ' + res.status);
    body = await res.json();
    break;
  } catch (error) {
    // Retry until the overall 60s deadline: TypeError = connection refused while the proxy
    // is still starting, TimeoutError = a cold first request still initialising. A hang that
    // outlasts the deadline ends below as 'no HTTP answer within 60s'.
    if (!(error instanceof TypeError) && error?.name !== 'TimeoutError') fail(String(error));
  }
}
if (!body) fail('no HTTP answer within 60s');
const text = JSON.stringify(body);
if (!text.includes('models')) fail('/api/schema answer does not describe models');
child.kill('SIGTERM');
await exited;
fs.rmSync(dbFile, { force: true });
console.log('proxy-smoke PASS: zen proxy served /api/schema via @hono/node-server on port ' + port);
